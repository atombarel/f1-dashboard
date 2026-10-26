import type { Compound, Driver, SessionBundle } from '@shared/types'
import clsx from 'clsx'
import { scaleLinear } from 'd3-scale'
import { useMemo, useState } from 'react'
import { AxisX, ChartFrame, GridY, Tooltip } from '@/charts/core'
import { DriverTag, EmptyState, Panel, SectionTitle, Segmented, TyreBadge } from '@/components/ui'
import { t } from '@/i18n'
import { tyreLabel } from '@/i18n/helpers'
import { onDark, TYRE } from '@/lib/colors'
import { lapTime } from '@/lib/format'
import { cleanLapFilter, linearFit, stintsByDriver, TableHead, td, th } from './helpers'
import type { TabProps } from './types'

function StintTimeline({ bundle, ordered }: Pick<TabProps, 'bundle' | 'ordered'>) {
  const stints = useMemo(() => stintsByDriver(bundle), [bundle])
  const pits = useMemo(() => {
    const m = new Map<string, (typeof bundle.pits)[number]>()
    for (const p of bundle.pits) m.set(`${p.driverNumber}:${p.lap}`, p)
    return m
  }, [bundle])
  const maxLap = Math.max(bundle.totalLaps, ...bundle.stints.map((s) => s.lapEnd), 1)
  const rows = ordered.filter((d) => stints.has(d.number))
  const ticks = scaleLinear().domain([0, maxLap]).ticks(Math.min(10, maxLap))
  if (!rows.length) return <EmptyState title={t('strategy.noTyreData')} />

  return (
    <Panel className="p-3 sm:p-5">
      <div className="grid grid-cols-[72px_1fr] gap-x-3 sm:grid-cols-[110px_1fr]">
        <div />
        <div className="relative mb-2 h-4">
          {ticks.map((t, i) => (
            <span key={t} className={clsx('tnum absolute -translate-x-1/2 text-[9px] text-dim', i % 2 && 'max-sm:hidden')} style={{ left: `${(t / maxLap) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        {rows.map((d, i) => (
          <div key={d.number} className="contents">
            <div className="flex h-7 items-center">
              <DriverTag driver={d} size="sm" />
            </div>
            <div className="relative h-7 border-b border-line/40" style={{ animation: `rise .5s ${i * 20}ms both` }}>
              {ticks.map((t) => (
                <span key={t} className="absolute inset-y-0 w-px bg-line/40" style={{ left: `${(t / maxLap) * 100}%` }} />
              ))}
              {(stints.get(d.number) ?? []).map((s) => {
                const left = ((s.lapStart - 1) / maxLap) * 100
                const width = ((s.lapEnd - s.lapStart + 1) / maxLap) * 100
                const used = s.tyreAge > 0
                const pit = pits.get(`${d.number}:${s.lapEnd}`)
                const color = TYRE[s.compound].color
                return (
                  <div
                    key={s.stint}
                    className="group absolute top-1 flex h-5 items-center overflow-hidden px-1.5"
                    style={{
                      left: `${left}%`,
                      width: `calc(${width}% - 2px)`,
                      background: used ? `repeating-linear-gradient(135deg, transparent 0 7px, rgb(0 0 0 / 0.28) 7px 9px), ${color}` : color,
                    }}
                    title={`${tyreLabel(s.compound)} (${used ? t('strategy.used', { count: s.tyreAge }) : t('strategy.new')}) · ${t('strategy.lapRange', { a: s.lapStart, b: s.lapEnd })}${pit ? ` · ${t('strategy.pitLane', { s: pit.lane?.toFixed(1) ?? '?' })}` : ''}`}
                  >
                    <span className="tnum whitespace-nowrap text-[10px] font-semibold text-ink/80">
                      {width > 7 ? `${TYRE[s.compound].short} ${s.lapEnd - s.lapStart + 1}` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-3 text-[11px] text-dim">
        {(['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'] as Compound[])
          .filter((c) => bundle.stints.some((s) => s.compound === c))
          .map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <TyreBadge compound={c} size={14} /> {tyreLabel(c)}
            </span>
          ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5" style={{ background: 'repeating-linear-gradient(135deg, transparent 0 4px, rgb(0 0 0 / 0.35) 4px 6px), var(--color-muted)' }} /> {t('strategy.usedTyre')}
        </span>
      </div>
    </Panel>
  )
}

function PitTable({ bundle, drivers }: Pick<TabProps, 'bundle' | 'drivers'>) {
  const stints = useMemo(() => stintsByDriver(bundle), [bundle])
  const hasStop = bundle.pits.some((p) => p.stop !== null)
  const rows = useMemo(
    () =>
      [...bundle.pits]
        .filter((p) => (hasStop ? p.stop : p.lane) !== null)
        .sort((a, b) => (hasStop ? (a.stop ?? 99) - (b.stop ?? 99) : (a.lane ?? 99) - (b.lane ?? 99))),
    [bundle, hasStop],
  )
  if (!rows.length) return <EmptyState title={t('strategy.noPitStops')} />
  const best = hasStop ? rows[0].stop! : rows[0].lane!
  const worst = Math.max(...rows.map((r) => (hasStop ? r.stop! : r.lane!)))
  return (
    <Panel flat className="max-h-[560px] overflow-auto">
      <table className="w-full border-collapse text-sm">
        <TableHead>
          <tr className="border-b border-line">
            <th className={clsx(th, 'text-right')}>#</th>
            <th className={th}>{t('strategy.driver')}</th>
            <th className={clsx(th, 'text-right')}>{t('strategy.lap')}</th>
            {hasStop && <th className={clsx(th, 'text-right')}>{t('strategy.stationary')}</th>}
            <th className={clsx(th, 'text-right')}>{t('strategy.pitLaneCol')}</th>
            <th className={th}>{t('strategy.change')}</th>
            <th className={clsx(th, 'hidden w-1/4 sm:table-cell')} />
          </tr>
        </TableHead>
        <tbody>
          {rows.map((p, i) => {
            const d = drivers.get(p.driverNumber)
            const list = stints.get(p.driverNumber) ?? []
            const before = list.find((s) => s.lapEnd === p.lap) ?? list.find((s) => p.lap >= s.lapStart && p.lap <= s.lapEnd)
            const after = list.find((s) => s.lapStart === p.lap + 1)
            const v = hasStop ? p.stop! : p.lane!
            return (
              <tr key={`${p.driverNumber}-${p.lap}`} className="border-b border-line/60 hover:bg-panel-2">
                <td className={clsx(td, 'tnum text-right text-dim')}>{i + 1}</td>
                <td className={td}>{d ? <DriverTag driver={d} size="sm" /> : p.driverNumber}</td>
                <td className={clsx(td, 'tnum text-right text-muted')}>{p.lap}</td>
                {hasStop && <td className={clsx(td, 'tnum text-right', i === 0 ? 'text-purple' : 'text-paper')}>{p.stop?.toFixed(1) ?? '—'} s</td>}
                <td className={clsx(td, 'tnum text-right', !hasStop && i === 0 ? 'text-purple' : 'text-muted')}>{p.lane?.toFixed(1) ?? '—'} s</td>
                <td className={td}>
                  <span className="flex items-center gap-1 text-dim">
                    {before && <TyreBadge compound={before.compound} size={15} />}
                    {after && (
                      <>
                        → <TyreBadge compound={after.compound} size={15} />
                      </>
                    )}
                  </span>
                </td>
                <td className={clsx(td, 'hidden sm:table-cell')}>
                  <div className="h-1.5 bg-line/40">
                    <div className={clsx('h-full', i === 0 ? 'bg-purple' : 'bg-paper/40')} style={{ width: `${worst > best ? 15 + (1 - (v - best) / (worst - best)) * 85 : 100}%` }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}

interface DegPoint {
  age: number
  t: number
  drv: number
  compound: Compound
}

function Degradation({ bundle, drivers }: { bundle: SessionBundle; drivers: Map<number, Driver> }) {
  const [hover, setHover] = useState<DegPoint | null>(null)
  const points = useMemo(() => {
    const out: DegPoint[] = []
    for (const s of bundle.stints) {
      const keep = cleanLapFilter(bundle, s.driverNumber)
      for (const l of bundle.laps[s.driverNumber] ?? [])
        if (l.n >= s.lapStart && l.n <= s.lapEnd && keep(l)) out.push({ age: s.tyreAge + (l.n - s.lapStart), t: l.t!, drv: s.driverNumber, compound: s.compound })
    }
    return out
  }, [bundle])
  const compounds = [...new Set(points.map((p) => p.compound))].filter((c) => c !== 'UNKNOWN')
  const [only, setOnly] = useState<Compound | 'ALL'>('ALL')
  const shown = only === 'ALL' ? points : points.filter((p) => p.compound === only)
  const fits = useMemo(
    () =>
      compounds.map((c) => {
        const pts = points.filter((p) => p.compound === c)
        return { c, fit: linearFit(pts.map((p) => [p.age, p.t])), n: pts.length, maxAge: Math.max(...pts.map((p) => p.age)), minAge: Math.min(...pts.map((p) => p.age)) }
      }),
    [points],
  )
  if (points.length < 10) return <EmptyState title={t('strategy.notEnoughLaps')} />
  const ts = points.map((p) => p.t)
  const lo = Math.min(...ts)
  const hi = Math.max(...ts)
  const maxAge = Math.max(...points.map((p) => p.age), 1)

  return (
    <Panel className="p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={only}
          onChange={setOnly}
          items={[{ value: 'ALL' as const, label: t('strategy.all') }, ...compounds.map((c) => ({ value: c, label: tyreLabel(c) }))]}
        />
        <div className="flex flex-wrap gap-4 text-xs">
          {fits.map(({ c, fit, n }) =>
            fit ? (
              <span key={c} className="flex items-center gap-1.5">
                <TyreBadge compound={c} size={14} />
                <span className="tnum" style={{ color: TYRE[c].color }}>
                  {fit.b >= 0 ? '+' : '−'}
                  {Math.abs(fit.b).toFixed(3)} {t('strategy.perLap')}
                </span>
                <span className="text-dim">({n})</span>
              </span>
            ) : null,
          )}
        </div>
      </div>
      <ChartFrame
        height={360}
        ariaLabel={t('strategy.lapTimeByAge')}
        overlay={({ width, height }) => {
          if (!hover) return null
          const x = scaleLinear().domain([0, maxAge]).range([0, width])
          const d = drivers.get(hover.drv)
          void height
          return (
            <Tooltip x={x(hover.age)} width={width} top={8}>
              <div className="flex items-center gap-2">
                <TyreBadge compound={hover.compound} size={14} />
                <span className="font-semibold" style={{ color: d ? onDark(d.teamColour) : undefined }}>
                  {d?.acronym}
                </span>
                <span className="tnum">{lapTime(hover.t)}</span>
              </div>
              <div className="mt-1 text-dim">{t('strategy.tyreAge', { count: hover.age })}</div>
            </Tooltip>
          )
        }}
      >
        {({ width, height }) => {
          const x = scaleLinear().domain([0, maxAge]).range([0, width])
          const y = scaleLinear().domain([lo - 0.2, hi + 0.2]).range([height, 0]).nice()
          return (
            <>
              <GridY scale={y} width={width} ticks={6} format={(v) => lapTime(v, 1)} />
              <AxisX scale={x} height={height} ticks={Math.max(4, Math.floor(width / 60))} label={t('strategy.tyreAgeAxis')} />
              {shown.map((p, i) => (
                <circle
                  key={i}
                  cx={x(p.age)}
                  cy={y(p.t)}
                  r={hover === p ? 4.5 : 2.4}
                  fill={TYRE[p.compound].color}
                  fillOpacity={0.55}
                  onPointerEnter={() => setHover(p)}
                  onPointerLeave={() => setHover(null)}
                />
              ))}
              {fits
                .filter((f) => f.fit && (only === 'ALL' || only === f.c))
                .map(({ c, fit, minAge, maxAge: ma }) => (
                  <line key={c} x1={x(minAge)} x2={x(ma)} y1={y(fit!.a + fit!.b * minAge)} y2={y(fit!.a + fit!.b * ma)} stroke={TYRE[c].color} strokeWidth={2.2} />
                ))}
            </>
          )
        }}
      </ChartFrame>
      <p className="mt-2 text-[11px] text-dim">
        {t('strategy.degradationNote')}
      </p>
    </Panel>
  )
}

export default function Strategy({ bundle, drivers, ordered }: TabProps) {
  const totalStops = bundle.pits.length
  return (
    <div className="space-y-10">
      <section>
        <SectionTitle index="01" title={t('strategy.stintsTitle')} aside={`${t('strategy.stints', { count: bundle.stints.length })} · ${t('strategy.stops', { count: totalStops })}`} />
        <StintTimeline bundle={bundle} ordered={ordered} />
      </section>
      <div className="grid gap-10 xl:grid-cols-2">
        <section className="min-w-0">
          <SectionTitle index="02" title={t('strategy.pitStopsTitle')} aside={bundle.pits.some((p) => p.stop !== null) ? t('strategy.sortedByStop') : t('strategy.sortedByLane')} />
          <PitTable bundle={bundle} drivers={drivers} />
        </section>
        <section className="min-w-0">
          <SectionTitle index="03" title={t('strategy.degradation')} aside={t('strategy.lapTimeByAge')} />
          <Degradation bundle={bundle} drivers={drivers} />
        </section>
      </div>
    </div>
  )
}
