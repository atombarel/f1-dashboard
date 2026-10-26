import type { LapTelemetry } from '@shared/types'
import { interp } from '@/features/telemetry/math'

/**
 * A timed lap reduced to "when was the car where". Both series start on the line at 0 and end on the line
 * at the official lap time, so every ghost released at t = 0 crosses the line exactly at its lap time.
 */
export interface Ghost {
  /** seconds since the lap start, 0 … lapTime */
  t: Float64Array
  /** metres since the line, monotonic, 0 … length */
  d: Float64Array
  /** km/h, same index */
  v: Float64Array
  length: number
  lapTime: number
  /** m/s on the line, used to keep the car going after the flag */
  exitSpeed: number
}

/**
 * Telemetry samples start a few hundred ms after the line and stop just before it: the ends are completed
 * with the official lap time, and the distance is rescaled onto `referenceLength` so that equal `d` means
 * the same place on track for every driver (integrated distances differ by a few metres).
 */
export function prepareGhost(raw: LapTelemetry, lapTime: number, referenceLength: number | null): Ghost {
  const t = [0]
  const d = [0]
  const v = [raw.v[0] ?? 0]
  for (let i = 0; i < raw.t.length; i++) {
    const ts = raw.t[i] / 1000
    if (ts <= t[t.length - 1] || ts >= lapTime) continue
    t.push(ts)
    d.push(Math.max(d[d.length - 1], raw.d[i]))
    v.push(raw.v[i])
  }
  const lastV = v[v.length - 1]
  const own = d[d.length - 1] + (lastV / 3.6) * (lapTime - t[t.length - 1])
  t.push(lapTime)
  d.push(own)
  v.push(lastV)
  const scale = referenceLength ? referenceLength / own : 1
  return {
    t: Float64Array.from(t),
    d: Float64Array.from(d, (x) => x * scale),
    v: Float64Array.from(v),
    length: own * scale,
    lapTime,
    exitSpeed: Math.max(1, (lastV / 3.6) * scale),
  }
}

/** Metres covered `t` seconds after the lap start; past the line the car runs on at its exit speed. */
export function distanceAt(g: Ghost, t: number): number {
  if (t <= 0) return 0
  if (t >= g.lapTime) return g.length + g.exitSpeed * (t - g.lapTime)
  return interp(g.t, g.d, t)
}

/** Seconds needed to cover `d` metres (inverse of `distanceAt`). */
export function timeAt(g: Ghost, d: number): number {
  if (d <= 0) return 0
  if (d >= g.length) return g.lapTime + (d - g.length) / g.exitSpeed
  return interp(g.d, g.t, d)
}

export function speedAt(g: Ghost, t: number): number {
  return t >= g.lapTime ? g.exitSpeed * 3.6 : interp(g.t, g.v, Math.max(0, t))
}

/**
 * Time lost to the reference at the point where `g` is at time `t`: how long ago the reference was there.
 * Ends at the lap-time difference once `g` crosses the line.
 */
export function liveGap(ref: Ghost, g: Ghost, t: number): number {
  return t - timeAt(ref, distanceAt(g, t))
}

/** Metres between the reference and `g` at time `t` (positive: `g` is behind). */
export function metresBehind(ref: Ghost, g: Ghost, t: number): number {
  return distanceAt(ref, t) - distanceAt(g, t)
}
