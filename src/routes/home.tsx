import type { HomeResponse, MeetingSummary, SessionSummary } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { EmptyState, ErrorState, Flag, Panel, SectionTitle, Skeleton, StartLights } from '@/components/ui'
import { PodiumChips, SessionCard, sessionShort, shortName, useNow } from '@/features/home/shared'
import { t } from '@/i18n'
import { sessionName } from '@/i18n/helpers'
import { homeQuery, seasonQuery } from '@/lib/api'
import { onDark } from '@/lib/colors'
import { countdownParts, dateRange, longDate, points } from '@/lib/format'

export function HomePage() {
  const home = useQuery(homeQuery())
  if (home.isPending) return <StartLights />
  if (home.isError) return <ErrorState error={home.error} retry={() => home.refetch()} />
  const h = home.data
  const focus = h.live ?? h.next
  const weekend = h.live?.meeting ?? h.currentMeeting ?? h.next?.meeting ?? null

  return (
    <div className="space-y-14">
      {focus ? <Hero meeting={focus.meeting} session={focus.session} live={Boolean(h.live)} /> : <SeasonOver year={h.year} />}

      {weekend && (
        <section className="animate-rise" style={{ animationDelay: '120ms' }}>
          <SectionTitle
            index="01"
            title={t('home.weekend', { name: shortName(weekend.name) })}
            aside={
              <Link to="/gp/$meetingKey" params={{ meetingKey: weekend.key }} className="link-underline font-mono uppercase tracking-wider hover:text-paper">
                {t('home.viewGp')}
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {weekend.sessions.map((s, i) => (
              <SessionCard key={s.key} session={s} meeting={weekend} index={i} highlight={s.key === focus?.session.key} />
            ))}
          </div>
        </section>
      )}

      <SeasonStrip year={h.year} />

      <div className="grid gap-10 lg:grid-cols-12">
        <section className="animate-rise lg:col-span-5" style={{ animationDelay: '240ms' }}>
          <SectionTitle index="03" title={t('home.lastRace')} />
          {h.lastRace ? <LastRace meeting={h.lastRace.meeting} session={h.lastRace.session} /> : <EmptyState title={t('home.noRaceTitle')}>{t('home.noRaceBody')}</EmptyState>}
        </section>
        <section className="animate-rise lg:col-span-7" style={{ animationDelay: '320ms' }}>
          <SectionTitle
            index="04"
            title={t('home.championship')}
            aside={
              <Link to="/classements/$year" params={{ year: h.year }} className="link-underline font-mono uppercase tracking-wider hover:text-paper">
                {t('home.fullStandings')}
              </Link>
            }
          />
          {h.standings ? <Championship standings={h.standings} /> : <EmptyState title={t('standings.unavailableTitle')}>{t('home.standingsPending')}</EmptyState>}
        </section>
      </div>
    </div>
  )
}

function Countdown({ target, live }: { target: string; live: boolean }) {
  const now = useNow()
  const { days, hours, minutes, seconds } = countdownParts(Date.parse(target) - now)
  if (live) {
    return (
      <div className="flex items-center gap-4">
        <span className="animate-pulse-dot size-4 rounded-full bg-signal shadow-[0_0_24px_var(--color-signal)]" />
        <span className="display text-6xl text-signal sm:text-8xl">{t('home.onTrack')}</span>
      </div>
    )
  }
  const parts = [
    { v: days, l: t('home.units.days') },
    { v: hours, l: t('home.units.hours') },
    { v: minutes, l: t('home.units.minutes') },
    { v: seconds, l: t('home.units.seconds') },
  ]
  return (
    <div className="flex items-end gap-3 sm:gap-6" aria-label={t('home.countdown')}>
      {parts.map((p, i) => (
        <div key={p.l} className="flex items-end gap-3 sm:gap-6">
          <div className="flex flex-col">
            <span className={clsx('display tabular-nums text-[64px] leading-none sm:text-[128px]', i === 3 ? 'text-signal' : 'text-paper')}>
              {String(p.v).padStart(2, '0')}
            </span>
            <span className="eyebrow mt-1">{p.l}</span>
          </div>
          {i < 3 && <span className="display mb-6 text-4xl text-line-2 sm:mb-10 sm:text-6xl">:</span>}
        </div>
      ))}
    </div>
  )
}

function Hero({ meeting, session, live }: { meeting: MeetingSummary; session: SessionSummary; live: boolean }) {
  return (
    <section className="panel animate-rise relative overflow-hidden">
      {/* diagonal speed lines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ background: 'repeating-linear-gradient(115deg, transparent 0 22px, var(--color-paper) 22px 23px)' }}
      />
      <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-signal/10 blur-3xl" />
      {meeting.round && (
        <span className="outline-number pointer-events-none absolute -bottom-10 right-4 text-[220px] leading-none sm:text-[340px]">
          {String(meeting.round).padStart(2, '0')}
        </span>
      )}
      <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div className="eyebrow mb-4 flex flex-wrap items-center gap-2">
            {live ? <span className="text-signal">{t('home.live')}</span> : <span>{t('home.nextSession')}</span>}
            <span className="text-dim">/</span>
            <span>{meeting.round ? t('season.round', { n: meeting.round }) : t('season.testing')}</span>
            <span className="text-dim">/</span>
            <span>{meeting.location}</span>
          </div>
          <div className="mb-2 flex items-center gap-4">
            <Flag src={meeting.countryFlag} alt={meeting.countryName} className="h-8 border border-line sm:h-10" />
            <h1 className="display min-w-0 text-5xl sm:text-7xl lg:text-8xl">{shortName(meeting.name)}</h1>
          </div>
          <div className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="display text-3xl text-signal sm:text-4xl">{sessionName(session.name)}</span>
            <span className="text-sm capitalize text-muted">{longDate(session.dateStart)}</span>
          </div>
          <Countdown target={session.dateStart} live={live} />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/session/$sessionKey"
              params={{ sessionKey: session.key }}
              className="group inline-flex items-center gap-3 bg-signal px-5 py-3 font-mono text-xs uppercase tracking-[0.16em] text-white transition-colors hover:bg-paper hover:text-ink"
            >
              {live ? t('home.followSession') : t('home.sessionPage', { session: sessionShort(session.name) })}
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              to="/gp/$meetingKey"
              params={{ meetingKey: meeting.key }}
              className="inline-flex items-center gap-3 border border-line-2 px-5 py-3 font-mono text-xs uppercase tracking-[0.16em] text-muted transition-colors hover:border-paper hover:text-paper"
            >
              {t('home.weekendSchedule')}
            </Link>
          </div>
        </div>
        {meeting.circuitImage && (
          <div className="relative hidden items-center justify-center lg:flex">
            <img src={meeting.circuitImage} alt={t('meeting.circuitAlt', { circuit: meeting.circuitName })} onError={(e) => (e.currentTarget.style.display = 'none')} className="w-full max-w-[360px] opacity-90 drop-shadow-[0_0_30px_rgba(255,59,47,0.25)]" />
            <div className="absolute bottom-0 left-0 font-mono text-[10px] uppercase tracking-widest text-dim">{meeting.circuitName}</div>
          </div>
        )}
      </div>
    </section>
  )
}

function SeasonOver({ year }: { year: number }) {
  return (
    <section className="panel animate-rise p-10">
      <div className="eyebrow mb-3">{t('season.label', { year })}</div>
      <h1 className="display text-6xl sm:text-8xl">{t('home.seasonOverTitle')}</h1>
      <p className="mt-4 max-w-lg text-sm text-muted">{t('home.seasonOverBody')}</p>
    </section>
  )
}

function SeasonStrip({ year }: { year: number }) {
  const season = useQuery(seasonQuery(year))
  const now = useNow(60_000)
  if (season.isPending) return <Skeleton className="h-24" />
  if (season.isError || !('meetings' in season.data)) return null
  const rounds = season.data.meetings.filter((m) => !m.isTesting && !m.isCancelled)
  const done = rounds.filter((m) => Date.parse(m.dateEnd) < now).length
  const currentIdx = rounds.findIndex((m) => Date.parse(m.dateEnd) >= now)
  return (
    <section className="animate-rise" style={{ animationDelay: '180ms' }}>
      <SectionTitle
        index="02"
        title={t('season.label', { year })}
        aside={
          <span className="tnum">
            <span className="text-paper">{done}</span> / {t('home.rounds', { n: rounds.length })}
          </span>
        }
      />
      <div className="flex gap-1">
        {rounds.map((m, i) => {
          const isDone = i < done
          const isCurrent = i === currentIdx
          const winner = m.sessions.find((s) => s.kind === 'race')?.podium?.[0]
          return (
            <Link
              key={m.key}
              to="/gp/$meetingKey"
              params={{ meetingKey: m.key }}
              className="group relative flex min-w-0 flex-1 flex-col gap-2"
              title={`${m.round ?? ''} · ${m.name} — ${dateRange(m.dateStart, m.dateEnd)}${winner ? ` · ${winner.acronym}` : ''}`}
            >
              <span
                className={clsx(
                  'h-10 transition-all group-hover:h-12 sm:h-14',
                  isCurrent ? 'bg-signal shadow-[0_0_18px_var(--color-signal)]' : isDone ? '' : 'bg-panel-2',
                )}
                style={isDone && winner ? { background: `linear-gradient(180deg, ${onDark(winner.teamColour)}, ${onDark(winner.teamColour)}55)` } : isDone ? { background: 'var(--color-line-2)' } : undefined}
              />
              <span className={clsx('hidden text-center font-mono text-[9px] md:block', isCurrent ? 'text-signal' : 'text-dim')}>{m.countryCode}</span>
            </Link>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 bg-gradient-to-b from-[#00D7B6] to-[#00D7B655]" /> {t('home.legendWinner')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 bg-signal" /> {t('home.legendCurrent')}
        </span>
      </div>
    </section>
  )
}

function LastRace({ meeting, session }: { meeting: MeetingSummary; session: SessionSummary }) {
  const podium = session.podium ?? []
  const order = [podium[1], podium[0], podium[2]].filter(Boolean)
  return (
    <Panel className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Flag src={meeting.countryFlag} alt={meeting.countryName} className="h-6 border border-line" />
        <div className="min-w-0">
          <div className="display truncate text-2xl">{shortName(meeting.name)}</div>
          <div className="text-xs text-muted">{dateRange(meeting.dateStart, meeting.dateEnd)}</div>
        </div>
      </div>
      {podium.length ? (
        <div className="grid grid-cols-3 items-end gap-2">
          {order.map((p) => {
            const c = onDark(p.teamColour)
            const h = p.position === 1 ? 'h-40' : p.position === 2 ? 'h-28' : 'h-20'
            return (
              <div key={p.position} className="flex min-w-0 flex-col items-center gap-2">
                <div className="min-w-0 text-center">
                  <div className={clsx('display', p.position === 1 ? 'text-4xl' : 'text-2xl')}>{p.acronym}</div>
                  <div className="truncate text-[11px] text-muted">{p.fullName}</div>
                </div>
                <div className={clsx('relative w-full', h)} style={{ background: `linear-gradient(180deg, ${c}, ${c}22)` }}>
                  <span className="display absolute left-2 top-1 text-3xl text-ink/70">{p.position}</span>
                </div>
                <div className="w-full truncate text-center font-mono text-[10px] uppercase tracking-wider text-dim">{p.teamName}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted">{t('home.resultPending')}</div>
      )}
      <Link
        to="/session/$sessionKey"
        params={{ sessionKey: session.key }}
        className="mt-6 flex items-center justify-between border-t border-line pt-4 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-signal"
      >
        {t('home.fullAnalysis')} <span>→</span>
      </Link>
    </Panel>
  )
}

function Championship({ standings }: { standings: NonNullable<HomeResponse['standings']> }) {
  const drivers = standings.drivers.slice(0, 10)
  const teams = standings.teams.slice(0, 5)
  const maxD = drivers[0]?.points || 1
  const maxT = teams[0]?.points || 1
  return (
    <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
      <Panel flat className="p-4">
        <div className="eyebrow mb-3 flex justify-between">
          <span>{t('standings.drivers')}</span>
          <span>{t('home.afterRound', { n: standings.round })}</span>
        </div>
        <ol className="space-y-1">
          {drivers.map((d, i) => (
            <li key={d.driverId} className="animate-rise grid grid-cols-[22px_1fr_auto] items-center gap-3" style={{ animationDelay: `${360 + i * 35}ms` }}>
              <span className={clsx('tnum text-xs', i === 0 ? 'text-signal' : 'text-dim')}>{d.position}</span>
              <div className="relative min-w-0 overflow-hidden py-1.5">
                <span className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${(d.points / maxD) * 100}%`, background: onDark(d.teamColour) }} />
                <span className="absolute inset-y-0 left-0 w-0.5" style={{ background: onDark(d.teamColour) }} />
                <span className="relative flex items-baseline gap-2 pl-2.5">
                  <span className="text-sm font-semibold">{d.code}</span>
                  <span className="truncate text-xs text-muted">
                    {d.givenName} {d.familyName}
                  </span>
                </span>
              </div>
              <span className="tnum text-sm">{points(d.points)}</span>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel flat className="p-4">
        <div className="eyebrow mb-3">{t('standings.teams')}</div>
        <ol className="space-y-3">
          {teams.map((t, i) => (
            <li key={t.teamId} className="animate-rise" style={{ animationDelay: `${420 + i * 50}ms` }}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm">
                  <span className="tnum mr-2 text-xs text-dim">{t.position}</span>
                  {t.name}
                </span>
                <span className="tnum text-sm">{points(t.points)}</span>
              </div>
              <div className="h-1.5 bg-panel-2">
                <div className="h-full" style={{ width: `${(t.points / maxT) * 100}%`, background: onDark(t.teamColour) }} />
              </div>
            </li>
          ))}
        </ol>
        {standings.drivers[0] && (
          <div className="mt-6 border-t border-line pt-4">
            <div className="eyebrow mb-2">{t('format.leader')}</div>
            <PodiumChips
              podium={[
                {
                  position: 1,
                  driverNumber: standings.drivers[0].number ?? 0,
                  acronym: standings.drivers[0].code,
                  fullName: `${standings.drivers[0].givenName} ${standings.drivers[0].familyName}`,
                  teamName: standings.drivers[0].teamName,
                  teamColour: standings.drivers[0].teamColour,
                },
              ]}
            />
            {standings.drivers[1] && (
              <div className="mt-2 text-xs text-muted">
                <span className="tnum text-paper">+{points(standings.drivers[0].points - standings.drivers[1].points)}</span> {t('home.ptsOver', { code: standings.drivers[1].code })}
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}
