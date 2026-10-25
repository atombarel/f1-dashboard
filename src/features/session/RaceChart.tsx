import type { Driver, SessionBundle } from '@shared/types'
import clsx from 'clsx'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { useMemo, useState } from 'react'
import { AxisX, ChartFrame, GridY, Tooltip } from '@/charts/core'
import { DriverPicker } from '@/components/DriverPicker'
import { EmptyState, Panel, SectionTitle } from '@/components/ui'
import { onDark, teammateIndex } from '@/lib/colors'
import { NeutralBands } from './helpers'
import type { TabProps } from './types'

/** [grid, P after lap 1, …] — null where the car was not running. */
function positionSeries(bundle: SessionBundle, drv: number): (number | null)[] {
  const grid = bundle.results.find((r) => r.driverNumber === drv)?.grid ?? null
  return [grid, ...(bundle.positions[drv] ?? [])]
}

function BumpChart({ bundle, ordered, selected, toggle }: { bundle: SessionBundle; ordered: Driver[]; selected: number[]; toggle: (n: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const series = useMemo(
    () =>
      ordered.map((d) => {
        const r = bundle.results.find((x) => x.driverNumber === d.number)
        return { d, pos: positionSeries(bundle, d.number), out: Boolean(r && r.status !== 'finished' && r.status !== 'nc'), final: typeof r?.position === 'number' ? r.position : null }
      }),
    [bundle, ordered],
  )
  const n = Math.max(ordered.length, ...series.flatMap((s) => s.pos.filter((p): p is number => p !== null)))
  const rowH = 22
  const margin = { top: 12, right: 64, bottom: 28, left: 64 }
  const focus = hover !== null ? [hover] : selected
  const anyFocus = focus.length > 0

  return (
    <ChartFrame height={n * rowH + margin.top + margin.bottom} margin={margin} ariaLabel="Positions tour par tour">
      {({ width, height }) => {
        const x = scaleLinear().domain([0, bundle.totalLaps]).range([0, width])
        const y = scaleLinear().domain([1, n]).range([rowH / 2, height - rowH / 2])
        const path = line<[number, number | null]>()
          .defined((p) => p[1] !== null)
          .x((p) => x(p[0]))
          .y((p) => y(p[1]!))
        // draw focused lines last so they sit on top
        const sorted = [...series].sort((a, b) => Number(focus.includes(a.d.number)) - Number(focus.includes(b.d.number)))
        return (
          <>
            <NeutralBands items={bundle.neutralizations} x={x} height={height} />
            {Array.from({ length: n }, (_, i) => (
              <line key={i} x2={width} y1={y(i + 1)} y2={y(i + 1)} stroke="var(--color-line)" strokeOpacity={0.5} strokeDasharray="1 5" />
            ))}
            <AxisX scale={x} height={height} ticks={Math.min(12, bundle.totalLaps)} format={(v) => (v === 0 ? 'Grille' : String(v))} label="Tour" />
            {sorted.map(({ d, pos, out }) => {
              const on = focus.includes(d.number)
              const c = onDark(d.teamColour)
              const pts = pos.map((p, i) => [i, p] as [number, number | null])
              const lastIdx = pos.findLastIndex((p) => p !== null)
              const dnf = out && lastIdx >= 0
              return (
                <g key={d.number} onPointerEnter={() => setHover(d.number)} onPointerLeave={() => setHover(null)} onClick={() => toggle(d.number)} className="cursor-pointer">
                  <path d={path(pts) ?? ''} fill="none" stroke="transparent" strokeWidth={10} />
                  <path
                    d={path(pts) ?? ''}
                    fill="none"
                    stroke={c}
                    strokeWidth={on ? 2.6 : 1.4}
                    strokeOpacity={!anyFocus ? 0.75 : on ? 1 : 0.13}
                    strokeLinejoin="round"
                    className="transition-[stroke-opacity] duration-200"
                  />
                  {dnf && <text x={x(lastIdx) + 4} y={y(pos[lastIdx]!)} dy="0.32em" className="font-mono text-[9px]" fill="var(--color-signal)" opacity={!anyFocus || on ? 1 : 0.3}>✕</text>}
                </g>
              )
            })}
            {/* end labels */}
            {series.map(({ d, pos, out, final }) => {
              const on = focus.includes(d.number)
              const op = !anyFocus || on ? 1 : 0.35
              const start = pos[0]
              const end = out ? null : final
              return (
                <g key={`l${d.number}`} className="cursor-pointer" onClick={() => toggle(d.number)} onPointerEnter={() => setHover(d.number)} onPointerLeave={() => setHover(null)} opacity={op}>
                  {start !== null && (
                    <text x={-10} y={y(start)} dy="0.32em" textAnchor="end" className="font-mono text-[10px]" fill="var(--color-paper)">
                      <tspan fill="var(--color-dim)">{start} </tspan>
                      {d.acronym}
                    </text>
                  )}
                  {end !== null && (
                    <text x={width + 10} y={y(end)} dy="0.32em" className="font-mono text-[10px]" fill={onDark(d.teamColour)} fontWeight={on ? 700 : 400}>
                      {d.acronym}
                      <tspan fill="var(--color-dim)"> {end}</tspan>
                    </text>
                  )}
                </g>
              )
            })}
          </>
        )
      }}
    </ChartFrame>
  )
}

function GapChart({ bundle, drivers, selected }: { bundle: SessionBundle; drivers: Map<number, Driver>; selected: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const mates = useMemo(() => teammateIndex([...drivers.values()]), [drivers])
  const series = useMemo(() => selected.map((drv) => ({ drv, gaps: bundle.gaps[drv] ?? [] })), [bundle, selected])
  const values = series.flatMap((s) => s.gaps.filter((g): g is number => g !== null))
  if (!values.length) return <EmptyState title="Aucun pilote">Sélectionne des pilotes pour suivre leur écart avec le leader.</EmptyState>
  // lapped cars blow the scale up: cap around one lap so the battle stays readable
  const cap = Math.max(5, Math.min(Math.max(...values), 110))

  return (
    <ChartFrame
      height={340}
      ariaLabel="Écart au leader"
      onPointer={(p) => setHover(p ? p.x : null)}
      overlay={({ width }) => {
        if (hover === null) return null
        const x = scaleLinear().domain([1, bundle.totalLaps]).range([0, width])
        const lap = Math.max(1, Math.min(bundle.totalLaps, Math.round(x.invert(hover))))
        const rows = series
          .map((s) => ({ drv: s.drv, g: s.gaps[lap - 1], p: bundle.positions[s.drv]?.[lap - 1] }))
          .filter((r): r is { drv: number; g: number; p: number | null } => r.g !== null && r.g !== undefined)
          .sort((a, b) => a.g - b.g)
        if (!rows.length) return null
        return (
          <Tooltip x={x(lap)} width={width} top={8}>
            <div className="eyebrow mb-1.5">Tour {lap}</div>
            {rows.map((r) => {
              const d = drivers.get(r.drv)
              return (
                <div key={r.drv} className="flex justify-between gap-4 py-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="tnum w-5 text-dim">P{r.p}</span>
                    <span className="h-3 w-0.5" style={{ background: d ? onDark(d.teamColour) : undefined }} />
                    <span className="font-semibold">{d?.acronym}</span>
                  </span>
                  <span className="tnum">{r.g === 0 ? 'Leader' : `+${r.g.toFixed(1)}s`}</span>
                </div>
              )
            })}
          </Tooltip>
        )
      }}
    >
      {({ width, height }) => {
        const x = scaleLinear().domain([1, bundle.totalLaps]).range([0, width])
        const y = scaleLinear().domain([0, cap]).range([0, height]).nice()
        const path = line<number | null>()
          .defined((g) => g !== null)
          .x((_, i) => x(i + 1))
          .y((g) => y(Math.min(g!, cap)))
        const hoverLap = hover !== null ? Math.round(x.invert(hover)) : null
        return (
          <>
            <NeutralBands items={bundle.neutralizations} x={x} height={height} />
            <GridY scale={y} width={width} ticks={6} format={(v) => (v === 0 ? 'Leader' : `+${v}s`)} />
            <AxisX scale={x} height={height} ticks={Math.max(4, Math.floor(width / 70))} label="Tour" />
            {series.map(({ drv, gaps }) => {
              const d = drivers.get(drv)
              return (
                <path
                  key={drv}
                  d={path(gaps) ?? ''}
                  fill="none"
                  stroke={d ? onDark(d.teamColour) : '#888'}
                  strokeWidth={1.8}
                  strokeDasharray={mates.get(drv) ? '5 3' : undefined}
                />
              )
            })}
            {hoverLap !== null && <line x1={x(hoverLap)} x2={x(hoverLap)} y2={height} stroke="var(--color-paper)" strokeOpacity={0.25} />}
          </>
        )
      }}
    </ChartFrame>
  )
}

function Overtakes({ bundle, ordered }: Pick<TabProps, 'bundle' | 'ordered'>) {
  const stats = useMemo(() => {
    const made = new Map<number, number>()
    const lost = new Map<number, number>()
    for (const o of bundle.overtakes) {
      made.set(o.by, (made.get(o.by) ?? 0) + 1)
      lost.set(o.on, (lost.get(o.on) ?? 0) + 1)
    }
    return ordered
      .map((d) => ({ d, made: made.get(d.number) ?? 0, lost: lost.get(d.number) ?? 0 }))
      .sort((a, b) => b.made - a.made || a.lost - b.lost)
  }, [bundle, ordered])
  const max = Math.max(1, ...stats.map((s) => Math.max(s.made, s.lost)))
  if (!bundle.overtakes.length) return <EmptyState title="Aucun dépassement enregistré" />
  return (
    <Panel flat className="p-4">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] gap-3 font-mono text-[9px] uppercase tracking-[0.16em] text-dim">
        <span className="text-right">Subis</span>
        <span className="w-12" />
        <span>Réalisés</span>
      </div>
      <div className="space-y-1">
        {stats.map(({ d, made, lost }) => (
          <div key={d.number} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center justify-end gap-2">
              <span className="tnum text-[11px] text-dim">{lost || ''}</span>
              <div className="h-2.5 bg-signal/70" style={{ width: `${(lost / max) * 100}%` }} />
            </div>
            <div className="w-12 text-center font-mono text-[11px]" style={{ color: onDark(d.teamColour) }}>
              {d.acronym}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5" style={{ width: `${(made / max) * 100}%`, background: onDark(d.teamColour) }} />
              <span className="tnum text-[11px] text-paper/80">{made || ''}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-dim">Dépassements en piste détectés par la F1, y compris pendant les cycles d’arrêts.</p>
    </Panel>
  )
}

export default function RaceChart({ bundle, drivers, ordered, selected, setSelected }: TabProps) {
  const toggle = (n: number) => setSelected(selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n])
  if (!bundle.totalLaps || !Object.keys(bundle.positions).length) return <EmptyState title="Pas de données de course" />
  return (
    <div className="space-y-10">
      <section>
        <SectionTitle index="01" title="Positions tour par tour" aside="Survole ou clique une ligne pour la mettre en avant" />
        <Panel className="p-3 sm:p-4">
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <div className={clsx('min-w-[640px]')}>
              <BumpChart bundle={bundle} ordered={ordered} selected={selected} toggle={toggle} />
            </div>
          </div>
        </Panel>
      </section>

      <section>
        <SectionTitle index="02" title="Écart au leader" aside="Écart à la ligne à la fin de chaque tour" />
        <DriverPicker drivers={ordered} selected={selected} onChange={setSelected} className="mb-4" />
        <Panel className="p-3 sm:p-4">
          <GapChart bundle={bundle} drivers={drivers} selected={selected} />
        </Panel>
      </section>

      <section>
        <SectionTitle index="03" title="Dépassements" aside={`${bundle.overtakes.length} au total`} />
        <Overtakes bundle={bundle} ordered={ordered} />
      </section>
    </div>
  )
}
