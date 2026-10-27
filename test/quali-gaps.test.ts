import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { unpackTelemetry, type DriverTelemetryWire } from '../shared/codec'
import type { CircuitLayout, LapRow, LapTelemetry, SessionBundle } from '../shared/types'
import { centerlineFromLap, centerlineFromLayout } from '../src/features/quali/centerline'
import { distanceAt, liveGap, metresBehind, prepareGhost, timeAt } from '../src/features/quali/ghost'
import { lapForTime, qualiSegments, segmentEntries } from '../src/features/quali/segments'
import { frameAt, lanesAt, slotOffsets, spanAt, type GhostCar } from '../src/features/quali/stage'

/** A lap at constant speed (m/s), sampled every 250 ms, starting `offset` ms after the line. */
function constantLap(speed: number, lapTime: number, offset = 120): LapTelemetry {
  const lap: LapTelemetry = { t: [], d: [], v: [], th: [], br: [], g: [], rpm: [], drs: [], x: [], y: [] }
  for (let ms = offset; ms < lapTime * 1000; ms += 250) {
    lap.t.push(ms)
    lap.d.push((speed * ms) / 1000)
    lap.v.push(speed * 3.6)
  }
  return lap
}

describe('ghosts', () => {
  const ref = prepareGhost(constantLap(50, 100), 100, null)
  const slow = prepareGhost(constantLap(49.5, 101), 101, ref.length)

  it('start on the line and cross it at the official lap time', () => {
    expect(distanceAt(ref, 0)).toBe(0)
    expect(ref.length).toBeCloseTo(5000, 6)
    expect(timeAt(ref, ref.length)).toBe(100)
    expect(timeAt(slow, slow.length)).toBe(101)
    expect(slow.length).toBe(ref.length)
  })

  it('measure the gap at the line when the reference finishes', () => {
    // the slower car covers the lap in 101 s at constant speed: 1 s = 1/101 of the lap behind
    expect(metresBehind(ref, slow, 100)).toBeCloseTo(5000 / 101, 3)
    // live gap = how much later the slower car reaches the reference's point: half a lap in, half a second
    expect(liveGap(ref, slow, 50)).toBeCloseTo(0.5, 6)
    // from the flag on, the live gap is the official one, and the metres shrink to zero at the line
    expect(liveGap(ref, slow, 100)).toBeCloseTo(1, 6)
    expect(liveGap(ref, slow, 100.6)).toBeCloseTo(1, 6)
    expect(metresBehind(ref, slow, 101)).toBeCloseTo(0, 6)
  })

  it('keep running past the line at the exit speed', () => {
    expect(distanceAt(ref, 102)).toBeCloseTo(5100, 6)
    expect(timeAt(ref, 5100)).toBeCloseTo(102, 6)
  })
})

describe('Austin 2026 qualifying (ANT vs VER)', () => {
  const dir = new URL('./fixtures/austin-2026-quali/', import.meta.url)
  const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'))
  const raw = load<Record<string, DriverTelemetryWire & { lapRow: LapRow }>>('laps')
  const layout = load<CircuitLayout>('circuit')
  const lapOf = (n: number) => {
    const w = raw[n]
    return { tel: Object.values(unpackTelemetry(w).laps)[0], row: w.lapRow }
  }
  const ant = lapOf(12)
  const ver = lapOf(3)
  const pole = prepareGhost(ant.tel, ant.row.t!, null)
  const p2 = prepareGhost(ver.tel, ver.row.t!, pole.length)

  it('puts Verstappen about 0.18 s worth of track behind at the flag', () => {
    // the freeze frame shows the official gap
    expect(liveGap(pole, p2, pole.lapTime)).toBeCloseTo(0.179, 6)
    const metres = metresBehind(pole, p2, pole.lapTime)
    // ≈ 0.179 s at ~210 km/h out of the last corner
    expect(metres).toBeGreaterThan(8)
    expect(metres).toBeLessThan(14)
  })

  it('anchors the circuit layout on the reference lap', () => {
    const fromLayout = centerlineFromLayout(layout, ant.tel, pole.length)
    const fromLap = centerlineFromLap(ant.tel, pole.length)
    // both centerlines agree within a track width all around the lap
    for (let d = 0; d < pole.length; d += 250) {
      const a = fromLayout.at(d)
      const b = fromLap.at(d)
      expect(Math.hypot(a.x - b.x, a.y - b.y), `at ${d} m`).toBeLessThan(25)
    }
    // and the start of the lap points the same way
    const h = fromLayout.heading(20) - fromLap.heading(20)
    expect(Math.abs(Math.atan2(Math.sin(h), Math.cos(h)))).toBeLessThan(0.3)
  })
})

describe('segments', () => {
  const lap = (n: number, t: number | null): LapRow => ({ n, t, s1: null, s2: null, s3: null, st: null, po: false, at: null })
  const driver = (number: number) => ({ number, acronym: `D${number}` }) as SessionBundle['drivers'][number]
  const bundle = {
    drivers: [driver(1), driver(2), driver(3)],
    results: [
      { driverNumber: 2, q: [80.5, 80.1, 79.9] },
      { driverNumber: 1, q: [80.4, 80.2, 80.0] },
      { driverNumber: 3, q: [80.6, 80.3, null] },
    ],
    laps: {
      1: [lap(3, 80.4), lap(9, 80.2), lap(14, 80.0)],
      2: [lap(4, 80.5), lap(8, 80.1), lap(15, 79.9001)],
      3: [lap(5, 80.6), lap(10, 80.3)],
    },
  } as unknown as SessionBundle

  it('lists the segments with times', () => {
    expect(qualiSegments(bundle)).toEqual(['q1', 'q2', 'q3'])
    expect(qualiSegments({ ...bundle, results: [] })).toEqual(['best'])
  })

  it('matches each official time to its lap, fastest first', () => {
    const q3 = segmentEntries(bundle, 'q3')
    expect(q3.map((e) => [e.driver.number, e.lap.n])).toEqual([
      [2, 15],
      [1, 14],
    ])
    expect(segmentEntries(bundle, 'q1').map((e) => e.lap.n)).toEqual([3, 4, 5])
    expect(lapForTime(bundle.laps[1], 81)).toBeUndefined()
  })
})

describe('stage', () => {
  const car = (n: number, speed: number, time: number, ref: number | null): GhostCar => ({
    driver: { number: n, acronym: `D${n}` } as GhostCar['driver'],
    colour: '#fff',
    ghost: prepareGhost(constantLap(speed, time), time, ref),
    lap: { n: 1, t: time, s1: null, s2: null, s3: null, st: null, po: false, at: null },
    time,
    rank: 0,
  })
  const a = car(1, 50, 100, null)
  const b = car(2, 49.99, 100.02, a.ghost.length)
  const c = car(3, 45, 111, a.ghost.length)

  it('orders the road and anchors the camera on the line once the leader is through', () => {
    const { frames, anchor } = frameAt([a, b, c], 100)
    expect(anchor).toBeCloseTo(5000, 3)
    expect(frames.map((f) => f.order)).toEqual([0, 1, 2])
    expect(frames[1].gap).toBeCloseTo(0.02, 6)
    expect(frames.map((f) => f.live)).toEqual(frames.map((f) => expect.closeTo(f.gap, 6)))
    expect(frames[2].behind).toBeGreaterThan(400)
  })

  it('spreads lanes from the centre of the track outwards', () => {
    expect(slotOffsets(1)).toEqual([0])
    expect(slotOffsets(3)).toEqual([0, 1, -1])
    expect(slotOffsets(4)).toEqual([-0.5, 0.5, -1.5, 1.5])
  })

  it('gives every car its own lane for the whole lap when there are enough lanes', () => {
    for (const t of [0, 10, 50, 99.9, 100.5]) expect(lanesAt([a, b, c], t, 7, 3)).toEqual([0, 1, -1])
  })

  it('never stacks two cars a metre apart when they have to share lanes', () => {
    // b would share a's lane but is a metre behind it: it moves to c's lane, c being far down the road
    expect(lanesAt([a, c, b], 50, 7, 2)).toEqual([-0.5, 0.5, 0.5])
  })

  it('zooms on the spread of the pack, within bounds', () => {
    expect(spanAt([a, b], 50)).toBe(45)
    expect(spanAt([a, c], 100)).toBe(240)
  })
})
