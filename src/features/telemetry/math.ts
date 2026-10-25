import type { CircuitLayout, LapTelemetry } from '@shared/types'

/** Index of the last element ≤ v in a sorted array (−1 if none). */
export function bisectRight(sorted: ArrayLike<number>, v: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] <= v) lo = mid + 1
    else hi = mid
  }
  return lo - 1
}

/** Linear interpolation of `ys` at `x` on a sorted `xs`. Clamped at both ends. */
export function interp(xs: ArrayLike<number>, ys: ArrayLike<number>, x: number): number {
  const n = xs.length
  if (!n) return NaN
  if (x <= xs[0]) return ys[0]
  if (x >= xs[n - 1]) return ys[n - 1]
  const i = bisectRight(xs, x)
  const x0 = xs[i]
  const x1 = xs[i + 1]
  const k = x1 === x0 ? 0 : (x - x0) / (x1 - x0)
  return ys[i] + (ys[i + 1] - ys[i]) * k
}

/** Nearest sample index for a distance (for discrete channels: gear, brake…). */
export function nearestAt(xs: ArrayLike<number>, x: number): number {
  const n = xs.length
  if (!n) return -1
  const i = bisectRight(xs, x)
  if (i < 0) return 0
  if (i >= n - 1) return n - 1
  return x - xs[i] <= xs[i + 1] - x ? i : i + 1
}

/**
 * A lap ready for comparison. Integrated distances differ by a few metres between drivers,
 * so every lap is rescaled onto the reference lap length: equal `d` = same place on track.
 */
export interface PreparedLap {
  raw: LapTelemetry
  /** monotonic distance, rescaled to the reference length */
  d: Float64Array
  /** seconds since lap start */
  t: Float64Array
  length: number
  lapTime: number
}

export function prepareLap(raw: LapTelemetry, referenceLength: number | null, lapTime: number | null): PreparedLap {
  const n = raw.d.length
  const own = raw.d[n - 1] || 1
  const scale = referenceLength ? referenceLength / own : 1
  const d = new Float64Array(n)
  const t = new Float64Array(n)
  let max = 0
  for (let i = 0; i < n; i++) {
    max = Math.max(max, raw.d[i])
    d[i] = max * scale
    t[i] = raw.t[i] / 1000
  }
  return { raw, d, t, length: own * scale, lapTime: lapTime ?? t[n - 1] }
}

/** Time of B minus time of A at equal distance, on a regular grid. Positive = B is behind. */
export function deltaSeries(a: PreparedLap, b: PreparedLap, step = 5) {
  const len = Math.min(a.length, b.length)
  const d: number[] = []
  const delta: number[] = []
  for (let x = 0; x <= len; x += step) {
    d.push(x)
    delta.push(interp(b.d, b.t, x) - interp(a.d, a.t, x))
  }
  return { d, delta }
}

export type SpeedClass = 'slow' | 'medium' | 'fast'

export interface MiniSector {
  index: number
  from: number
  to: number
  /** time spent in the segment */
  timeA: number
  timeB: number
  winner: 'A' | 'B'
  meanSpeed: number
  speedClass: SpeedClass
}

export function miniSectors(a: PreparedLap, b: PreparedLap, count = 25): MiniSector[] {
  const len = Math.min(a.length, b.length)
  const out: MiniSector[] = []
  for (let i = 0; i < count; i++) {
    const from = (len * i) / count
    const to = (len * (i + 1)) / count
    const timeA = interp(a.d, a.t, to) - interp(a.d, a.t, from)
    const timeB = interp(b.d, b.t, to) - interp(b.d, b.t, from)
    const meanSpeed = ((to - from) / Math.max(timeA, 1e-3)) * 3.6
    out.push({
      index: i,
      from,
      to,
      timeA,
      timeB,
      winner: timeA <= timeB ? 'A' : 'B',
      meanSpeed,
      speedClass: meanSpeed < 150 ? 'slow' : meanSpeed < 230 ? 'medium' : 'fast',
    })
  }
  return out
}

/** Distance (on lap `a`) of the point closest to every corner. */
export function cornerDistances(layout: CircuitLayout | undefined, a: PreparedLap | null) {
  if (!layout || !a) return []
  const { x, y } = a.raw
  return layout.corners.map((c) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < x.length; i++) {
      const dd = (x[i] - c.x) ** 2 + (y[i] - c.y) ** 2
      if (dd < bestD) {
        bestD = dd
        best = i
      }
    }
    return { label: `${c.number}${c.letter}`, d: a.d[best], x: c.x, y: c.y, angle: c.angle }
  })
}

export function fullThrottleShare(lap: PreparedLap): number {
  let full = 0
  for (let i = 1; i < lap.d.length; i++) if (lap.raw.th[i] >= 98) full += lap.d[i] - lap.d[i - 1]
  return full / (lap.length || 1)
}

/**
 * Rotate circuit coordinates by the MultiViewer rotation (degrees, same convention as FastF1),
 * then fit them uniformly into a box. Screen y is flipped (SVG/canvas y grows downwards).
 */
export function makeProjection(xs: ArrayLike<number>, ys: ArrayLike<number>, rotationDeg: number, width: number, height: number, padding = 24) {
  const a = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const rot = (x: number, y: number): [number, number] => [x * cos - y * sin, x * sin + y * cos]
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < xs.length; i++) {
    const [rx, ry] = rot(xs[i], ys[i])
    if (rx < minX) minX = rx
    if (rx > maxX) maxX = rx
    if (ry < minY) minY = ry
    if (ry > maxY) maxY = ry
  }
  const w = Math.max(1, width - padding * 2)
  const h = Math.max(1, height - padding * 2)
  const k = Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1))
  const ox = padding + (w - (maxX - minX) * k) / 2
  const oy = padding + (h - (maxY - minY) * k) / 2
  const project = (x: number, y: number): [number, number] => {
    const [rx, ry] = rot(x, y)
    return [ox + (rx - minX) * k, oy + (maxY - ry) * k]
  }
  /** Aspect ratio (h/w) of the rotated shape, to size containers. */
  const aspect = (maxY - minY) / (maxX - minX || 1)
  return { project, scale: k, aspect }
}

export function rotatedAspect(xs: ArrayLike<number>, ys: ArrayLike<number>, rotationDeg: number) {
  return makeProjection(xs, ys, rotationDeg, 1000, 1000, 0).aspect
}

/** Lighter variant of a colour (teammate of the same team). */
export function lighten(hex: string, amount = 0.5): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
