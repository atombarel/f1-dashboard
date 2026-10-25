import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { SessionSummary } from '../shared/types'
import { buildBundle, parseClock, podiumOf, type RawSessionData } from '../worker/ingest/bundle'
import { buildDriverTelemetry, compactCar, compactLocation, mergeSeries } from '../worker/ingest/telemetry'

const dir = new URL('./fixtures/singapore-2026/', import.meta.url)
const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'))

const raw: RawSessionData = {
  drivers: load('drivers'),
  laps: load('laps'),
  stints: load('stints'),
  pit: load('pit'),
  race_control: load('race_control'),
  weather: load('weather'),
  session_result: load('session_result'),
  position: load('position'),
  overtakes: load('overtakes'),
  jolpica: load('jolpica'),
}

const session: SessionSummary = {
  key: 11388,
  meetingKey: 1296,
  name: 'Race',
  type: 'Race',
  kind: 'race',
  dateStart: '2026-10-11T12:00:00+00:00',
  dateEnd: '2026-10-11T14:00:00+00:00',
  status: 'final',
  version: null,
  telemetryVersion: null,
  podium: null,
}
const meeting = { key: 1296, year: 2026, round: 17, name: 'Singapore Grand Prix' } as never

describe('buildBundle (Singapore 2026 race)', () => {
  const bundle = buildBundle(session, meeting, raw, {})

  it('classifies the race like the official result', () => {
    expect(bundle.results.slice(0, 3).map((r) => r.driverNumber)).toEqual([3, 16, 12])
    expect(bundle.results[0]).toMatchObject({ position: 1, status: 'finished', points: 25, grid: 1, laps: 62 })
    const retired = bundle.results.filter((r) => r.status === 'dnf').map((r) => r.driverNumber)
    expect(retired).toEqual(expect.arrayContaining([18, 43, 5]))
    expect(bundle.results.find((r) => r.driverNumber === 41)?.gap).toBe('+1 LAP')
    expect(bundle.totalLaps).toBe(62)
  })

  it('derives the running order lap by lap', () => {
    // the winner is P1 at the flag and every lap has a unique P1
    expect(bundle.positions[3].at(-1)).toBe(1)
    for (let lap = 0; lap < bundle.totalLaps; lap++) {
      const p1 = Object.values(bundle.positions).filter((p) => p[lap] === 1)
      expect(p1).toHaveLength(1)
    }
    expect(bundle.gaps[16].at(-1)).toBeGreaterThan(0)
  })

  it('finds both virtual safety cars', () => {
    expect(bundle.neutralizations).toEqual([
      { type: 'VSC', lapStart: 8, lapEnd: 9 },
      { type: 'VSC', lapStart: 39, lapEnd: 40 },
    ])
  })

  it('keeps stints contiguous and pit stops sorted', () => {
    const ver = bundle.stints.filter((s) => s.driverNumber === 3)
    expect(ver[0].lapStart).toBe(1)
    for (let i = 1; i < ver.length; i++) expect(ver[i].lapStart).toBeGreaterThan(ver[i - 1].lapStart)
    expect(bundle.pits.map((p) => p.lap)).toEqual([...bundle.pits.map((p) => p.lap)].sort((a, b) => a - b))
  })

  it('reports the fastest lap and podium', () => {
    expect(bundle.fastestLap?.time).toBeGreaterThan(90)
    expect(podiumOf(bundle).map((p) => p.acronym)).toEqual(['VER', 'LEC', 'ANT'])
  })

  it('attributes overtakes to laps', () => {
    expect(bundle.overtakes.length).toBeGreaterThan(50)
    expect(bundle.overtakes.filter((o) => o.lap !== null).length / bundle.overtakes.length).toBeGreaterThan(0.9)
  })
})

describe('telemetry', () => {
  it('slices laps, integrates distance and attaches positions', () => {
    const start = Date.parse(session.dateStart)
    const bundle = buildBundle(session, meeting, raw, {})
    const tel = buildDriverTelemetry(3, compactCar(load('car_3'), start), compactLocation(load('loc_3'), start), bundle.laps[3])
    const lap = tel.laps[20]
    expect(lap).toBeDefined()
    const length = lap.d.at(-1)!
    // Marina Bay is ~4.94 km
    expect(length).toBeGreaterThan(4700)
    expect(length).toBeLessThan(5200)
    expect(Math.max(...lap.v)).toBeGreaterThan(280)
    expect(lap.x.every(Number.isFinite)).toBe(true)
    expect(new Set(lap.x).size).toBeGreaterThan(100)
  })
})

describe('parseClock', () => {
  it('parses lap and race clocks', () => {
    expect(parseClock('1:29.123')).toBe(89.123)
    expect(parseClock('+12.345')).toBe(12.345)
    expect(parseClock('1:42:00.785')).toBe(6120.785)
    expect(parseClock(undefined)).toBeNull()
  })
})

describe('telemetry codec', () => {
  it('round-trips', async () => {
    const { packTelemetry, unpackTelemetry } = await import('../shared/codec')
    const lap = { t: [0, 270, 540], d: [0, 22.4, 45.1], v: [290, 291, 289], th: [100, 100, 99], br: [0, 0, 1], g: [8, 8, 7], rpm: [11230, 11300, 11050], drs: [0, 0, 0], x: [100, 130, 161], y: [-5, -9, -12] }
    const out = unpackTelemetry(packTelemetry({ driverNumber: 1, laps: { 3: lap } }))
    expect(out.laps[3]).toEqual(lap)
  })
})

describe('time-window batching', () => {
  it('gives the same telemetry as one request per driver', () => {
    const start = Date.parse(session.dateStart)
    const bundle = buildBundle(session, meeting, raw, {})
    const car = load<{ date: string }[]>('car_3')
    const loc = load<{ date: string }[]>('loc_3')
    const whole = buildDriverTelemetry(3, compactCar(car as never, start), compactLocation(loc as never, start), bundle.laps[3])
    // split at an arbitrary instant, as two windows would, and merge back (in reverse order on purpose)
    const cut = car[300].date
    const carParts = [car.filter((c) => c.date >= cut), car.filter((c) => c.date < cut)].map((p) => compactCar(p as never, start))
    const locParts = [loc.filter((c) => c.date >= cut), loc.filter((c) => c.date < cut)].map((p) => compactLocation(p as never, start))
    const merged = buildDriverTelemetry(3, mergeSeries(carParts), mergeSeries(locParts), bundle.laps[3])
    expect(merged).toEqual(whole)
  })
})
