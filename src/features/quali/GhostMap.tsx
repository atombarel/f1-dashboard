import { useMemo } from 'react'
import { useWidth } from '@/charts/core'
import { t } from '@/i18n'
import { makeProjection } from '@/features/telemetry/math'
import { sampleLoop, type Centerline } from './centerline'
import type { CarFrame } from './stage'

/** Whole circuit with every ghost on it; the stretch shown by the camera is lit up. */
export function GhostMap({ line, rotation, frames, window: [from, to] }: { line: Centerline; rotation: number; frames: CarFrame[]; window: [number, number] }) {
  const [ref, width] = useWidth<HTMLDivElement>()

  const geo = useMemo(() => {
    if (!width) return null
    const loop = sampleLoop(line, 6)
    const probe = makeProjection(loop.x, loop.y, rotation, 1000, 1000, 0)
    const height = Math.round(Math.min(340, Math.max(200, width * Math.min(probe.aspect, 1.1) + 24)))
    const { project } = makeProjection(loop.x, loop.y, rotation, width, height, 18)
    const outline = loop.x.map((x, i) => project(x, loop.y[i])).map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('') + 'Z'
    const start = line.at(0)
    const ahead = line.at(25)
    const [sx, sy] = project(start.x, start.y)
    const [ax, ay] = project(ahead.x, ahead.y)
    return { height, project, outline, start: { sx, sy, angle: (Math.atan2(ay - sy, ax - sx) * 180) / Math.PI } }
  }, [width, line, rotation])

  const lit = useMemo(() => {
    if (!geo) return ''
    let s = ''
    for (let d = from; d <= to; d += 4) {
      const p = line.at(d)
      const [px, py] = geo.project(p.x, p.y)
      s += `${s ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`
    }
    return s
  }, [geo, line, from, to])

  return (
    <div ref={ref} className="w-full">
      {geo && (
        <svg width={width} height={geo.height} className="block" role="img" aria-label={t('quali.mapAria')}>
          <path d={geo.outline} fill="none" stroke="var(--color-panel-2)" strokeWidth={12} strokeLinejoin="round" />
          <path d={geo.outline} fill="none" stroke="var(--color-line-2)" strokeWidth={1} strokeLinejoin="round" />
          <path d={lit} fill="none" stroke="var(--color-paper)" strokeOpacity={0.22} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
          <g transform={`translate(${geo.start.sx},${geo.start.sy}) rotate(${geo.start.angle})`}>
            <rect x={-1.5} y={-8} width={3} height={16} fill="var(--color-paper)" />
            <path d="M7 -4 L13 0 L7 4" fill="none" stroke="var(--color-paper)" strokeWidth={1.25} />
          </g>
          {[...frames]
            .sort((a, b) => b.car.rank - a.car.rank)
            .map((f) => {
              const p = line.at(f.d)
              const [px, py] = geo.project(p.x, p.y)
              const lead = f.order === 0
              return (
                <g key={f.car.driver.number} transform={`translate(${px},${py})`}>
                  <circle r={lead ? 6.5 : 5} fill={f.car.colour} stroke="var(--color-ink)" strokeWidth={2} />
                  {f.order < 3 && (
                    <text x={9} y={-7} className="fill-paper font-mono text-[9px] font-semibold" style={{ paintOrder: 'stroke', stroke: 'var(--color-ink)', strokeWidth: 3 }}>
                      {f.car.driver.acronym}
                    </text>
                  )}
                </g>
              )
            })}
        </svg>
      )}
    </div>
  )
}
