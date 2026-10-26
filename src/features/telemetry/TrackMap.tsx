import type { CircuitLayout } from '@shared/types'
import { useMemo } from 'react'
import { useWidth } from '@/charts/core'
import { t } from '@/i18n'
import { interp, makeProjection, type MiniSector, type PreparedLap } from './math'

export interface MapDriver {
  lap: PreparedLap
  colour: string
  acronym: string
  dashed?: boolean
}

/**
 * Circuit drawn from the reference lap, each mini-sector painted in the colour of whoever was quicker through it.
 * The hovered distance shows both cars on track.
 */
export function TrackMap({
  layout,
  a,
  b,
  sectors,
  corners,
  hover,
  onHoverSector,
}: {
  layout: CircuitLayout | undefined
  a: MapDriver
  b: MapDriver
  sectors: MiniSector[]
  corners: { label: string; x: number; y: number; angle: number }[]
  hover: number | null
  onHoverSector?: (d: number | null) => void
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const rotation = layout?.rotation ?? 0
  const baseX = layout?.x ?? a.lap.raw.x
  const baseY = layout?.y ?? a.lap.raw.y

  const geo = useMemo(() => {
    if (!width) return null
    const probe = makeProjection(baseX, baseY, rotation, 1000, 1000, 0)
    const height = Math.round(Math.min(560, Math.max(240, width * Math.min(probe.aspect, 1.1) + 56)))
    const { project } = makeProjection(baseX, baseY, rotation, width, height, 36)
    const pathOf = (xs: ArrayLike<number>, ys: ArrayLike<number>, from = 0, to = xs.length) => {
      let s = ''
      for (let i = from; i < to; i++) {
        const [px, py] = project(xs[i], ys[i])
        s += `${i === from ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`
      }
      return s
    }
    const outline = layout ? pathOf(layout.x, layout.y) + 'Z' : pathOf(a.lap.raw.x, a.lap.raw.y)
    const { d, raw } = a.lap
    const segs = sectors.map((s) => {
      let from = 0
      while (from < d.length - 1 && d[from + 1] < s.from) from++
      let to = from
      while (to < d.length - 1 && d[to] < s.to) to++
      return { s, path: pathOf(raw.x, raw.y, from, to + 1) }
    })
    // offset corner labels outwards along the corner's angle (≈ 55 m), like FastF1's circuit plots
    const labels = corners.map((c) => {
      const ang = (c.angle * Math.PI) / 180
      const [px, py] = project(c.x + 550 * Math.cos(ang), c.y + 550 * Math.sin(ang))
      const [cx, cy] = project(c.x, c.y)
      return { ...c, px, py, cx, cy }
    })
    // start/finish = first sample of the reference lap; arrow shows the direction of travel
    const [sx, sy] = project(raw.x[0], raw.y[0])
    const k = Math.min(8, raw.x.length - 1)
    const [nx, ny] = project(raw.x[k], raw.y[k])
    const dir = Math.atan2(ny - sy, nx - sx)
    return { height, project, outline, segs, labels, start: { sx, sy, dir } }
  }, [width, baseX, baseY, rotation, layout, a.lap, sectors, corners])

  const markers = useMemo(() => {
    if (!geo || hover === null) return []
    return [a, b].map((m) => {
      const x = interp(m.lap.d, m.lap.raw.x, hover)
      const y = interp(m.lap.d, m.lap.raw.y, hover)
      const [px, py] = geo.project(x, y)
      return { px, py, colour: m.colour, acronym: m.acronym }
    })
  }, [geo, hover, a, b])

  return (
    <div ref={ref} className="relative w-full">
      {geo && (
        <svg width={width} height={geo.height} className="block" role="img" aria-label={t('telemetry.mapAria')}>
          <defs>
            <filter id="tm-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          {/* tarmac */}
          <path d={geo.outline} fill="none" stroke="var(--color-panel-2)" strokeWidth={18} strokeLinejoin="round" strokeLinecap="round" />
          <path d={geo.outline} fill="none" stroke="var(--color-line)" strokeWidth={1} strokeLinejoin="round" />
          {/* dominance glow + line */}
          <g opacity={0.35} filter="url(#tm-glow)">
            {geo.segs.map(({ s, path }) => (
              <path key={s.index} d={path} fill="none" stroke={s.winner === 'A' ? a.colour : b.colour} strokeWidth={10} strokeLinecap="round" />
            ))}
          </g>
          {geo.segs.map(({ s, path }) => {
            const m = s.winner === 'A' ? a : b
            return (
              <g key={s.index} onPointerEnter={() => onHoverSector?.((s.from + s.to) / 2)} onPointerLeave={() => onHoverSector?.(null)} className="cursor-crosshair">
                <path d={path} fill="none" stroke="transparent" strokeWidth={22} />
                <path
                  d={path}
                  fill="none"
                  stroke={m.colour}
                  strokeWidth={5}
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  strokeDasharray={m.dashed ? '7 4' : undefined}
                />
              </g>
            )
          })}
          {/* start / finish */}
          <g transform={`translate(${geo.start.sx},${geo.start.sy}) rotate(${(geo.start.dir * 180) / Math.PI})`}>
            <rect x={-2} y={-11} width={4} height={22} fill="var(--color-paper)" />
            <rect x={-2} y={-11} width={2} height={5.5} fill="var(--color-ink)" />
            <rect x={0} y={-5.5} width={2} height={5.5} fill="var(--color-ink)" />
            <rect x={-2} y={0} width={2} height={5.5} fill="var(--color-ink)" />
            <rect x={0} y={5.5} width={2} height={5.5} fill="var(--color-ink)" />
            <path d="M10 -5 L18 0 L10 5" fill="none" stroke="var(--color-paper)" strokeWidth={1.5} />
          </g>
          {/* corners */}
          {geo.labels.map((c) => (
            <g key={c.label}>
              <line x1={c.cx} y1={c.cy} x2={c.px} y2={c.py} stroke="var(--color-line-2)" strokeWidth={0.75} />
              <circle cx={c.px} cy={c.py} r={9} fill="var(--color-ink)" stroke="var(--color-line-2)" />
              <text x={c.px} y={c.py} dy="0.35em" textAnchor="middle" className="fill-muted font-mono text-[8.5px]">
                {c.label}
              </text>
            </g>
          ))}
          {markers.map((m) => (
            <g key={m.acronym} transform={`translate(${m.px},${m.py})`}>
              <circle r={11} fill={m.colour} opacity={0.18} />
              <circle r={5.5} fill={m.colour} stroke="var(--color-ink)" strokeWidth={2} />
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}
