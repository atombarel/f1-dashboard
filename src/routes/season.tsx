import type { MeetingSummary } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import clsx from 'clsx'
import { EmptyState, ErrorState, Flag, PageHeader, SectionTitle, Skeleton } from '@/components/ui'
import { shortName, useNow } from '@/features/home/shared'
import { YearSwitcher } from '@/features/home/YearSwitcher'
import { t } from '@/i18n'
import { seasonQuery } from '@/lib/api'
import { onDark } from '@/lib/colors'
import { dateRange } from '@/lib/format'

export function SeasonPage() {
  const { year } = useParams({ from: '/saison/$year' })
  const season = useQuery(seasonQuery(year))
  const now = useNow(60_000)

  const data = season.data && 'meetings' in season.data ? season.data : null
  const years = season.data?.seasons ?? [year]
  const rounds = data?.meetings.filter((m) => !m.isTesting) ?? []
  const tests = data?.meetings.filter((m) => m.isTesting) ?? []
  const nextKey = rounds.find((m) => !m.isCancelled && Date.parse(m.dateEnd) >= now)?.key
  const done = rounds.filter((m) => !m.isCancelled && Date.parse(m.dateEnd) < now).length
  const total = rounds.filter((m) => !m.isCancelled).length

  return (
    <div>
      <PageHeader
        eyebrow={<span>{t('season.calendar')}</span>}
        title={
          <>
            {t('nav.season')} <span className="text-signal">{year}</span>
          </>
        }
        aside={<YearSwitcher years={years} current={year} to="/saison/$year" />}
      >
        {data ? (
          <span className="tnum">
            {t('season.summary', { total, done, sprints: rounds.filter((m) => m.sessions.some((s) => s.kind === 'sprint')).length })}
          </span>
        ) : null}
      </PageHeader>

      {season.isPending ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : season.isError ? (
        <ErrorState error={season.error} retry={() => season.refetch()} />
      ) : !data ? (
        <EmptyState title={t('season.unavailableTitle')}>{t('season.unavailableBody', { year })}</EmptyState>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rounds.map((m, i) => (
              <RoundCard key={m.key} meeting={m} next={m.key === nextKey} past={Date.parse(m.dateEnd) < now} index={i} />
            ))}
          </div>
          {tests.length > 0 && (
            <section className="mt-14">
              <SectionTitle title={t('season.preseason')} />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {tests.map((m) => (
                  <Link
                    key={m.key}
                    to="/gp/$meetingKey"
                    params={{ meetingKey: m.key }}
                    className="flex items-center gap-3 border border-line bg-carbon p-3 transition-colors hover:border-line-2 hover:bg-panel"
                  >
                    <Flag src={m.countryFlag} alt={m.countryName} className="h-5 border border-line" />
                    <div className="min-w-0">
                      <div className="truncate text-sm">{m.name}</div>
                      <div className="text-xs text-muted">
                        {m.location} · {dateRange(m.dateStart, m.dateEnd)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function RoundCard({ meeting: m, next, past, index }: { meeting: MeetingSummary; next: boolean; past: boolean; index: number }) {
  const race = m.sessions.find((s) => s.kind === 'race')
  const winner = race?.podium?.[0]
  const sprint = m.sessions.some((s) => s.kind === 'sprint')
  const accent = winner ? onDark(winner.teamColour) : undefined
  return (
    <Link
      to="/gp/$meetingKey"
      params={{ meetingKey: m.key }}
      className={clsx(
        'group panel animate-rise relative flex min-h-52 flex-col overflow-hidden p-5 sm:min-h-64 transition-colors',
        next && 'border-signal/70',
        m.isCancelled && 'opacity-45',
        !next && 'hover:border-line-2',
      )}
      style={{ animationDelay: `${Math.min(index, 16) * 30}ms` }}
    >
      {next && <div className="absolute inset-x-0 top-0 h-0.5 bg-signal shadow-[0_0_16px_var(--color-signal)]" />}
      {accent && <div className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: accent }} />}
      {m.round && (
        <span
          className={clsx(
            'outline-number pointer-events-none absolute -right-2 -top-4 text-[120px] leading-none transition-colors',
            next && '[-webkit-text-stroke-color:var(--color-signal)]',
            'group-hover:[-webkit-text-stroke-color:var(--color-dim)]',
          )}
        >
          {String(m.round).padStart(2, '0')}
        </span>
      )}
      {m.circuitImage && (
        <img
          src={m.circuitImage}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(e) => (e.currentTarget.style.display = 'none')}
          className="pointer-events-none absolute bottom-10 right-3 w-36 opacity-25 transition-opacity duration-300 group-hover:opacity-60"
        />
      )}
      <div className="relative flex items-center gap-2">
        <Flag src={m.countryFlag} alt={m.countryName} className="h-4 border border-line" />
        <span className="eyebrow">{m.round ? t('season.round', { n: m.round }) : m.isCancelled ? t('season.cancelled') : t('season.nonChampionship')}</span>
      </div>
      <div className="relative mt-3">
        <h3 className={clsx('display text-3xl', m.isCancelled && 'line-through decoration-signal decoration-2')}>{shortName(m.name)}</h3>
        <div className="mt-1 text-xs text-muted">
          {m.location} · {dateRange(m.dateStart, m.dateEnd)}
        </div>
      </div>
      <div className="relative mt-auto flex flex-wrap items-end justify-between gap-2 pt-6">
        {m.isCancelled ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-signal">{t('season.cancelled')}</span>
        ) : winner ? (
          <div>
            <div className="eyebrow mb-1">{t('season.winner')}</div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-1" style={{ background: accent }} />
              <span className="display text-2xl">{winner.acronym}</span>
              <span className="truncate text-xs text-muted">{winner.teamName}</span>
            </div>
          </div>
        ) : next ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-signal">{t('season.nextRound')}</span>
        ) : past ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-amber">{t('season.resultPending')}</span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-dim">{t('status.upcoming')}</span>
        )}
        {sprint && <span className="border border-amber/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber">Sprint</span>}
      </div>
    </Link>
  )
}
