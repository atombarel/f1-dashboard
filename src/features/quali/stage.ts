import type { Driver, LapRow } from '@shared/types'
import { distanceAt, liveGap, metresBehind, type Ghost } from './ghost'

/** A driver's reference lap, ready to race against the others. */
export interface GhostCar {
  driver: Driver
  colour: string
  ghost: Ghost
  lap: LapRow
  /** official lap time */
  time: number
  /** rank in the segment (0 = fastest) */
  rank: number
}

export interface CarFrame {
  car: GhostCar
  /** metres since the line (keeps growing past it) */
  d: number
  /** official gap to the reference lap time */
  gap: number
  /** live gap to the reference, measured where the reference is (equals `gap` once it has the flag) */
  live: number
  /** metres behind the reference (negative when ahead), capped at the line */
  behind: number
  finished: boolean
  /** order on the road at this instant */
  order: number
}

/**
 * Where every car is `t` seconds after they all started their lap. The reference is the fastest car,
 * the anchor is the leading car on the road, capped at the line once it has finished.
 */
export function frameAt(cars: GhostCar[], t: number): { frames: CarFrame[]; anchor: number; reference: GhostCar | undefined } {
  const reference = cars[0]
  if (!reference) return { frames: [], anchor: 0, reference }
  const length = reference.ghost.length
  const ds = cars.map((c) => distanceAt(c.ghost, t))
  const anchor = Math.min(length, Math.max(...ds))
  const frames = cars.map<CarFrame>((car, i) => ({
    car,
    d: ds[i],
    gap: car.time - reference.time,
    live: liveGap(reference.ghost, car.ghost, t),
    behind: metresBehind(reference.ghost, car.ghost, t),
    finished: t >= car.ghost.lapTime,
    order: 0,
  }))
  // finished cars rank by lap time, the others by distance covered
  const byRoad = [...frames].sort((a, b) => Number(b.finished) - Number(a.finished) || (a.finished ? a.car.time - b.car.time : b.d - a.d))
  byRoad.forEach((f, i) => (f.order = i))
  return { frames, anchor, reference }
}

/**
 * Public position data is snapped onto a reference line of the circuit: it tells how far along the lap a car
 * is, never whether it is left or right. The lateral layout is therefore ours, built so that no two cars are
 * ever drawn on top of each other.
 *
 * `slots` lanes are spread across the track, numbered from the centre outwards. Car `i` (by rank) owns lane
 * `i % slots`: with at least as many lanes as cars, every car keeps its own lane for the whole lap.
 */
export function slotOffsets(slots: number): number[] {
  // centre first, then alternately left and right: offsets in lane widths, 0 = middle of the track
  const out: number[] = []
  for (let i = 0; i < slots; i++) out.push(i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2))
  // with an even count there is no middle lane: shift everything by half a lane
  return slots % 2 ? out : out.map((o) => o - 0.5)
}

/**
 * Lane of every car at one instant. Each car takes its own lane; only when there are more cars than lanes
 * can that lane be taken by a faster car less than `minGap` metres away, then the nearest free lane wins
 * (or the least crowded one).
 */
function assignLanes(cars: GhostCar[], t: number, minGap: number, lanes: number[]): number[] {
  const ds = cars.map((c) => distanceAt(c.ghost, t))
  const out: number[] = []
  cars.forEach((_, i) => {
    const own = lanes[i % lanes.length]
    const options = [...lanes].sort((a, b) => Math.abs(a - own) - Math.abs(b - own))
    const clearance = (lane: number) => Math.min(Infinity, ...out.map((l, j) => (l === lane ? Math.abs(ds[j] - ds[i]) : Infinity)))
    out.push(options.find((l) => clearance(l) >= minGap) ?? options.reduce((a, b) => (clearance(b) > clearance(a) ? b : a)))
  })
  return out
}

/**
 * Lateral position of every car (in lane widths, fractional while moving across), averaged over the last half
 * second so a car changing lane slides over instead of jumping. Pure: the same `t` always gives the same frame.
 */
export function lanesAt(cars: GhostCar[], t: number, minGap: number, slots: number): number[] {
  const lanes = slotOffsets(slots)
  const SAMPLES = 9
  const sum = new Array<number>(cars.length).fill(0)
  for (let s = 0; s < SAMPLES; s++) assignLanes(cars, t - (s * 0.5) / (SAMPLES - 1), minGap, lanes).forEach((l, i) => (sum[i] += l))
  return sum.map((v) => v / SAMPLES)
}

/**
 * Metres of track the camera must show behind the leader so that every car fits: follows the spread of the
 * pack, averaged over the last second so the zoom breathes instead of pumping.
 */
export function spanAt(cars: GhostCar[], t: number): number {
  const SAMPLES = 6
  let sum = 0
  for (let s = 0; s < SAMPLES; s++) {
    const at = Math.max(0, t - s / (SAMPLES - 1))
    const ds = cars.map((c) => Math.min(distanceAt(c.ghost, at), c.ghost.length))
    sum += Math.max(...ds) - Math.min(...ds)
  }
  return Math.max(45, Math.min(240, (sum / SAMPLES) * 1.15 + 18))
}
