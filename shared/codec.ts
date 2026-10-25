import type { DriverTelemetry, LapTelemetry } from './types'

/**
 * Wire format of per-driver telemetry: every channel is an integer series, delta-encoded
 * (first value absolute). Distance travels in decimetres and rpm in tens; gzip loves the
 * small repeated deltas (~45% smaller than plain JSON).
 */
export type PackedLap = Record<keyof LapTelemetry, number[]>
export interface DriverTelemetryWire {
  driverNumber: number
  packed: 1
  laps: Record<number, PackedLap>
}

const CHANNELS: (keyof LapTelemetry)[] = ['t', 'd', 'v', 'th', 'br', 'g', 'rpm', 'drs', 'x', 'y']
const SCALE: Partial<Record<keyof LapTelemetry, number>> = { d: 10, rpm: 0.1 }

const enc = (a: number[]) => a.map((v, i) => (i === 0 ? v : v - a[i - 1]))
const dec = (a: number[]) => {
  const out = new Array<number>(a.length)
  let acc = 0
  for (let i = 0; i < a.length; i++) out[i] = acc += a[i]
  return out
}

export function packTelemetry(t: DriverTelemetry): DriverTelemetryWire {
  const laps: Record<number, PackedLap> = {}
  for (const [n, lap] of Object.entries(t.laps)) {
    const p = {} as PackedLap
    for (const c of CHANNELS) p[c] = enc(lap[c].map((v) => Math.round(v * (SCALE[c] ?? 1))))
    laps[Number(n)] = p
  }
  return { driverNumber: t.driverNumber, packed: 1, laps }
}

export function unpackTelemetry(w: DriverTelemetryWire): DriverTelemetry {
  const laps: Record<number, LapTelemetry> = {}
  for (const [n, p] of Object.entries(w.laps)) {
    const lap = {} as LapTelemetry
    for (const c of CHANNELS) {
      const s = SCALE[c] ?? 1
      lap[c] = s === 1 ? dec(p[c]) : dec(p[c]).map((v) => v / s)
    }
    laps[Number(n)] = lap
  }
  return { driverNumber: w.driverNumber, laps }
}
