import type { Compound, Driver, SessionBundle } from '@shared/types'
import clsx from 'clsx'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { useMemo, useState } from 'react'
import { AxisX, ChartFrame, GridY, Tooltip } from '@/charts/core'
import { DriverPicker } from '@/components/DriverPicker'
import { DriverTag, EmptyState, Panel, SectionTitle, Segmented, TyreBadge } from '@/components/ui'
import { onDark, teammateIndex, TYRE } from '@/lib/colors'
import { delta, lapTime } from '@/lib/format'
import { cleanLapFilter, compoundOf, linearFit, median, NeutralBands, stintsByDriver, TableHead, td, th } from './helpers'
import type { TabProps } from './types'

interface Point {
  n: number
  t: number
  compound: Compound
}

function useSeries(bundle: SessionBundle, selected: number[], hideOutliers: boolean) {
  return useMemo(() => {
    const stints = stintsByDriver(bundle)
    return selected.map((drv) => {
      const keep = hideOutliers ? cleanLapFilter(bundle, drv) : (l: { t: number | null }) => l.t !== null
      const points: Point[] = (bundle.laps[drv] ?? []).filter(keep).map((l) => ({ n: l.n, t: l.t!, compound: compoundOf(stints.get(drv), l.n) }))
      return { drv, points }
    })
  }, [bundle, selected, hideOutliers])
}

function LapChart({ bundle, drivers, series }: { bundle: SessionBundle; drivers: Map<number, Driver>; series: { drv: number; points: Point[] }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const mates = useMemo(() => teammateIndex([...drivers.values()]), [drivers])
  const all = series.flatMap((s) => s.points)
  const maxLap = Math.max(bundle.totalLaps, ...all.map((p) => p.n), 2)
  if (!all.length) return <EmptyState title="Aucun tour">Sélectionne des pilotes pour comparer leur rythme.</EmptyState>
  const times = all.map((p) => p.t)
  const lo = Math.min(...times)
  const hi = Math.max(...times)
  const pad = Math.max(0.3, (hi - lo) * 0.06)

  return (
    <ChartFrame
      height={420}
      ariaLabel="Temps au tour"
      onPointer={(p) => setHover(p ? p.x : null)}
      overlay={({ width }) => {
        if (hover === null) return null
        const x = scaleLinear().domain([1, maxLap]).range([0, width])
        const lap = Math.round(x.invert(hover))
        const rows = series
          .map((s) => ({ s, p: s.points.find((p) => p.n === lap) }))
          .filter((r): r is { s: (typeof series)[number]; p: Point } => Boolean(r.p))
          .sort((a, b) => a.p.t - b.p.t)
        if (!rows.length) return null
        return (
          <Tooltip x={x(lap)} width={width} top={8}>
            <div className="eyebrow mb-1.5">Tour {lap}</div>
            {rows.map(({ s, p }, i) => {
              const d = drivers.get(s.drv)
              return (
                <div key={s.drv} className="flex items-center justify-between gap-4 py-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-0.5" style={{ background: d ? onDark(d.teamColour) : undefined }} />
                    <span className="font-semibold">{d?.acronym ?? s.drv}</span>
                    <TyreBadge compound={p.compound} size={13} />
                  </span>
                  <span className="tnum">
                    {lapTime(p.t)}
                    {i > 0 && <span className="ml-2 text-dim">{delta(p.t - rows[0].p.t)}</span>}
                  </span>
                </div>
              )
            })}
          </Tooltip>
        )
      }}
    >
      {({ width, height }) => {
        const x = scaleLinear().domain([1, maxLap]).range([0, width])
        const y = scaleLinear().domain([lo - pad, hi + pad]).range([height, 0])
        const path = line<Point>()
          .x((p) => x(p.n))
          .y((p) => y(p.t))
          .defined((p, i, arr) => i === 0 || p.n - arr[i - 1].n <= 3)
        const hoverLap = hover !== null ? Math.round(x.invert(hover)) : null
        return (
          <>
            <NeutralBands items={bundle.neutralizations} x={x} height={height} />
            <GridY scale={y} width={width} ticks={6} format={(v) => lapTime(v, 1)} />
            <AxisX scale={x} height={height} ticks={Math.min(Math.max(4, Math.floor(width / 70)), maxLap)} label="Tour" />
            {series.map(({ drv, points }) => {
              const d = drivers.get(drv)
              const c = d ? onDark(d.teamColour) : '#888'
              return (
                <g key={drv}>
                  <path d={path(points) ?? ''} fill="none" stroke={c} strokeWidth={1.6} strokeOpacity={0.9} strokeDasharray={mates.get(drv) ? '5 3' : undefined} />
                  {points.length < 400 &&
                    points.map((p) => (
                      <circle key={p.n} cx={x(p.n)} cy={y(p.t)} r={p.n === hoverLap ? 4 : 2.2} fill={TYRE[p.compound].color} stroke="var(--color-ink)" strokeWidth={0.8} />
                    ))}
                </g>
              )
            })}
            {hoverLap !== null && <line x1={x(hoverLap)} x2={x(hoverLap)} y2={height} stroke="var(--color-paper)" strokeOpacity={0.25} />}
          </>
        )
      }}
    </ChartFrame>
  )
}

function SectorTable({ bundle, ordered }: Pick<TabProps, 'bundle' | 'ordered'>) {
  const rows = useMemo(
    () =>
      ordered
        .map((d) => {
          const laps = bundle.laps[d.number] ?? []
          const best = (k: 's1' | 's2' | 's3' | 't') => {
            const v = laps.filter((l) => !l.po).map((l) => l[k]).filter((x): x is number => x !== null && x > 0)
            return v.length ? Math.min(...v) : null
          }
          const s = [best('s1'), best('s2'), best('s3')]
          const ideal = s.every((x) => x !== null) ? (s as number[]).reduce((a, b) => a + b, 0) : null
          const top = laps.map((l) => l.st).filter((x): x is number => x !== null)
          return { d, s, ideal, best: best('t'), speed: top.length ? Math.max(...top) : null }
        })
        .filter((r) => r.best !== null),
    [bundle, ordered],
  )
  const overall = [0, 1, 2].map((i) => Math.min(...rows.map((r) => r.s[i] ?? Infinity)))
  const idealBest = Math.min(...rows.map((r) => r.ideal ?? Infinity))
  const topSpeed = Math.max(...rows.map((r) => r.speed ?? 0))
  const cls = (v: number | null, best: number) => (v === null ? 'text-dim' : v === best ? 'text-purple' : v - best < 0.12 ? 'text-green' : 'text-paper/80')

  return (
    <Panel flat className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <TableHead>
          <tr className="border-b border-line">
            <th className={th}>Pilote</th>
            <th className={clsx(th, 'text-right')}>S1</th>
            <th className={clsx(th, 'text-right')}>S2</th>
            <th className={clsx(th, 'text-right')}>S3</th>
            <th className={clsx(th, 'text-right')}>Tour idéal</th>
            <th className={clsx(th, 'text-right')}>Meilleur tour</th>
            <th className={clsx(th, 'text-right')}>Perte</th>
            <th className={clsx(th, 'text-right')}>V. max</th>
          </tr>
        </TableHead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.d.number} className="border-b border-line/60 hover:bg-panel-2">
              <td className={td}>
                <DriverTag driver={r.d} size="sm" />
              </td>
              {r.s.map((v, i) => (
                <td key={i} className={clsx(td, 'tnum text-right', cls(v, overall[i]))}>
                  {v?.toFixed(3) ?? '—'}
                </td>
              ))}
              <td className={clsx(td, 'tnum text-right', cls(r.ideal, idealBest))}>{lapTime(r.ideal)}</td>
              <td className={clsx(td, 'tnum text-right text-paper')}>{lapTime(r.best)}</td>
              <td className={clsx(td, 'tnum text-right text-muted')}>{r.ideal !== null && r.best !== null ? `+${Math.max(0, r.best - r.ideal).toFixed(3)}` : '—'}</td>
              <td className={clsx(td, 'tnum text-right', r.speed === topSpeed ? 'text-purple' : 'text-muted')}>{r.speed ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-4 border-t border-line px-3 py-2 text-[11px] text-dim">
        <span>
          <span className="text-purple">■</span> meilleur de la session
        </span>
        <span>
          <span className="text-green">■</span> à moins d’un dixième
        </span>
        <span>Perte = meilleur tour − somme des meilleurs secteurs</span>
      </div>
    </Panel>
  )
}

interface LongRun {
  d: Driver
  compound: Compound
  laps: { age: number; t: number }[]
  avg: number
  slope: number | null
}

function useLongRuns(bundle: SessionBundle, ordered: Driver[]): LongRun[] {
  return useMemo(() => {
    const stints = stintsByDriver(bundle)
    const runs: LongRun[] = []
    for (const d of ordered) {
      const laps = bundle.laps[d.number] ?? []
      const times = laps.map((l) => l.t).filter((t): t is number => t !== null)
      if (!times.length) continue
      const best = Math.min(...times)
      for (const s of stints.get(d.number) ?? []) {
        // race-pace laps only: drop cool-down / push laps, then keep the consistent core of the stint
        const inStint = laps.filter((l) => l.n > s.lapStart && l.n < s.lapEnd && l.t !== null && !l.po && l.t <= best * 1.08)
        const med = median(inStint.map((l) => l.t!))
        const clean = inStint.filter((l) => Math.abs(l.t! - med) <= med * 0.015)
        if (clean.length < 5) continue
        const pts = clean.map((l) => ({ age: s.tyreAge + (l.n - s.lapStart), t: l.t! }))
        const fit = linearFit(pts.map((p) => [p.age, p.t]))
        runs.push({ d, compound: s.compound, laps: pts, avg: pts.reduce((a, p) => a + p.t, 0) / pts.length, slope: fit?.b ?? null })
      }
    }
    return runs.sort((a, b) => a.avg - b.avg)
  }, [bundle, ordered])
}

function Spark({ run }: { run: LongRun }) {
  const w = 120
  const h = 26
  const ts = run.laps.map((l) => l.t)
  const x = scaleLinear().domain([0, run.laps.length - 1]).range([2, w - 2])
  const y = scaleLinear().domain([Math.min(...ts), Math.max(...ts) + 0.001]).range([h - 3, 3])
  const p = line<{ t: number }>()
    .x((_, i) => x(i))
    .y((l) => y(l.t))
  return (
    <svg width={w} height={h} className="block">
      <path d={p(run.laps) ?? ''} fill="none" stroke={onDark(run.d.teamColour)} strokeWidth={1.4} />
    </svg>
  )
}

function LongRuns({ bundle, ordered }: Pick<TabProps, 'bundle' | 'ordered'>) {
  const runs = useLongRuns(bundle, ordered)
  if (!runs.length) return <EmptyState title="Pas de relais long">Aucun relais d’au moins 5 tours réguliers dans cette session.</EmptyState>
  const best = runs[0].avg
  return (
    <Panel flat className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <TableHead>
          <tr className="border-b border-line">
            <th className={th}>Pilote</th>
            <th className={th}>Pneu</th>
            <th className={clsx(th, 'text-right')}>Tours</th>
            <th className={clsx(th, 'text-right')}>Rythme moyen</th>
            <th className={clsx(th, 'text-right')}>Écart</th>
            <th className={clsx(th, 'text-right')}>Dégradation</th>
            <th className={th}>Évolution</th>
          </tr>
        </TableHead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={`${r.d.number}-${i}`} className="border-b border-line/60 hover:bg-panel-2">
              <td className={td}>
                <DriverTag driver={r.d} size="sm" />
              </td>
              <td className={td}>
                <span className="flex items-center gap-2">
                  <TyreBadge compound={r.compound} size={16} />
                  <span className="text-xs text-muted">{TYRE[r.compound].label}</span>
                </span>
              </td>
              <td className={clsx(td, 'tnum text-right text-muted')}>{r.laps.length}</td>
              <td className={clsx(td, 'tnum text-right', i === 0 ? 'text-purple' : 'text-paper')}>{lapTime(r.avg)}</td>
              <td className={clsx(td, 'tnum text-right text-muted')}>{i === 0 ? '' : `+${(r.avg - best).toFixed(3)}`}</td>
              <td className={clsx(td, 'tnum text-right', r.slope !== null && r.slope > 0.08 ? 'text-signal' : r.slope !== null && r.slope < 0.02 ? 'text-green' : 'text-paper/80')}>
                {r.slope === null ? '—' : `${r.slope >= 0 ? '+' : '−'}${Math.abs(r.slope).toFixed(3)} s/tour`}
              </td>
              <td className={td}>
                <Spark run={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

export default function Laps({ bundle, drivers, ordered, selected, setSelected }: TabProps) {
  const [hideOutliers, setHide] = useState(true)
  const series = useSeries(bundle, selected, hideOutliers)
  const practice = bundle.session.kind === 'practice' || bundle.session.kind === 'testing'

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle
          index="01"
          title="Rythme tour par tour"
          aside={
            <Segmented
              value={hideOutliers ? 'clean' : 'all'}
              onChange={(v) => setHide(v === 'clean')}
              items={[
                { value: 'clean', label: 'Tours représentatifs', hint: 'Sans tours de stand, tour 1, neutralisations et tours > 107 % de la médiane' },
                { value: 'all', label: 'Tous les tours' },
              ]}
            />
          }
        />
        <DriverPicker drivers={ordered} selected={selected} onChange={setSelected} className="mb-4" />
        <Panel className="p-3 sm:p-4">
          <LapChart bundle={bundle} drivers={drivers} series={series} />
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-[11px] text-dim">
            {(['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'] as Compound[])
              .filter((c) => bundle.stints.some((s) => s.compound === c))
              .map((c) => (
                <span key={c} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: TYRE[c].color }} />
                  {TYRE[c].label}
                </span>
              ))}
            <span>Trait pointillé = second pilote de l’équipe</span>
          </div>
        </Panel>
      </section>

      <section>
        <SectionTitle index="02" title="Secteurs & tour idéal" aside="Meilleurs secteurs de chaque pilote, hors tours de sortie des stands" />
        <SectorTable bundle={bundle} ordered={ordered} />
      </section>

      {practice && (
        <section>
          <SectionTitle index="03" title="Relais longs" aside="Simulations de course : relais d’au moins 5 tours réguliers" />
          <LongRuns bundle={bundle} ordered={ordered} />
        </section>
      )}
    </div>
  )
}
