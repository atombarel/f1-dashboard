import type { Driver, LapRow, SessionBundle } from '@shared/types'

/** Q1/Q2/Q3 (`ResultRow.q`), or each driver's best lap when the session has no segment times. */
export type SegmentId = 'q1' | 'q2' | 'q3' | 'best'
const Q_SEGMENTS = ['q1', 'q2', 'q3'] as const
const qIndex = (s: SegmentId) => Q_SEGMENTS.indexOf(s as (typeof Q_SEGMENTS)[number])

export interface GapEntry {
  driver: Driver
  lap: LapRow
  time: number
}

const segmentTime = (bundle: SessionBundle, driver: number, seg: SegmentId): number | null => {
  const r = bundle.results.find((x) => x.driverNumber === driver)
  if (seg === 'best') {
    const times = (bundle.laps[driver] ?? []).map((l) => l.t).filter((t): t is number => t !== null)
    return times.length ? Math.min(...times) : null
  }
  return r?.q?.[qIndex(seg)] ?? null
}

/** Segments with at least two times, in session order; `best` only when there are none. */
export function qualiSegments(bundle: SessionBundle): SegmentId[] {
  const out = Q_SEGMENTS.filter((s) => bundle.results.filter((r) => r.q?.[qIndex(s)] != null).length >= 2)
  return out.length ? out : ['best']
}

/** The lap behind an official time: exact match first, then the closest one within 10 ms. */
export function lapForTime(laps: LapRow[], time: number): LapRow | undefined {
  let best: LapRow | undefined
  for (const l of laps) if (l.t !== null && Math.abs(l.t - time) < 0.01 && (!best || Math.abs(l.t - time) < Math.abs(best.t! - time))) best = l
  return best
}

/** Drivers who set a time in the segment, fastest first. */
export function segmentEntries(bundle: SessionBundle, seg: SegmentId): GapEntry[] {
  const out: GapEntry[] = []
  for (const driver of bundle.drivers) {
    const time = segmentTime(bundle, driver.number, seg)
    if (time === null) continue
    const lap = lapForTime(bundle.laps[driver.number] ?? [], time)
    if (lap) out.push({ driver, lap, time })
  }
  const rank = new Map(bundle.results.map((r, i) => [r.driverNumber, i]))
  return out.sort((a, b) => a.time - b.time || (rank.get(a.driver.number) ?? 99) - (rank.get(b.driver.number) ?? 99))
}
