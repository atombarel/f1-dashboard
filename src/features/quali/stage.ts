import type { Driver, LapRow } from '@shared/types'
import { distanceAt, liveGap, type Ghost } from './ghost'

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
  /** time lost to the reference at the car's current position */
  live: number
  /** metres behind the leading car on the road (capped at the line) */
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
    behind: anchor - Math.min(ds[i], length),
    finished: t >= car.ghost.lapTime,
    order: 0,
  }))
  // finished cars rank by lap time, the others by distance covered
  const byRoad = [...frames].sort((a, b) => Number(b.finished) - Number(a.finished) || (a.finished ? a.car.time - b.car.time : b.d - a.d))
  byRoad.forEach((f, i) => (f.order = i))
  return { frames, anchor, reference }
}

/** Lateral slots: 0 = racing line, ±1 = either side. */
const LANES = [0, 1, -1]

/**
 * Slot of every car at one instant: by rank, each car takes its preferred slot unless a faster car is
 * less than `minGap` metres away in it, then the free slot (or the least crowded one).
 */
function assignLanes(cars: GhostCar[], t: number, minGap: number): number[] {
  const ds = cars.map((c) => distanceAt(c.ghost, t))
  const lanes: number[] = []
  cars.forEach((_, i) => {
    const pref = LANES[i % LANES.length]
    const options = [...LANES].sort((a, b) => Math.abs(a - pref) - Math.abs(b - pref))
    const clearance = (lane: number) => Math.min(Infinity, ...lanes.map((l, j) => (l === lane ? Math.abs(ds[j] - ds[i]) : Infinity)))
    lanes.push(options.find((l) => clearance(l) >= minGap) ?? options.reduce((a, b) => (clearance(b) > clearance(a) ? b : a)))
  })
  return lanes
}

/**
 * Lateral position of every car (in slots, fractional while moving across), averaged over the last half
 * second so a car changing slot slides over instead of jumping. Pure: the same `t` always gives the same frame.
 */
export function lanesAt(cars: GhostCar[], t: number, minGap: number): number[] {
  const SAMPLES = 9
  const sum = new Array<number>(cars.length).fill(0)
  for (let s = 0; s < SAMPLES; s++) assignLanes(cars, t - (s * 0.5) / (SAMPLES - 1), minGap).forEach((l, i) => (sum[i] += l))
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
