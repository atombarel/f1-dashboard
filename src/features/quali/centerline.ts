import type { CircuitLayout, LapTelemetry } from '@shared/types'
import { bisectRight } from '@/features/telemetry/math'

export interface Point {
  x: number
  y: number
}

/**
 * The track as a function of lap distance: `at(d)` is where a car `d` metres after the line is, in metres
 * (OpenF1/MultiViewer frame, y up). Distances wrap around the lap, so negative values are the end of the
 * previous lap.
 */
export interface Centerline {
  length: number
  at(d: number): Point
  /** direction of travel at `d` (radians, world frame), averaged over ±`span` metres */
  heading(d: number, span?: number): number
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/** Closed polyline parametrised by arc length. */
function arcPolyline(xs: ArrayLike<number>, ys: ArrayLike<number>) {
  const x = Array.from(xs)
  const y = Array.from(ys)
  if (Math.hypot(x[0] - x[x.length - 1], y[0] - y[y.length - 1]) > 1e-6) {
    x.push(x[0])
    y.push(y[0])
  }
  const s = new Float64Array(x.length)
  for (let i = 1; i < x.length; i++) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1])
  const total = s[s.length - 1]
  const at = (arc: number): Point => {
    const a = mod(arc, total)
    const i = Math.min(x.length - 2, Math.max(0, bisectRight(s, a)))
    const k = s[i + 1] === s[i] ? 0 : (a - s[i]) / (s[i + 1] - s[i])
    return { x: x[i] + (x[i + 1] - x[i]) * k, y: y[i] + (y[i + 1] - y[i]) * k }
  }
  /** arc length of the polyline point closest to (px, py) */
  const project = (px: number, py: number) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < x.length - 1; i++) {
      const dx = x[i + 1] - x[i]
      const dy = y[i + 1] - y[i]
      const len2 = dx * dx + dy * dy || 1
      const k = Math.max(0, Math.min(1, ((px - x[i]) * dx + (py - y[i]) * dy) / len2))
      const qx = x[i] + dx * k - px
      const qy = y[i] + dy * k - py
      const dd = qx * qx + qy * qy
      if (dd < bestD) {
        bestD = dd
        best = s[i] + (s[i + 1] - s[i]) * k
      }
    }
    return best
  }
  return { at, project, total }
}

function make(length: number, at: (d: number) => Point): Centerline {
  return {
    length,
    at,
    heading(d, span = 12) {
      const a = at(d - span)
      const b = at(d + span)
      return Math.atan2(b.y - a.y, b.x - a.x)
    },
  }
}

/** Centerline traced by the reference lap itself (fallback when the circuit layout is unknown). */
export function centerlineFromLap(raw: LapTelemetry, length: number): Centerline {
  const scale = length / (raw.d[raw.d.length - 1] || 1)
  const d = [...raw.d.map((v) => v * scale), raw.d[0] * scale + length]
  const x = [...raw.x, raw.x[0]].map((v) => v / 10)
  const y = [...raw.y, raw.y[0]].map((v) => v / 10)
  return make(length, (q) => {
    let a = mod(q, length)
    if (a < d[0]) a += length
    const i = Math.min(d.length - 2, Math.max(0, bisectRight(d, a)))
    const k = d[i + 1] === d[i] ? 0 : (a - d[i]) / (d[i + 1] - d[i])
    return { x: x[i] + (x[i + 1] - x[i]) * k, y: y[i] + (y[i + 1] - y[i]) * k }
  })
}

/**
 * Smooth MultiViewer outline, anchored on the reference lap: every lap sample is projected on the outline,
 * then `arc = origin + direction · k · d` is fitted (the outline may be drawn either way round and is a few
 * per cent longer or shorter than a racing line).
 */
export function centerlineFromLayout(layout: CircuitLayout, raw: LapTelemetry, length: number): Centerline {
  const poly = arcPolyline(
    layout.x.map((v) => v / 10),
    layout.y.map((v) => v / 10),
  )
  const scale = length / (raw.d[raw.d.length - 1] || 1)
  const k = poly.total / length
  const samples: { d: number; arc: number }[] = []
  for (let i = 0; i < raw.d.length; i += 2) samples.push({ d: raw.d[i] * scale, arc: poly.project(raw.x[i] / 10, raw.y[i] / 10) })

  let best = { dir: 1, origin: 0, err: Infinity }
  for (const dir of [1, -1]) {
    // circular mean of the implied origins
    let sx = 0
    let sy = 0
    for (const p of samples) {
      const ang = (mod(p.arc - dir * k * p.d, poly.total) / poly.total) * 2 * Math.PI
      sx += Math.cos(ang)
      sy += Math.sin(ang)
    }
    const origin = mod((Math.atan2(sy, sx) / (2 * Math.PI)) * poly.total, poly.total)
    let err = 0
    for (const p of samples) {
      const r = mod(p.arc - dir * k * p.d - origin, poly.total)
      err += Math.min(r, poly.total - r)
    }
    if (err < best.err) best = { dir, origin, err }
  }
  return make(length, (d) => poly.at(best.origin + best.dir * k * d))
}

/** The whole lap sampled every `step` metres (closed), e.g. to draw the circuit. */
export function sampleLoop(c: Centerline, step = 8): { x: number[]; y: number[] } {
  const x: number[] = []
  const y: number[] = []
  for (let d = 0; d < c.length; d += step) {
    const p = c.at(d)
    x.push(p.x)
    y.push(p.y)
  }
  return { x, y }
}
