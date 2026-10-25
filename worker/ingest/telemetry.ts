import type { DriverTelemetry, LapRow, LapTelemetry, ReplayData } from '../../shared/types'
import type { OF1CarData, OF1Location } from '../upstream/openf1'

/** Positions of one car, times in ms since session start. */
export interface CompactTrack {
  t: number[]
  x: number[]
  y: number[]
}

export function compactLocation(raw: OF1Location[], sessionStart: number): CompactTrack {
  const rows = raw
    .filter((p) => p.x !== 0 || p.y !== 0) // (0,0,0) means "no signal"
    .map((p) => [Date.parse(p.date) - sessionStart, Math.round(p.x), Math.round(p.y)] as const)
    .sort((a, b) => a[0] - b[0])
  return { t: rows.map((r) => r[0]), x: rows.map((r) => r[1]), y: rows.map((r) => r[2]) }
}

/** Linear interpolation of the track at time `at` (ms). `hint` keeps the search O(n) over a sorted sweep. */
function sampleTrack(track: CompactTrack, at: number, hint: { i: number }): [number, number] | null {
  const { t, x, y } = track
  if (!t.length || at < t[0] || at > t[t.length - 1]) return null
  let i = hint.i
  while (i < t.length - 2 && t[i + 1] < at) i++
  while (i > 0 && t[i] > at) i--
  hint.i = i
  const t0 = t[i]
  const t1 = t[i + 1] ?? t0
  const k = t1 === t0 ? 0 : (at - t0) / (t1 - t0)
  return [Math.round(x[i] + (x[i + 1] - x[i]) * k || x[i]), Math.round(y[i] + (y[i + 1] - y[i]) * k || y[i])]
}

/**
 * Slice the car data of a whole session into laps, integrate the distance from the speed
 * and attach the interpolated car position to every sample.
 */
export function buildDriverTelemetry(
  driverNumber: number,
  car: OF1CarData[],
  track: CompactTrack,
  laps: LapRow[],
  sessionStart: number,
): DriverTelemetry {
  const samples = car
    .map((c) => ({ ...c, ms: Date.parse(c.date) - sessionStart }))
    .filter((c) => Number.isFinite(c.ms))
    .sort((a, b) => a.ms - b.ms)

  const out: DriverTelemetry = { driverNumber, laps: {} }
  let cursor = 0
  const hint = { i: 0 }
  for (const lap of laps) {
    if (lap.at === null || lap.t === null) continue
    const from = lap.at * 1000
    const to = from + lap.t * 1000
    while (cursor < samples.length && samples[cursor].ms < from) cursor++
    const lt: LapTelemetry = { t: [], d: [], v: [], th: [], br: [], g: [], rpm: [], drs: [], x: [], y: [] }
    let dist = 0
    let prevMs = from
    let prevV = samples[cursor]?.speed ?? 0
    for (let i = cursor; i < samples.length && samples[i].ms <= to; i++) {
      const s = samples[i]
      // trapezoidal integration, km/h → m/ms
      dist += (((prevV + s.speed) / 2) * (s.ms - prevMs)) / 3600
      prevMs = s.ms
      prevV = s.speed
      const pos = sampleTrack(track, s.ms, hint)
      lt.t.push(s.ms - from)
      lt.d.push(Math.round(dist * 10) / 10)
      lt.v.push(s.speed)
      lt.th.push(Math.min(100, s.throttle))
      lt.br.push(s.brake > 0 ? 1 : 0)
      lt.g.push(s.n_gear)
      lt.rpm.push(s.rpm)
      lt.drs.push(s.drs !== null && s.drs >= 10 ? 1 : 0)
      lt.x.push(pos?.[0] ?? NaN)
      lt.y.push(pos?.[1] ?? NaN)
    }
    if (lt.t.length < 10) continue
    // fill position gaps with the nearest known point so the client never sees NaN
    fillGaps(lt.x)
    fillGaps(lt.y)
    out.laps[lap.n] = lt
  }
  return out
}

function fillGaps(a: number[]) {
  let last = a.find((v) => Number.isFinite(v)) ?? 0
  for (let i = 0; i < a.length; i++) {
    if (Number.isFinite(a[i])) last = a[i]
    else a[i] = last
  }
}

/** Resample a car on a fixed grid (seconds since session start). Missing samples repeat the last position. */
export function resampleTrack(track: CompactTrack, startS: number, length: number, stepS: number) {
  const xs: number[] = []
  const ys: number[] = []
  const hint = { i: 0 }
  let last: [number, number] | null = null
  for (let i = 0; i < length; i++) {
    const p: [number, number] | null = sampleTrack(track, (startS + i * stepS) * 1000, hint) ?? last
    last = p
    xs.push(p?.[0] ?? 0)
    ys.push(p?.[1] ?? 0)
  }
  return { x: xs, y: ys }
}

export function deltaEncode(a: number[]): number[] {
  return a.map((v, i) => (i === 0 ? v : v - a[i - 1]))
}

export function assembleReplay(
  startS: number,
  length: number,
  stepS: number,
  cars: Record<number, { x: number[]; y: number[] }>,
): ReplayData {
  const encoded: ReplayData['cars'] = {}
  for (const [drv, c] of Object.entries(cars)) encoded[Number(drv)] = { dx: deltaEncode(c.x), dy: deltaEncode(c.y) }
  return { start: startS, step: stepS, length, cars: encoded }
}
