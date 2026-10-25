import type { Compound, LapRow, Neutralization, SessionBundle, Stint } from '@shared/types'
import type { ScaleLinear } from 'd3-scale'

export const NEUTRAL_STYLE: Record<Neutralization['type'], { fill: string; label: string; text: string }> = {
  SC: { fill: 'var(--color-amber)', label: 'Safety car', text: 'SC' },
  VSC: { fill: 'var(--color-yellow)', label: 'Virtual safety car', text: 'VSC' },
  RED: { fill: 'var(--color-signal)', label: 'Drapeau rouge', text: 'RED' },
}

/** Shaded lap bands for SC / VSC / red flag periods. `x` maps a lap number to a pixel. */
export function NeutralBands({ items, x, height, halfStep = 0.5 }: { items: Neutralization[]; x: ScaleLinear<number, number>; height: number; halfStep?: number }) {
  return (
    <g aria-hidden>
      {items.map((n, i) => {
        const s = NEUTRAL_STYLE[n.type]
        const x0 = x(n.lapStart - halfStep)
        const x1 = x(n.lapEnd + halfStep)
        return (
          <g key={i}>
            <rect x={x0} width={Math.max(2, x1 - x0)} y={0} height={height} fill={s.fill} opacity={0.08} />
            <line x1={x0} x2={x0} y1={0} y2={height} stroke={s.fill} strokeOpacity={0.4} strokeDasharray="2 3" />
            <text x={x0 + 4} y={10} className="font-mono text-[9px]" fill={s.fill} opacity={0.85}>
              {s.text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export const median = (a: number[]) => {
  if (!a.length) return NaN
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Least-squares fit y = a + b·x. */
export function linearFit(points: [number, number][]) {
  const n = points.length
  if (n < 2) return null
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (const [x, y] of points) {
    sx += x
    sy += y
    sxx += x * x
    sxy += x * y
  }
  const den = n * sxx - sx * sx
  if (den === 0) return null
  const b = (n * sxy - sx * sy) / den
  return { a: (sy - b * sx) / n, b }
}

/** Stint covering a given lap for a driver. */
export function stintAt(stints: Stint[], lap: number): Stint | undefined {
  return stints.find((s) => lap >= s.lapStart && lap <= s.lapEnd)
}

export function stintsByDriver(bundle: SessionBundle) {
  const m = new Map<number, Stint[]>()
  for (const s of bundle.stints) (m.get(s.driverNumber) ?? m.set(s.driverNumber, []).get(s.driverNumber)!).push(s)
  return m
}

/** Laps where the car came into the pit (the lap before an out-lap or a recorded stop). */
export function pitInLaps(bundle: SessionBundle, driver: number): Set<number> {
  const s = new Set<number>()
  for (const p of bundle.pits) if (p.driverNumber === driver) s.add(p.lap)
  for (const l of bundle.laps[driver] ?? []) if (l.po) s.add(l.n - 1)
  return s
}

export function neutralLaps(bundle: SessionBundle): Set<number> {
  const s = new Set<number>()
  for (const n of bundle.neutralizations) for (let l = n.lapStart; l <= n.lapEnd; l++) s.add(l)
  return s
}

/**
 * "Representative" laps: no pit in/out, not lap 1, not under neutralisation, within 107% of the driver's median
 * and 110% of their best lap.
 */
export function cleanLapFilter(bundle: SessionBundle, driver: number) {
  const laps = bundle.laps[driver] ?? []
  const pitIn = pitInLaps(bundle, driver)
  const neutral = neutralLaps(bundle)
  const times = laps.map((l) => l.t).filter((t): t is number => t !== null)
  // In practice most laps are cool-downs, so the median alone is not enough: also bound by the best lap.
  const limit = Math.min(median(times) * 1.07, Math.min(...times) * 1.1)
  return (l: LapRow) => l.t !== null && !l.po && !pitIn.has(l.n) && l.n !== 1 && !neutral.has(l.n) && l.t <= limit
}

export const compoundOf = (stints: Stint[] | undefined, lap: number): Compound => (stints ? stintAt(stints, lap)?.compound : undefined) ?? 'UNKNOWN'

export function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-carbon/95 backdrop-blur">{children}</thead>
}

export const th = 'px-1.5 sm:px-2.5 py-2 text-left font-mono text-[9px] font-normal uppercase tracking-[0.16em] text-dim whitespace-nowrap'
export const td = 'px-1.5 sm:px-2.5 py-2 whitespace-nowrap'
