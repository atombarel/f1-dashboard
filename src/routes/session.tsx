import { isRaceLike } from '@shared/sessions'
import type { Driver } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { lazy, Suspense, useMemo } from 'react'
import { ErrorState, Flag, PageHeader, StartLights, StatusPill } from '@/components/ui'
import { bundleQuery, sessionMetaQuery } from '@/lib/api'
import { dayDate, clock, localClock } from '@/lib/format'
import { sessionRoute, type SessionTab } from '@/router'
import type { TabProps } from '@/features/session/types'

const Results = lazy(() => import('@/features/session/Results'))
const Laps = lazy(() => import('@/features/session/Laps'))
const RaceChart = lazy(() => import('@/features/session/RaceChart'))
const Strategy = lazy(() => import('@/features/session/Strategy'))
const Control = lazy(() => import('@/features/session/Control'))
const Telemetry = lazy(() => import('@/features/telemetry/Telemetry'))
const Replay = lazy(() => import('@/features/telemetry/Replay'))

const TAB_LABELS: Record<SessionTab, string> = {
  results: 'Classement',
  laps: 'Tours',
  race: 'Course',
  strategy: 'Stratégie',
  telemetry: 'Télémétrie',
  replay: 'Replay',
  control: 'Direction de course',
}

export function SessionPage() {
  const { sessionKey } = sessionRoute.useParams()
  const search = sessionRoute.useSearch()
  const navigate = sessionRoute.useNavigate()
  const meta = useQuery(sessionMetaQuery(sessionKey))
  const bundle = useQuery({ ...bundleQuery(meta.data?.bundleUrl ?? ''), enabled: Boolean(meta.data?.bundleUrl) })

  const kind = meta.data?.session.kind
  const tabs = useMemo<SessionTab[]>(() => {
    if (!kind) return ['results']
    const t: SessionTab[] = ['results', 'laps']
    if (isRaceLike(kind)) t.push('race')
    t.push('strategy', 'telemetry')
    if (isRaceLike(kind)) t.push('replay')
    t.push('control')
    return t
  }, [kind])
  const tab = search.tab && tabs.includes(search.tab) ? search.tab : 'results'

  const derived = useMemo(() => {
    const b = bundle.data
    if (!b) return null
    const drivers = new Map(b.drivers.map((d) => [d.number, d]))
    const ordered = [
      ...b.results.map((r) => drivers.get(r.driverNumber)).filter((d): d is Driver => Boolean(d)),
      ...b.drivers.filter((d) => !b.results.some((r) => r.driverNumber === d.number)),
    ]
    return { drivers, ordered }
  }, [bundle.data])

  const selected = useMemo(() => {
    if (search.d !== undefined) return search.d.split(',').map(Number).filter(Number.isFinite)
    // default: top 5 of the classification (top 2 for telemetry-like comparisons is handled by tabs)
    return derived?.ordered.slice(0, 5).map((d) => d.number) ?? []
  }, [search.d, derived])

  const setSelected = (next: number[]) => navigate({ search: (s) => ({ ...s, d: next.join(',') }), replace: true, resetScroll: false })

  if (meta.isPending) return <StartLights />
  if (meta.isError) return <ErrorState error={meta.error} retry={() => meta.refetch()} />

  const { session, meeting } = meta.data
  const header = (
    <PageHeader
      eyebrow={
        <>
          <Link to="/saison/$year" params={{ year: meeting.year }} className="link-underline hover:text-paper">
            Saison {meeting.year}
          </Link>
          <span className="text-dim">/</span>
          <Link to="/gp/$meetingKey" params={{ meetingKey: meeting.key }} className="link-underline hover:text-paper">
            {meeting.round ? `Manche ${meeting.round}` : meeting.name}
          </Link>
          <StatusPill status={session.status} className="ml-2" />
        </>
      }
      title={
        <span className="flex flex-wrap items-baseline gap-x-4">
          <span>{meeting.name.replace('Grand Prix', 'GP')}</span>
          <span className="text-signal">{session.name}</span>
        </span>
      }
      aside={
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="eyebrow">Départ</div>
            <div className="tnum text-sm text-paper">
              {dayDate(session.dateStart)} · {clock(session.dateStart)}
            </div>
            <div className="tnum text-[11px] text-dim">{localClock(session.dateStart, meeting.gmtOffset)} heure locale</div>
          </div>
          <Flag src={meeting.countryFlag} alt={meeting.countryName} className="h-10 border border-line" />
        </div>
      }
    >
      {meeting.circuitName} · {meeting.location}, {meeting.countryName}
    </PageHeader>
  )

  if (!meta.data.bundleUrl) {
    return (
      <>
        {header}
        {session.status === 'upcoming' ? (
          <Pending title="Pas encore commencée" text="Les données apparaîtront ici quelques minutes après le drapeau à damier." />
        ) : session.status === 'live' ? (
          <Pending live title="Session en cours" text="Les données complètes sont publiées peu après la fin de la session. Cette page se met à jour toute seule." />
        ) : meta.data.unavailable ? (
          <Pending title="Données indisponibles" text="OpenF1 n’a pas publié les données de cette session. Nouvel essai automatique dans quelques jours." />
        ) : session.status === 'cancelled' ? (
          <Pending title="Session annulée" text="Aucune donnée pour cette session." />
        ) : (
          <Pending live title="Récupération des données" text="On télécharge les tours, les pneus, les classements et la télémétrie. Quelques secondes…" />
        )}
      </>
    )
  }

  if (bundle.isPending || !derived) return (<>{header}<StartLights label="Chargement de la session" /></>)
  if (bundle.isError) return (<>{header}<ErrorState error={bundle.error} retry={() => bundle.refetch()} /></>)

  const props: TabProps = { meta: meta.data, bundle: bundle.data, drivers: derived.drivers, ordered: derived.ordered, selected, setSelected }

  return (
    <>
      {header}
      <nav className="sticky top-14 z-40 -mx-4 mb-8 overflow-x-auto border-b border-line bg-ink/85 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex">
          {tabs.map((t, i) => (
            <Link
              key={t}
              from={sessionRoute.fullPath}
              search={(s) => ({ ...s, tab: t === 'results' ? undefined : t })}
              resetScroll={false}
              className={clsx(
                'relative flex items-baseline gap-2 whitespace-nowrap px-4 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors',
                t === tab ? 'text-paper' : 'text-muted hover:text-paper',
              )}
            >
              <span className="text-[9px] text-dim">{String(i + 1).padStart(2, '0')}</span>
              {TAB_LABELS[t]}
              {t === 'telemetry' && !meta.data.telemetryUrl && <span className="animate-pulse-dot size-1 rounded-full bg-amber" title="En cours de traitement" />}
              {t === tab && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-signal" />}
            </Link>
          ))}
        </div>
      </nav>
      <Suspense fallback={<StartLights />}>
        <div key={tab} className="animate-rise">
          {tab === 'results' && <Results {...props} />}
          {tab === 'laps' && <Laps {...props} />}
          {tab === 'race' && <RaceChart {...props} />}
          {tab === 'strategy' && <Strategy {...props} />}
          {tab === 'telemetry' && <Telemetry {...props} />}
          {tab === 'replay' && <Replay {...props} />}
          {tab === 'control' && <Control {...props} />}
        </div>
      </Suspense>
    </>
  )
}

function Pending({ title, text, live }: { title: string; text: string; live?: boolean }) {
  return (
    <div className="panel flex flex-col items-center gap-4 px-6 py-20 text-center">
      {live && (
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="size-3 rounded-full bg-signal" style={{ animation: `pulse-dot 1.5s ${i * 0.18}s ease-in-out infinite` }} />
          ))}
        </div>
      )}
      <div className="display text-4xl">{title}</div>
      <p className="max-w-md text-sm text-muted">{text}</p>
    </div>
  )
}
