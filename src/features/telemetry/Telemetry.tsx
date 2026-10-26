import type { Driver, LapRow, Stint } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { scaleLinear, type ScaleLinear } from 'd3-scale'
import { area, curveMonotoneX, curveStepAfter, line } from 'd3-shape'
import { useMemo, useState, type ReactNode } from 'react'
import { ChartFrame, useWidth, type Margin } from '@/charts/core'
import { DriverPicker } from '@/components/DriverPicker'
import { EmptyState, Panel, SectionTitle, StartLights, TyreBadge } from '@/components/ui'
import { t } from '@/i18n'
import { circuitQuery, telemetryQuery } from '@/lib/api'
import { onDark, TYRE } from '@/lib/colors'
import { lapTime } from '@/lib/format'
import { sessionRoute } from '@/router'
import type { TabProps } from '@/features/session/types'
import {
  cornerDistances,
  deltaSeries,
  fullThrottleShare,
  interp,
  lighten,
  miniSectors,
  nearestAt,
  prepareLap,
  type MiniSector,
  type PreparedLap,
} from './math'
import { TelemetryPending, useRequestTelemetry } from './pending'
import { TrackMap } from './TrackMap'

const MARGIN: Margin = { top: 10, right: 14, bottom: 6, left: 48 }
/** dark outline so in-chart labels stay readable over the traces */
const HALO = { paintOrder: 'stroke', stroke: 'var(--color-carbon)', strokeWidth: 4, strokeLinejoin: 'round' } as const

interface Side {
  key: 'A' | 'B'
  driver: Driver
  colour: string
  dashed: boolean
}

function compoundAt(stints: Stint[], driver: number, lap: number) {
  return stints.find((s) => s.driverNumber === driver && lap >= s.lapStart && lap <= s.lapEnd)
}

function parseLapsParam(v: string | undefined): Record<number, number> {
  const out: Record<number, number> = {}
  for (const part of (v ?? '').split(',')) {
    const [d, l] = part.split(':').map(Number)
    if (Number.isFinite(d) && Number.isFinite(l)) out[d] = l
  }
  return out
}

export default function Telemetry({ meta, bundle, ordered, selected, setSelected }: TabProps) {
  const search = sessionRoute.useSearch()
  const navigate = sessionRoute.useNavigate()

  // A/B: the shared selection if it has two drivers, otherwise the top of the classification
  const pair = useMemo(() => {
    const valid = selected.filter((n) => ordered.some((d) => d.number === n))
    const a = valid[0] ?? ordered[0]?.number
    const b = valid[1] ?? ordered.find((d) => d.number !== a)?.number
    return [a, b].filter((x): x is number => x !== undefined)
  }, [selected, ordered])

  useRequestTelemetry(meta, pair[0])

  const telA = useQuery({ ...telemetryQuery(meta.telemetryUrl ?? '', pair[0]), enabled: Boolean(meta.telemetryUrl && pair[0] !== undefined) })
  const telB = useQuery({ ...telemetryQuery(meta.telemetryUrl ?? '', pair[1]), enabled: Boolean(meta.telemetryUrl && pair[1] !== undefined) })
  const layout = useQuery({ ...circuitQuery(meta.circuitUrl ?? ''), enabled: Boolean(meta.circuitUrl) })

  const lapParam = parseLapsParam(search.laps)
  const setLap = (driver: number, lap: number) => {
    const next = { ...lapParam, [driver]: lap }
    const value = pair.filter((d) => next[d] !== undefined).map((d) => `${d}:${next[d]}`).join(',')
    void navigate({ search: (s) => ({ ...s, laps: value || undefined }), replace: true, resetScroll: false })
  }

  const driverByNumber = useMemo(() => new Map(bundle.drivers.map((d) => [d.number, d])), [bundle.drivers])

  if (!meta.telemetryUrl) return <TelemetryPending />
  if (pair.length < 2) return <EmptyState title={t('telemetry.notEnoughDrivers')}>{t('telemetry.notEnoughDriversBody')}</EmptyState>

  const dA = driverByNumber.get(pair[0])!
  const dB = driverByNumber.get(pair[1])!
  const sameTeam = dA.teamName === dB.teamName
  const sides: [Side, Side] = [
    { key: 'A', driver: dA, colour: onDark(dA.teamColour), dashed: false },
    { key: 'B', driver: dB, colour: sameTeam ? lighten(onDark(dB.teamColour), 0.5) : onDark(dB.teamColour), dashed: sameTeam },
  ]

  return (
    <div className="space-y-6">
      <Panel className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="eyebrow">{t('telemetry.compareTitle')}</div>
          <div className="text-[11px] text-dim">{t('telemetry.compareHint')}</div>
        </div>
        <DriverPicker drivers={ordered} selected={pair} onChange={(n) => n.length && setSelected(n)} max={2} />
      </Panel>

      {telA.isPending || telB.isPending ? (
        <StartLights label={t('telemetry.loading')} />
      ) : telA.isError || telB.isError ? (
        <EmptyState title={t('telemetry.unavailable')}>
          {((telA.error ?? telB.error) as Error)?.message === 'no telemetry for this driver'
            ? t('telemetry.noCarData')
            : ((telA.error ?? telB.error) as Error)?.message}
        </EmptyState>
      ) : (
        <Comparison
          sides={sides}
          telA={telA.data.laps}
          telB={telB.data.laps}
          lapsA={bundle.laps[pair[0]] ?? []}
          lapsB={bundle.laps[pair[1]] ?? []}
          stints={bundle.stints}
          lapParam={lapParam}
          setLap={setLap}
          layout={layout.data}
          sessionFastest={bundle.fastestLap?.time ?? null}
        />
      )}
    </div>
  )
}

function fastestWithTelemetry(laps: LapRow[], tel: Record<number, unknown>): number | undefined {
  let best: LapRow | undefined
  for (const l of laps) if (l.t !== null && tel[l.n] && (!best || l.t < best.t!)) best = l
  return best?.n
}

function Comparison({
  sides,
  telA,
  telB,
  lapsA,
  lapsB,
  stints,
  lapParam,
  setLap,
  layout,
  sessionFastest,
}: {
  sides: [Side, Side]
  telA: Record<number, import('@shared/types').LapTelemetry>
  telB: Record<number, import('@shared/types').LapTelemetry>
  lapsA: LapRow[]
  lapsB: LapRow[]
  stints: Stint[]
  lapParam: Record<number, number>
  setLap: (driver: number, lap: number) => void
  layout: import('@shared/types').CircuitLayout | undefined
  sessionFastest: number | null
}) {
  const [A, B] = sides
  const lapNA = lapParam[A.driver.number] && telA[lapParam[A.driver.number]] ? lapParam[A.driver.number] : fastestWithTelemetry(lapsA, telA)
  const lapNB = lapParam[B.driver.number] && telB[lapParam[B.driver.number]] ? lapParam[B.driver.number] : fastestWithTelemetry(lapsB, telB)
  const [hover, setHover] = useState<number | null>(null)

  const prepared = useMemo(() => {
    if (lapNA === undefined || lapNB === undefined) return null
    const ta = lapsA.find((l) => l.n === lapNA)?.t ?? null
    const tb = lapsB.find((l) => l.n === lapNB)?.t ?? null
    const a = prepareLap(telA[lapNA], null, ta)
    const b = prepareLap(telB[lapNB], a.length, tb)
    return { a, b, delta: deltaSeries(a, b), sectors: miniSectors(a, b) }
  }, [lapNA, lapNB, telA, telB, lapsA, lapsB])

  const corners = useMemo(() => cornerDistances(layout, prepared?.a ?? null), [layout, prepared])

  if (!prepared) return <EmptyState title={t('telemetry.noUsableLap')}>{t('telemetry.noUsableLapBody')}</EmptyState>
  const { a, b } = prepared

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <LapCard side={A} laps={lapsA} tel={telA} lapN={lapNA!} stints={stints} onLap={(n) => setLap(A.driver.number, n)} sessionFastest={sessionFastest} prepared={a} />
        <LapCard side={B} laps={lapsB} tel={telB} lapN={lapNB!} stints={stints} onLap={(n) => setLap(B.driver.number, n)} sessionFastest={sessionFastest} prepared={b} />
      </div>

      <Verdict sides={sides} a={a} b={b} sectors={prepared.sectors} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <SectionTitle index="T1" title={t('telemetry.dominance')} aside={t('telemetry.miniSectorsCount', { n: prepared.sectors.length })} />
            <Panel className="p-2">
              <TrackMap
                layout={layout}
                a={{ lap: a, colour: A.colour, acronym: A.driver.acronym }}
                b={{ lap: b, colour: B.colour, acronym: B.driver.acronym, dashed: B.dashed }}
                sectors={prepared.sectors}
                corners={corners}
                hover={hover}
                onHoverSector={setHover}
              />
              <div className="flex flex-wrap items-center justify-center gap-5 px-3 pb-3 pt-1 text-xs text-muted">
                {sides.map((s) => (
                  <span key={s.key} className="flex items-center gap-2">
                    <svg width="22" height="6" aria-hidden>
                      <line x1="0" x2="22" y1="3" y2="3" stroke={s.colour} strokeWidth="4" strokeDasharray={s.dashed ? '6 3' : undefined} />
                    </svg>
                    {t('telemetry.faster', { driver: s.driver.acronym })}
                  </span>
                ))}
              </div>
            </Panel>
          </div>
        </div>
        <div className="lg:col-span-7">
          <SectionTitle index="T2" title={t('telemetry.telemetry')} aside={t('telemetry.distanceHint')} />
          <Panel className="px-1 py-3 sm:px-2">
            <Channels sides={sides} a={a} b={b} delta={prepared.delta} corners={corners} hover={hover} setHover={setHover} />
          </Panel>
        </div>
      </div>
    </>
  )
}

function LapCard({
  side,
  laps,
  tel,
  lapN,
  stints,
  onLap,
  sessionFastest,
  prepared,
}: {
  side: Side
  laps: LapRow[]
  tel: Record<number, unknown>
  lapN: number
  stints: Stint[]
  onLap: (n: number) => void
  sessionFastest: number | null
  prepared: PreparedLap
}) {
  const available = laps.filter((l) => tel[l.n] && l.t !== null)
  const personalBest = Math.min(...available.map((l) => l.t!))
  const lap = laps.find((l) => l.n === lapN)
  const stint = compoundAt(stints, side.driver.number, lapN)
  const topSpeed = Math.max(...prepared.raw.v)
  return (
    <div className="panel relative overflow-hidden p-4 sm:p-5">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: side.colour }} />
      <span className="outline-number pointer-events-none absolute -right-2 -top-6 text-[120px] leading-none opacity-60">{side.driver.number}</span>
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1 flex items-center gap-2">
            <span className="tnum flex size-4 items-center justify-center text-[9px] text-ink" style={{ background: side.colour }}>
              {side.key}
            </span>
            {side.driver.teamName}
          </div>
          <div className="display truncate text-4xl">{side.driver.fullName || side.driver.acronym}</div>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="block">
          <span className="eyebrow mb-1 block">{t('telemetry.lap')}</span>
          <select
            value={lapN}
            onChange={(e) => onLap(Number(e.target.value))}
            className="tnum border border-line-2 bg-ink px-2 py-1.5 text-sm text-paper outline-none focus:border-signal"
          >
            {available.map((l) => {
              const c = compoundAt(stints, side.driver.number, l.n)
              const tag = l.t === sessionFastest ? ` ◆ ${t('telemetry.tagBest')}` : l.t === personalBest ? ` ● ${t('telemetry.tagPersonal')}` : ''
              return (
                <option key={l.n} value={l.n}>
                  {`${t('telemetry.lapShort', { n: String(l.n).padStart(2, '0') })}  ${lapTime(l.t)}  ${c ? TYRE[c.compound].short : ''}${l.po ? `  ${t('telemetry.outLap')}` : ''}${tag}`}
                </option>
              )
            })}
          </select>
        </label>
        <div>
          <div className="eyebrow mb-1">{t('telemetry.time')}</div>
          <div className={clsx('tnum text-2xl', lap?.t === sessionFastest ? 'text-purple' : lap?.t === personalBest ? 'text-green' : 'text-paper')}>{lapTime(lap?.t)}</div>
        </div>
        <div>
          <div className="eyebrow mb-1">{t('telemetry.tyre')}</div>
          <div className="flex h-8 items-center gap-2 text-sm">
            {stint ? (
              <>
                <TyreBadge compound={stint.compound} size={22} />
                <span className="tnum text-xs text-muted">{t('telemetry.tyreAge', { n: stint.tyreAge + (lapN - stint.lapStart) })}</span>
              </>
            ) : (
              <span className="text-dim">—</span>
            )}
          </div>
        </div>
        <div>
          <div className="eyebrow mb-1">{t('telemetry.topSpeed')}</div>
          <div className="tnum text-2xl text-paper">
            {topSpeed}
            <span className="ml-1 text-xs text-dim">km/h</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Verdict({ sides, a, b, sectors }: { sides: [Side, Side]; a: PreparedLap; b: PreparedLap; sectors: MiniSector[] }) {
  const [A, B] = sides
  const gap = b.lapTime - a.lapTime
  const winsA = sectors.filter((s) => s.winner === 'A').length
  const byClass = (['slow', 'medium', 'fast'] as const).map((c) => {
    const segs = sectors.filter((s) => s.speedClass === c)
    const gain = segs.reduce((acc, s) => acc + (s.timeB - s.timeA), 0) // >0: A gains
    return { c, gain, n: segs.length }
  })
  const faster = gap >= 0 ? A : B
  return (
    <div className="panel-flat grid grid-cols-2 divide-line border-l-2 lg:grid-cols-4 lg:divide-x" style={{ borderLeftColor: faster.colour }}>
      <Cell label={t('telemetry.lapGap')}>
        <span style={{ color: faster.colour }}>{faster.driver.acronym}</span> <span className="text-paper">{Math.abs(gap).toFixed(3)} s</span>
        <div className="mt-1 text-[11px] text-muted">
          {Math.abs(gap) < 0.0005 ? t('telemetry.level') : t('telemetry.fasterThan', { driver: (faster.key === 'A' ? B : A).driver.acronym })}
        </div>
      </Cell>
      <Cell label={t('telemetry.miniSectors')}>
        <span style={{ color: A.colour }}>{winsA}</span>
        <span className="text-dim"> – </span>
        <span style={{ color: B.colour }}>{sectors.length - winsA}</span>
        <div className="mt-1 text-[11px] text-muted">
          {A.driver.acronym} / {B.driver.acronym}
        </div>
      </Cell>
      <Cell label={t('telemetry.fullThrottle')}>
        <span style={{ color: A.colour }}>{Math.round(fullThrottleShare(a) * 100)}%</span>
        <span className="text-dim"> · </span>
        <span style={{ color: B.colour }}>{Math.round(fullThrottleShare(b) * 100)}%</span>
        <div className="mt-1 text-[11px] text-muted">{t('telemetry.ofLapDistance')}</div>
      </Cell>
      <Cell label={t('telemetry.whereGap')} className="col-span-2 lg:col-span-1">
        <ul className="space-y-0.5 font-sans text-xs">
          {byClass
            .filter((x) => x.n > 0)
            .map((x) => {
              const s = x.gain >= 0 ? A : B
              return (
                <li key={x.c} className="flex items-baseline justify-between gap-2">
                  <span className="text-muted">{t(`telemetry.speedClass.${x.c}`)}</span>
                  <span className="tnum">
                    <span style={{ color: s.colour }}>{s.driver.acronym}</span> <span className="text-paper">{Math.abs(x.gain).toFixed(3)}</span>
                  </span>
                </li>
              )
            })}
        </ul>
      </Cell>
    </div>
  )
}

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('border-b border-line p-4 lg:border-b-0', className)}>
      <div className="eyebrow mb-2">{label}</div>
      <div className="tnum text-lg">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Stacked channels

type ChannelKey = 'v' | 'th' | 'br' | 'g' | 'rpm'

// label and unit: telemetry.channels.<key> / telemetry.units.<key>
const CHANNELS: { key: ChannelKey; height: number; step?: boolean; domain?: [number, number]; ticks: number }[] = [
  { key: 'v', height: 210, ticks: 5 },
  { key: 'th', height: 86, domain: [0, 100], ticks: 2 },
  { key: 'br', height: 46, step: true, domain: [0, 1], ticks: 1 },
  { key: 'g', height: 86, step: true, domain: [1, 8], ticks: 4 },
  { key: 'rpm', height: 86, ticks: 3 },
]

function Channels({
  sides,
  a,
  b,
  delta,
  corners,
  hover,
  setHover,
}: {
  sides: [Side, Side]
  a: PreparedLap
  b: PreparedLap
  delta: { d: number[]; delta: number[] }
  corners: { label: string; d: number }[]
  hover: number | null
  setHover: (d: number | null) => void
}) {
  const [ref, outer] = useWidth<HTMLDivElement>()
  const inner = Math.max(0, outer - MARGIN.left - MARGIN.right)
  const x = useMemo(() => scaleLinear().domain([0, a.length]).range([0, inner]), [a.length, inner])
  const onPointer = (p: { x: number } | null) => setHover(p ? Math.max(0, Math.min(a.length, x.invert(p.x))) : null)
  const laps = [a, b]

  const readout = hover === null ? null : laps.map((l) => {
    const i = nearestAt(l.d, hover)
    return { v: Math.round(interp(l.d, l.raw.v, hover)), th: Math.round(interp(l.d, l.raw.th, hover)), br: l.raw.br[i], g: l.raw.g[i], rpm: Math.round(interp(l.d, l.raw.rpm, hover) / 10) * 10 }
  })
  const hoverDelta = hover === null ? null : interp(delta.d, delta.delta, hover)

  return (
    <div ref={ref}>
      {outer > 0 && (
        <>
          <DistanceAxis x={x} corners={corners} />
          {CHANNELS.slice(0, 1).map((c) => (
            <Channel key={c.key} c={c} x={x} sides={sides} laps={laps} corners={corners} hover={hover} onPointer={onPointer} readout={readout} />
          ))}
          <DeltaChart x={x} sides={sides} delta={delta} corners={corners} hover={hover} hoverDelta={hoverDelta} onPointer={onPointer} />
          {CHANNELS.slice(1).map((c) => (
            <Channel key={c.key} c={c} x={x} sides={sides} laps={laps} corners={corners} hover={hover} onPointer={onPointer} readout={readout} />
          ))}
        </>
      )}
    </div>
  )
}

function DistanceAxis({ x, corners }: { x: ScaleLinear<number, number>; corners: { label: string; d: number }[] }) {
  const ticks = x.ticks(Math.max(2, Math.floor(x.range()[1] / 90)))
  // corners closer than a badge width go on a second row
  const rows = useMemo(() => {
    const last = [-Infinity, -Infinity]
    return [...corners]
      .sort((p, q) => p.d - q.d)
      .map((c) => {
        const px = x(c.d)
        const row = px - last[0] >= 19 ? 0 : px - last[1] >= 19 ? 1 : 0
        last[row] = px
        return { ...c, px, row }
      })
  }, [corners, x])
  const twoRows = rows.some((r) => r.row === 1)
  return (
    <svg width={x.range()[1] + MARGIN.left + MARGIN.right} height={twoRows ? 44 : 30} className="block overflow-visible">
      <g transform={`translate(${MARGIN.left},0)`}>
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={10} textAnchor="middle" className="fill-dim font-mono text-[9px]">
            {t === 0 ? '0' : `${(t / 1000).toFixed(t % 1000 ? 1 : 0)} km`}
          </text>
        ))}
        {rows.map((c) => (
          <g key={c.label} transform={`translate(${c.px},${22 + c.row * 14})`}>
            <rect x={-8} y={-6} width={16} height={12} fill="var(--color-ink)" stroke="var(--color-line-2)" />
            <text dy="0.35em" textAnchor="middle" className="fill-muted font-mono text-[8px]">
              {c.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}

function CornerLines({ x, corners, height }: { x: ScaleLinear<number, number>; corners: { label: string; d: number }[]; height: number }) {
  return (
    <g>
      {corners.map((c) => (
        <line key={c.label} x1={x(c.d)} x2={x(c.d)} y1={0} y2={height} stroke="var(--color-line)" strokeWidth={1} />
      ))}
    </g>
  )
}

function HoverLine({ x, hover, height }: { x: ScaleLinear<number, number>; hover: number | null; height: number }) {
  if (hover === null) return null
  return <line x1={x(hover)} x2={x(hover)} y1={-MARGIN.top} y2={height + MARGIN.bottom} stroke="var(--color-paper)" strokeOpacity={0.5} strokeWidth={1} />
}

function Channel({
  c,
  x,
  sides,
  laps,
  corners,
  hover,
  onPointer,
  readout,
}: {
  c: (typeof CHANNELS)[number]
  x: ScaleLinear<number, number>
  sides: [Side, Side]
  laps: PreparedLap[]
  corners: { label: string; d: number }[]
  hover: number | null
  onPointer: (p: { x: number } | null) => void
  readout: Record<ChannelKey, number>[] | null
}) {
  const innerH = c.height - MARGIN.top - MARGIN.bottom
  const label = t(`telemetry.channels.${c.key}`)
  const unit = t(`telemetry.units.${c.key}`)
  const y = useMemo(() => {
    let dom = c.domain
    if (!dom) {
      const all = laps.flatMap((l) => l.raw[c.key])
      const lo = Math.min(...all)
      const hi = Math.max(...all)
      const pad = (hi - lo) * 0.06
      dom = [c.key === 'v' ? Math.max(0, lo - pad) : lo - pad, hi + pad]
    }
    return scaleLinear().domain(dom).range([innerH, 0]).nice(c.ticks)
  }, [c, laps, innerH])

  const paths = useMemo(
    () =>
      laps.map((l) =>
        line<number>()
          .x((_, i) => x(l.d[i]))
          .y((v) => y(v))
          .curve(c.step ? curveStepAfter : curveMonotoneX)(l.raw[c.key]) ?? '',
      ),
    [laps, x, y, c],
  )

  return (
    <div className="relative border-t border-line/60 first:border-t-0">
      <ChartFrame
        height={c.height}
        margin={MARGIN}
        onPointer={onPointer}
        ariaLabel={label}
        overlay={({ width }) =>
          hover !== null && readout && c.key === 'v' ? (
            <div className="absolute top-1 flex gap-3" style={x(hover) > width * 0.6 ? { right: width - x(hover) + 10 } : { left: x(hover) + 10 }}>
              <div className="border border-line-2 bg-ink/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
                <div className="eyebrow mb-1.5">{Math.round(hover)} m</div>
                <table className="tnum">
                  <tbody>
                    {sides.map((s, i) => (
                      <tr key={s.key}>
                        <td className="pr-2" style={{ color: s.colour }}>
                          {s.driver.acronym}
                        </td>
                        <td className="pr-2 text-right text-paper">{readout[i].v}</td>
                        <td className="pr-2 text-right text-muted">{readout[i].th}%</td>
                        <td className="pr-2 text-right">{readout[i].br ? <span className="text-signal">{t('telemetry.brake')}</span> : <span className="text-dim">—</span>}</td>
                        <td className="text-right text-muted">{t('telemetry.gearShort', { n: readout[i].g })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null
        }
      >
        {({ width, height }) => (
          <>
            <CornerLines x={x} corners={corners} height={height} />
            {y.ticks(c.ticks).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={width} stroke="var(--color-line)" strokeDasharray="2 4" />
                <text x={-8} dy="0.32em" textAnchor="end" className="fill-dim font-mono text-[9px]">
                  {c.key === 'br' ? (t ? 'ON' : '') : c.key === 'rpm' ? `${Math.round(t / 1000)}k` : t}
                </text>
              </g>
            ))}
            {paths.map((p, i) => (
              <path
                key={sides[i].key}
                d={p}
                fill="none"
                stroke={sides[i].colour}
                strokeWidth={c.key === 'v' ? 1.75 : 1.4}
                strokeDasharray={sides[i].dashed ? '5 3' : undefined}
                strokeLinejoin="round"
                opacity={i === 1 ? 0.95 : 1}
              />
            ))}
            <text x={6} y={10} className="fill-muted font-mono text-[9px] uppercase tracking-[0.16em]" style={HALO}>
              {label}
              {unit && <tspan className="fill-dim"> · {unit}</tspan>}
            </text>
            <HoverLine x={x} hover={hover} height={height} />
            {hover !== null &&
              !c.step &&
              laps.map((l, i) => (
                <circle key={i} cx={x(hover)} cy={y(interp(l.d, l.raw[c.key], hover))} r={3} fill={sides[i].colour} stroke="var(--color-ink)" strokeWidth={1.5} />
              ))}
          </>
        )}
      </ChartFrame>
    </div>
  )
}

function DeltaChart({
  x,
  sides,
  delta,
  corners,
  hover,
  hoverDelta,
  onPointer,
}: {
  x: ScaleLinear<number, number>
  sides: [Side, Side]
  delta: { d: number[]; delta: number[] }
  corners: { label: string; d: number }[]
  hover: number | null
  hoverDelta: number | null
  onPointer: (p: { x: number } | null) => void
}) {
  const height = 120
  const innerH = height - MARGIN.top - MARGIN.bottom
  const [A, B] = sides
  const y = useMemo(() => {
    const m = Math.max(0.05, ...delta.delta.map(Math.abs)) * 1.15
    return scaleLinear().domain([-m, m]).range([innerH, 0]).nice(4)
  }, [delta, innerH])
  const shapes = useMemo(() => {
    const pts = delta.d.map((d, i) => [d, delta.delta[i]] as const)
    const pos = area<readonly [number, number]>()
      .x((p) => x(p[0]))
      .y0(y(0))
      .y1((p) => y(Math.max(0, p[1])))
      .curve(curveMonotoneX)(pts)
    const neg = area<readonly [number, number]>()
      .x((p) => x(p[0]))
      .y0(y(0))
      .y1((p) => y(Math.min(0, p[1])))
      .curve(curveMonotoneX)(pts)
    const ln = line<readonly [number, number]>()
      .x((p) => x(p[0]))
      .y((p) => y(p[1]))
      .curve(curveMonotoneX)(pts)
    return { pos: pos ?? '', neg: neg ?? '', ln: ln ?? '' }
  }, [delta, x, y])

  return (
    <div className="relative border-t border-line/60">
      <ChartFrame
        height={height}
        margin={MARGIN}
        onPointer={onPointer}
        ariaLabel={t('telemetry.cumulativeGap')}
        overlay={({ width }) =>
          hover !== null && hoverDelta !== null ? (
            <div
              className="tnum absolute top-1 border border-line-2 bg-ink/95 px-2 py-1 text-xs"
              style={x(hover) > width * 0.6 ? { right: width - x(hover) + 10 } : { left: x(hover) + 10 }}
            >
              <span style={{ color: hoverDelta >= 0 ? A.colour : B.colour }}>{hoverDelta >= 0 ? A.driver.acronym : B.driver.acronym}</span>{' '}
              <span className="text-paper">{Math.abs(hoverDelta).toFixed(3)} s</span>
            </div>
          ) : null
        }
      >
        {({ width, height: h }) => (
          <>
            <CornerLines x={x} corners={corners} height={h} />
            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={width} stroke={t === 0 ? 'var(--color-line-2)' : 'var(--color-line)'} strokeDasharray={t === 0 ? undefined : '2 4'} />
                <text x={-8} dy="0.32em" textAnchor="end" className="fill-dim font-mono text-[9px]">
                  {t === 0 ? '0' : `${t > 0 ? '+' : '−'}${Math.abs(t).toFixed(2)}`}
                </text>
              </g>
            ))}
            {/* above zero: B is behind → A is ahead */}
            <path d={shapes.pos} fill={A.colour} opacity={0.22} />
            <path d={shapes.neg} fill={B.colour} opacity={0.22} />
            <path d={shapes.ln} fill="none" stroke="var(--color-paper)" strokeWidth={1.25} />
            <text x={6} y={10} className="fill-muted font-mono text-[9px] uppercase tracking-[0.16em]" style={HALO}>
              {t('telemetry.cumulativeGap')} · s
            </text>
            <text x={width - 6} y={10} textAnchor="end" className="font-mono text-[9px] uppercase tracking-[0.12em]" fill={A.colour}>
              ▲ {t('telemetry.ahead', { driver: A.driver.acronym })}
            </text>
            <text x={width - 6} y={h - 4} textAnchor="end" className="font-mono text-[9px] uppercase tracking-[0.12em]" fill={B.colour}>
              ▼ {t('telemetry.ahead', { driver: B.driver.acronym })}
            </text>
            <HoverLine x={x} hover={hover} height={h} />
            {hover !== null && hoverDelta !== null && <circle cx={x(hover)} cy={y(hoverDelta)} r={3} fill="var(--color-paper)" />}
          </>
        )}
      </ChartFrame>
    </div>
  )
}
