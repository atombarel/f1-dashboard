import type { GateLimits, Priority, UpstreamGate } from './gate'

// OpenF1 free tier: 3 req/s and ~30 req/min. Stay a little below both.
const OPENF1_LIMITS: GateLimits = { minIntervalMs: 400, perMinute: 27 }
const JOLPICA_LIMITS: GateLimits = { minIntervalMs: 300, perMinute: 40 }
const MULTIVIEWER_LIMITS: GateLimits = { minIntervalMs: 500, perMinute: 30 }

/** Who is asking: background jobs use the low lane, anything a visitor waits on uses the high lane. */
export interface Upstream {
  env: Env
  priority: Priority
}

type Params = Record<string, string | number | undefined>

/**
 * Keys may carry an OpenF1 comparison operator: { 'date>=': '2026-…', 'meeting_key<=': 1296 }
 * becomes `date>=2026-…&meeting_key<=1296`.
 */
function buildUrl(base: string, path: string, params: Params) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const m = /^(.*?)(>=|<=|>|<)$/.exec(k)
      return m ? `${encodeURIComponent(m[1])}${m[2]}${encodeURIComponent(String(v))}` : `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    })
    .join('&')
  return `${base}/${path}${query ? `?${query}` : ''}`
}

/** Typed stub: the binding is untyped in the preview env, where the class lives in the production Worker. */
export function gate(env: Env, name: string): DurableObjectStub<UpstreamGate> {
  return env.GATE.get(env.GATE.idFromName(name)) as DurableObjectStub<UpstreamGate>
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** Fetch an OpenF1 collection. A 404 "No results found." is an empty list, not an error. */
export async function openf1<T>({ env, priority }: Upstream, path: string, params: Params = {}): Promise<T[]> {
  const url = buildUrl(env.OPENF1_BASE, path, params)
  const res = await gate(env, 'openf1').fetchText(url, OPENF1_LIMITS, priority)
  if (res.status === 404) return []
  if (res.status !== 200) throw new UpstreamError(`OpenF1 ${path} → HTTP ${res.status}`, res.status)
  const data = JSON.parse(res.body)
  if (!Array.isArray(data)) throw new UpstreamError(`OpenF1 ${path} returned a non-array payload`, 502)
  return data as T[]
}

export async function jolpica<T>({ env, priority }: Upstream, path: string, params: Params = {}): Promise<T> {
  const url = buildUrl(env.JOLPICA_BASE, `${path}.json`, params)
  const res = await gate(env, 'jolpica').fetchText(url, JOLPICA_LIMITS, priority)
  if (res.status !== 200) throw new UpstreamError(`Jolpica ${path} → HTTP ${res.status}`, res.status)
  return (JSON.parse(res.body) as { MRData: T }).MRData
}

/** Circuit outline + corners (same coordinate system as OpenF1 `location`). Null when unknown. */
export async function multiviewerCircuit({ env, priority }: Upstream, circuitKey: number, year: number) {
  const url = `https://api.multiviewer.app/api/v1/circuits/${circuitKey}/${year}`
  const res = await gate(env, 'multiviewer').fetchText(url, MULTIVIEWER_LIMITS, priority)
  if (res.status !== 200) return null
  return JSON.parse(res.body) as MVCircuit
}

// ---- Raw OpenF1 shapes (only the fields we use) ----

export interface OF1Meeting {
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  location: string
  country_code: string
  country_name: string
  country_flag?: string | null
  circuit_key: number
  circuit_short_name: string
  circuit_image?: string | null
  gmt_offset: string
  date_start: string
  date_end?: string | null
  year: number
  is_cancelled?: boolean
}

export interface OF1Session {
  session_key: number
  session_type: string
  session_name: string
  date_start: string
  date_end: string
  meeting_key: number
  year: number
  is_cancelled?: boolean
}

export interface OF1Driver {
  driver_number: number
  broadcast_name: string
  full_name: string
  name_acronym: string
  team_name: string | null
  team_colour: string | null
  first_name: string | null
  last_name: string | null
  headshot_url: string | null
  country_code: string | null
}

export interface OF1Lap {
  driver_number: number
  lap_number: number
  date_start: string | null
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  st_speed: number | null
  is_pit_out_lap: boolean
  lap_duration: number | null
}

export interface OF1Stint {
  driver_number: number
  stint_number: number
  lap_start: number | null
  lap_end: number | null
  compound: string | null
  tyre_age_at_start: number | null
}

export interface OF1Pit {
  date: string
  driver_number: number
  lap_number: number
  pit_duration: number | null
  lane_duration?: number | null
  stop_duration?: number | null
}

export interface OF1RaceControl {
  date: string
  driver_number: number | null
  lap_number: number | null
  category: string
  flag: string | null
  scope: string | null
  sector: number | null
  qualifying_phase?: number | null
  message: string
}

export interface OF1Weather {
  date: string
  air_temperature: number
  track_temperature: number
  humidity: number
  pressure: number
  rainfall: number
  wind_speed: number
  wind_direction: number
}

export interface OF1SessionResult {
  position: number | null
  driver_number: number
  number_of_laps: number | null
  points?: number | null
  dnf: boolean
  dns: boolean
  dsq: boolean
  duration: number | (number | null)[] | null
  gap_to_leader: number | string | (number | string | null)[] | null
}

export interface OF1Position {
  date: string
  driver_number: number
  position: number
}

export interface OF1Overtake {
  date: string
  overtaking_driver_number: number
  overtaken_driver_number: number
  position: number
}

export interface OF1CarData {
  date: string
  speed: number
  throttle: number
  brake: number
  n_gear: number
  rpm: number
  drs: number | null
}

export interface OF1Location {
  date: string
  x: number
  y: number
}

export interface MVCircuit {
  x: number[]
  y: number[]
  rotation: number
  corners: { number: number; letter?: string; angle: number; length: number; trackPosition: { x: number; y: number } }[]
  marshalSectors?: { number: number; trackPosition: { x: number; y: number } }[]
}

// ---- Raw Jolpica shapes ----

export interface JRace {
  season: string
  round: string
  raceName: string
  date: string
  time?: string
  Circuit: { circuitId: string; Location: { locality: string; country: string } }
  Sprint?: { date: string }
  Results?: JResult[]
  SprintResults?: JResult[]
  QualifyingResults?: JQualifying[]
}

export interface JDriver {
  driverId: string
  permanentNumber?: string
  code?: string
  givenName: string
  familyName: string
  nationality: string
}

export interface JConstructor {
  constructorId: string
  name: string
  nationality: string
}

export interface JResult {
  number: string
  position: string
  positionText: string
  points: string
  Driver: JDriver
  Constructor: JConstructor
  grid: string
  laps: string
  status: string
  Time?: { millis?: string; time: string }
  FastestLap?: { rank?: string; lap: string; Time?: { time: string } }
}

export interface JQualifying {
  number: string
  position: string
  Driver: JDriver
  Constructor: JConstructor
  Q1?: string
  Q2?: string
  Q3?: string
}

export interface JRaceTable {
  total: string
  limit: string
  offset: string
  RaceTable: { season: string; round?: string; Races: JRace[] }
}

export interface JStandingsTable {
  StandingsTable: {
    season: string
    round?: string
    StandingsLists: {
      round: string
      DriverStandings?: {
        position?: string
        positionText: string
        points: string
        wins: string
        Driver: JDriver
        Constructors: JConstructor[]
      }[]
      ConstructorStandings?: {
        position?: string
        positionText: string
        points: string
        wins: string
        Constructor: JConstructor
      }[]
    }[]
  }
}
