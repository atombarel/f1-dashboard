import type { SessionSummary } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import clsx from 'clsx'
import { ErrorState, Flag, PageHeader, Panel, SectionTitle, StartLights, Stat, StatusPill } from '@/components/ui'
import { PodiumChips, sessionShort, shortName } from '@/features/home/shared'
import { getLocale, t } from '@/i18n'
import { sessionName } from '@/i18n/helpers'
import { meetingQuery } from '@/lib/api'
import { onDark } from '@/lib/colors'
import { clock, dateRange, localClock } from '@/lib/format'

const dayKey = (iso: string) => new Date(iso).toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' })

export function MeetingPage() {
  const { meetingKey } = useParams({ from: '/gp/$meetingKey' })
  const q = useQuery(meetingQuery(meetingKey))
  if (q.isPending) return <StartLights />
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />
  const m = q.data.meeting

  // group sessions per calendar day (user's timezone)
  const days = new Map<string, SessionSummary[]>()
  for (const s of m.sessions) (days.get(dayKey(s.dateStart)) ?? days.set(dayKey(s.dateStart), []).get(dayKey(s.dateStart))!).push(s)

  const race = m.sessions.find((s) => s.kind === 'race')
  const winner = race?.podium?.[0]
  const processing = m.sessions.some((s) => s.status === 'processing')

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <Link to="/saison/$year" params={{ year: m.year }} className="link-underline hover:text-paper">
              {t('season.label', { year: m.year })}
            </Link>
            <span className="text-dim">/</span>
            <span>{m.round ? t('season.round', { n: m.round }) : m.isTesting ? t('season.testing') : t('season.nonChampionship')}</span>
            {m.isCancelled && <span className="ml-2 text-signal">{t('season.cancelled')}</span>}
          </>
        }
        title={
          <span className={clsx('flex items-center gap-4', m.isCancelled && 'line-through decoration-signal')}>
            <Flag src={m.countryFlag} alt={m.countryName} className="h-9 border border-line sm:h-12" />
            {shortName(m.name)}
          </span>
        }
      >
        <span className="font-mono text-[11px] uppercase tracking-wider">{m.officialName}</span>
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <SectionTitle index="01" title={t('meeting.schedule')} aside={<span>{t('meeting.timesNote')}</span>} />
          {processing && (
            <div className="mb-4 flex items-center gap-2 border border-amber/30 bg-amber/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-amber">
              <span className="animate-pulse-dot size-1.5 rounded-full bg-amber" /> {t('meeting.processing')}
            </div>
          )}
          <ol className="relative space-y-8 border-l border-line pl-6">
            {[...days.entries()].map(([day, sessions], di) => (
              <li key={day} className="animate-rise relative" style={{ animationDelay: `${di * 80}ms` }}>
                <span className="absolute top-0.5 size-2.5 rotate-45 border border-signal/70 bg-ink" style={{ left: -30 }} />
                <div className="eyebrow mb-3 capitalize text-paper/80">{day}</div>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <SessionRow key={s.key} session={s} gmtOffset={m.gmtOffset} />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="space-y-6">
          <Panel className="p-6">
            {m.circuitImage ? (
              <img src={m.circuitImage} alt={t('meeting.circuitAlt', { circuit: m.circuitName })} onError={(e) => (e.currentTarget.style.display = 'none')} className="mx-auto w-full max-w-[320px] drop-shadow-[0_0_24px_rgba(255,59,47,0.2)]" />
            ) : (
              <div className="py-16 text-center text-sm text-dim">{t('meeting.trackUnavailable')}</div>
            )}
            <div className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5">
              <Stat label={t('meeting.circuit')} value={<span className="font-sans text-base">{m.circuitName}</span>} sub={m.location} />
              <Stat label={t('meeting.country')} value={<span className="font-sans text-base">{m.countryName}</span>} sub={`UTC${m.gmtOffset.startsWith('-') ? '' : '+'}${m.gmtOffset.slice(0, 5)}`} />
              <Stat label={t('meeting.dates')} value={<span className="font-sans text-base">{dateRange(m.dateStart, m.dateEnd)}</span>} sub={String(m.year)} />
              <Stat label={t('meeting.sessions')} value={m.sessions.length} sub={m.sessions.some((s) => s.kind === 'sprint') ? t('meeting.sprintFormat') : t('meeting.classicFormat')} />
            </div>
          </Panel>
          {winner && race && (
            <Link to="/session/$sessionKey" params={{ sessionKey: race.key }} className="panel group block p-6">
              <div className="eyebrow mb-3">{t('season.winner')}</div>
              <div className="flex items-center gap-3">
                <span className="h-12 w-1.5" style={{ background: onDark(winner.teamColour) }} />
                <div>
                  <div className="display text-5xl">{winner.acronym}</div>
                  <div className="text-xs text-muted">
                    {winner.fullName} · {winner.teamName}
                  </div>
                </div>
              </div>
              <PodiumChips podium={race.podium} className="mt-4" />
              <div className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted group-hover:text-signal">{t('meeting.raceAnalysis')}</div>
            </Link>
          )}
        </aside>
      </div>
    </div>
  )
}

function SessionRow({ session: s, gmtOffset }: { session: SessionSummary; gmtOffset: string }) {
  return (
    <Link
      to="/session/$sessionKey"
      params={{ sessionKey: s.key }}
      className={clsx(
        'group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border bg-carbon p-4 transition-colors sm:grid-cols-[88px_1fr_auto_auto]',
        s.status === 'live' ? 'border-signal/70 bg-signal-soft' : 'border-line hover:border-line-2 hover:bg-panel',
        s.status === 'cancelled' && 'opacity-50',
      )}
    >
      <span className={clsx('display order-1 text-3xl sm:text-4xl', s.status === 'live' && 'text-signal')}>{sessionShort(s.name)}</span>
      <div className="order-2 flex items-center gap-3 justify-self-end sm:order-4">
        <StatusPill status={s.status} className="whitespace-nowrap" />
        <span className="font-mono text-xs text-dim transition-all group-hover:translate-x-0.5 group-hover:text-signal">→</span>
      </div>
      <div className="order-3 col-span-2 min-w-0 sm:order-2 sm:col-span-1">
        <div className="truncate text-sm text-paper">{sessionName(s.name)}</div>
        <div className="tnum mt-0.5 whitespace-nowrap text-xs text-muted">
          {clock(s.dateStart)} – {clock(s.dateEnd)} <span className="text-dim">· {t('homeShared.atTrack', { time: localClock(s.dateStart, gmtOffset) })}</span>
        </div>
        {s.status === 'processing' && <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-amber">{t('homeShared.fetching')}</div>}
        <PodiumChips podium={s.podium} className="mt-2 sm:hidden" />
      </div>
      <PodiumChips podium={s.podium} className="order-4 hidden sm:order-3 sm:flex" />
    </Link>
  )
}
