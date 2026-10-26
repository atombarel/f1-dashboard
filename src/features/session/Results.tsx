import { isQualiLike, isRaceLike } from '@shared/sessions'
import type { Driver, ResultRow } from '@shared/types'
import clsx from 'clsx'
import { Fragment, useMemo } from 'react'
import { DriverTag, EmptyState, Panel, Stat, TyreBadge } from '@/components/ui'
import { t } from '@/i18n'
import { onDark } from '@/lib/colors'
import { gap, lapTime, points, raceTime } from '@/lib/format'
import { stintsByDriver, TableHead, td, th } from './helpers'
import type { TabProps } from './types'

const statusLabel = (s: ResultRow['status']) => (s === 'finished' ? '' : t(`results.status.${s}`))

function PosCell({ row }: { row: ResultRow }) {
  const pos = typeof row.position === 'number' ? row.position : null
  return (
    <td className={clsx(td, 'w-8 text-right sm:w-12')}>
      {pos !== null ? (
        <span className={clsx('display tnum', pos <= 3 ? 'text-2xl text-paper' : 'text-xl text-muted')}>{pos}</span>
      ) : (
        <span className="font-mono text-[10px] uppercase text-signal">{row.status === 'finished' ? '—' : row.status.toUpperCase()}</span>
      )}
    </td>
  )
}

function DriverCell({ driver, n }: { driver?: Driver; n: number }) {
  return (
    <td className={clsx(td, 'sm:min-w-44')}>
      {driver ? <DriverTag driver={driver} showTeam /> : <span className="tnum text-muted">#{n}</span>}
    </td>
  )
}

function Summary({ bundle, drivers }: Pick<TabProps, 'bundle' | 'drivers'>) {
  const kind = bundle.session.kind
  const first = bundle.results[0]
  const winner = first ? drivers.get(first.driverNumber) : undefined
  const fl = bundle.fastestLap
  const flDriver = fl ? drivers.get(fl.driverNumber) : undefined
  const w = bundle.weather
  const avg = (k: 'air' | 'track') => (w.length ? w.reduce((s, x) => s + x[k], 0) / w.length : null)
  const rain = w.some((x) => x.rain)
  const neutral = bundle.neutralizations.reduce<Record<string, number>>((acc, n) => ({ ...acc, [n.type]: (acc[n.type] ?? 0) + 1 }), {})
  const neutralText = Object.entries(neutral).map(([type, c]) => `${c} ${type}`).join(' · ') || t('results.none')
  const leadLabel = isRaceLike(kind) ? t('results.winner') : isQualiLike(kind) ? t('results.pole') : t('results.fastest')
  const leadSub = isRaceLike(kind) ? raceTime(first?.time) : lapTime(first?.time)
  const air = avg('air')
  const track = avg('track')

  return (
    <Panel className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-5">
      <div className="col-span-2 flex items-center gap-4 sm:col-span-1">
        {winner?.headshot && (
          <img src={winner.headshot} alt="" className="h-16 w-16 shrink-0 object-cover object-top" style={{ background: `linear-gradient(180deg, ${onDark(winner.teamColour)}55, transparent)` }} />
        )}
        <Stat label={leadLabel} value={<span style={{ color: winner ? onDark(winner.teamColour) : undefined }}>{winner?.acronym ?? '—'}</span>} sub={`${winner?.fullName ?? ''} · ${leadSub}`} />
      </div>
      <Stat label={t('results.fastestLap')} value={<span className="text-purple">{lapTime(fl?.time)}</span>} sub={fl ? t('results.fastestLapSub', { driver: flDriver?.acronym ?? fl.driverNumber, lap: fl.lap }) : undefined} />
      {isRaceLike(kind) ? (
        <>
          <Stat label={t('results.overtakes')} value={bundle.overtakes.length} sub={t('results.laps', { n: bundle.totalLaps })} />
          <Stat label={t('results.neutralisations')} value={neutralText} accent={neutralText === t('results.none') ? undefined : 'var(--color-amber)'} />
        </>
      ) : (
        <>
          <Stat label={t('results.drivers')} value={bundle.results.length} sub={t('results.totalLaps', { n: Object.values(bundle.laps).reduce((s, l) => s + l.length, 0) })} />
          <Stat label={t('results.redFlags')} value={bundle.raceControl.filter((m) => m.flag === 'RED').length} />
        </>
      )}
      <Stat
        label={t('results.weather')}
        value={air !== null && track !== null ? `${air.toFixed(0)}° / ${track.toFixed(0)}°` : '—'}
        sub={rain ? t('results.rain') : t('results.dry')}
        accent={rain ? 'var(--color-wet)' : undefined}
      />
    </Panel>
  )
}

function RaceTable({ bundle, drivers }: Pick<TabProps, 'bundle' | 'drivers'>) {
  const stints = useMemo(() => stintsByDriver(bundle), [bundle])
  const pits = useMemo(() => {
    const m = new Map<number, number>()
    for (const p of bundle.pits) m.set(p.driverNumber, (m.get(p.driverNumber) ?? 0) + 1)
    return m
  }, [bundle])
  const fastest = bundle.fastestLap?.driverNumber
  return (
    <table className="w-full border-collapse text-sm">
      <TableHead>
        <tr className="border-b border-line">
          <th className={clsx(th, 'text-right')}>{t('results.col.pos')}</th>
          <th className={th}>{t('results.col.driver')}</th>
          <th className={clsx(th, 'hidden text-right sm:table-cell')}>{t('results.col.grid')}</th>
          <th className={clsx(th, 'hidden text-right md:table-cell')}>{t('results.col.laps')}</th>
          <th className={clsx(th, 'text-right')}>{t('results.col.timeGap')}</th>
          <th className={clsx(th, 'hidden text-right md:table-cell')}>{t('results.col.bestLap')}</th>
          <th className={clsx(th, 'hidden text-center lg:table-cell')}>{t('results.col.stops')}</th>
          <th className={clsx(th, 'hidden sm:table-cell')}>{t('results.col.tyres')}</th>
          <th className={clsx(th, 'text-right')}>{t('results.col.points')}</th>
        </tr>
      </TableHead>
      <tbody>
        {bundle.results.map((r, i) => {
          const d = drivers.get(r.driverNumber)
          const pos = typeof r.position === 'number' ? r.position : null
          const gained = r.grid && pos ? r.grid - pos : null
          const out = r.status !== 'finished'
          return (
            <tr key={r.driverNumber} className={clsx('group border-b border-line/60 transition-colors hover:bg-panel-2', out && 'opacity-60')} style={{ animationDelay: `${i * 18}ms` }}>
              <PosCell row={r} />
              <DriverCell driver={d} n={r.driverNumber} />
              <td className={clsx(td, 'hidden text-right sm:table-cell')}>
                <span className="tnum text-muted">{r.grid ?? '—'}</span>
                {gained !== null && gained !== 0 && (
                  <span className={clsx('tnum ml-1.5 text-[11px]', gained > 0 ? 'text-green' : 'text-signal')}>
                    {gained > 0 ? '▲' : '▼'}
                    {Math.abs(gained)}
                  </span>
                )}
              </td>
              <td className={clsx(td, 'tnum hidden text-right text-muted md:table-cell')}>{r.laps ?? '—'}</td>
              <td className={clsx(td, 'tnum text-right')}>
                {out ? (
                  <span className="font-mono text-[11px] uppercase text-signal" title={r.statusText ?? undefined}>
                    {statusLabel(r.status)}
                    {r.statusText && r.statusText !== 'Retired' && r.statusText !== 'Finished' ? ` · ${r.statusText}` : ''}
                  </span>
                ) : i === 0 ? (
                  <span className="text-paper">{raceTime(r.time)}</span>
                ) : r.gap === null && r.statusText && r.statusText !== 'Finished' ? (
                  <span className="font-mono text-[11px] uppercase text-amber" title={r.statusText}>
                    {r.statusText === 'Retired' ? t('results.retiredClassified') : r.statusText}
                  </span>
                ) : (
                  <span className="text-paper/85">{gap(r.gap)}</span>
                )}
              </td>
              <td className={clsx(td, 'tnum hidden text-right md:table-cell', r.driverNumber === fastest ? 'text-purple' : 'text-muted')}>
                {r.driverNumber === fastest && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-purple align-middle" />}
                {lapTime(r.bestLap)}
              </td>
              <td className={clsx(td, 'tnum hidden text-center text-muted lg:table-cell')}>{pits.get(r.driverNumber) ?? 0}</td>
              <td className={clsx(td, 'hidden sm:table-cell')}>
                <span className="flex items-center gap-0.5">
                  {(stints.get(r.driverNumber) ?? []).map((s) => (
                    <span key={s.stint} className="flex items-center">
                      <TyreBadge compound={s.compound} size={16} age={s.tyreAge} />
                      <span className="tnum ml-0.5 mr-1 text-[9px] text-dim">{s.lapEnd - s.lapStart + 1}</span>
                    </span>
                  ))}
                </span>
              </td>
              <td className={clsx(td, 'tnum text-right', r.points ? 'text-paper' : 'text-dim')}>{points(r.points)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function QualiTable({ bundle, drivers }: Pick<TabProps, 'bundle' | 'drivers'>) {
  const bestPerSegment = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const v = bundle.results.map((r) => r.q?.[i]).filter((x): x is number => typeof x === 'number')
        return v.length ? Math.min(...v) : null
      }),
    [bundle],
  )
  const pole = bundle.results[0]?.q?.findLast((x) => typeof x === 'number') ?? bundle.results[0]?.time ?? null
  // Elimination separators: first row knocked out in Q1 / Q2.
  const segOf = (r: ResultRow) => (r.q?.[2] != null ? 3 : r.q?.[1] != null ? 2 : r.q?.[0] != null ? 1 : 0)
  const segName = [t('results.seg.noTime'), t('results.seg.outQ1'), t('results.seg.outQ2'), t('results.seg.q3')]
  return (
    <table className="w-full border-collapse text-sm max-sm:[&_span.truncate]:hidden">
      <TableHead>
        <tr className="border-b border-line">
          <th className={clsx(th, 'text-right')}>{t('results.col.pos')}</th>
          <th className={th}>{t('results.col.driver')}</th>
          {['Q1', 'Q2', 'Q3'].map((q) => (
            <th key={q} className={clsx(th, 'text-right')}>
              {q}
            </th>
          ))}
          <th className={clsx(th, 'hidden text-right sm:table-cell')}>{t('results.col.gap')}</th>
          <th className={clsx(th, 'hidden text-right sm:table-cell')}>{t('results.col.laps')}</th>
        </tr>
      </TableHead>
      <tbody>
        {bundle.results.map((r, i) => {
          const d = drivers.get(r.driverNumber)
          const seg = segOf(r)
          const prevSeg = i > 0 ? segOf(bundle.results[i - 1]) : seg
          const best = r.q?.findLast((x) => typeof x === 'number') ?? null
          return (
            <Fragment key={r.driverNumber}>
              {seg !== prevSeg && (
                <tr>
                  <td colSpan={7} className="px-2.5 pb-1 pt-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-signal">{segName[seg]}</span>
                      <span className="h-px flex-1 bg-gradient-to-r from-signal/50 to-transparent" />
                    </div>
                  </td>
                </tr>
              )}
              <tr className="border-b border-line/60 transition-colors hover:bg-panel-2">
                <PosCell row={r} />
                <DriverCell driver={d} n={r.driverNumber} />
                {[0, 1, 2].map((q) => {
                  const t = r.q?.[q] ?? null
                  return (
                    <td key={q} className={clsx(td, 'tnum text-right text-[11px] sm:text-sm', t === null ? 'text-dim' : t === bestPerSegment[q] ? 'text-purple' : 'text-paper/85')}>
                      {lapTime(t)}
                    </td>
                  )
                })}
                <td className={clsx(td, 'tnum hidden text-right text-muted sm:table-cell')} title={seg ? t('results.qualiGapTitle', { seg }) : undefined}>
                  {i === 0 || best === null || !seg ? '' : `+${(best - (seg === 3 ? (pole ?? best) : (bestPerSegment[seg - 1] ?? best))).toFixed(3)}`}
                </td>
                <td className={clsx(td, 'tnum hidden text-right text-muted sm:table-cell')}>{r.laps ?? bundle.laps[r.driverNumber]?.length ?? '—'}</td>
              </tr>
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function PracticeTable({ bundle, drivers }: Pick<TabProps, 'bundle' | 'drivers'>) {
  const best = bundle.results[0]?.time ?? null
  const worst = Math.max(...bundle.results.map((r) => r.time ?? 0))
  return (
    <table className="w-full border-collapse text-sm">
      <TableHead>
        <tr className="border-b border-line">
          <th className={clsx(th, 'text-right')}>{t('results.col.pos')}</th>
          <th className={th}>{t('results.col.driver')}</th>
          <th className={clsx(th, 'text-right')}>{t('results.col.bestLap')}</th>
          <th className={clsx(th, 'text-right')}>{t('results.col.gap')}</th>
          <th className={clsx(th, 'hidden w-1/4 md:table-cell')} />
          <th className={clsx(th, 'text-right')}>{t('results.col.laps')}</th>
        </tr>
      </TableHead>
      <tbody>
        {bundle.results.map((r, i) => {
          const d = drivers.get(r.driverNumber)
          const g = best !== null && r.time !== null ? r.time - best : null
          const span = best !== null ? worst - best : 0
          return (
            <tr key={r.driverNumber} className="border-b border-line/60 transition-colors hover:bg-panel-2">
              <PosCell row={r} />
              <DriverCell driver={d} n={r.driverNumber} />
              <td className={clsx(td, 'tnum text-right', i === 0 ? 'text-purple' : 'text-paper/85')}>{lapTime(r.time)}</td>
              <td className={clsx(td, 'tnum text-right text-muted')}>{i === 0 ? '' : g !== null ? `+${g.toFixed(3)}` : gap(r.gap)}</td>
              <td className={clsx(td, 'hidden md:table-cell')}>
                {g !== null && span > 0 && (
                  <div className="h-1.5 bg-line/50">
                    <div className="h-full" style={{ width: `${Math.max(2, (1 - g / span) * 100)}%`, background: d ? onDark(d.teamColour) : 'var(--color-muted)', opacity: 0.85 }} />
                  </div>
                )}
              </td>
              <td className={clsx(td, 'tnum text-right text-muted')}>{r.laps ?? '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function Results({ bundle, drivers }: TabProps) {
  const kind = bundle.session.kind
  if (!bundle.results.length) return <EmptyState title={t('results.emptyTitle')}>{t('results.emptyBody')}</EmptyState>
  return (
    <div>
      <Summary bundle={bundle} drivers={drivers} />
      <Panel flat className="overflow-x-auto">
        {isRaceLike(kind) ? (
          <RaceTable bundle={bundle} drivers={drivers} />
        ) : isQualiLike(kind) && bundle.results.some((r) => r.q) ? (
          <QualiTable bundle={bundle} drivers={drivers} />
        ) : (
          <PracticeTable bundle={bundle} drivers={drivers} />
        )}
      </Panel>
    </div>
  )
}
