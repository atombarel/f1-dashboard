// API contract shared by the Worker and the SPA. Times are ISO strings, durations are seconds.

export type SessionKind = 'practice' | 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race' | 'testing'

/**
 * upcoming   – not started yet
 * live       – between date_start and date_end (+ grace period)
 * processing – finished, data not ingested yet (or being ingested)
 * final      – bundle available
 * cancelled  – cancelled by the FIA
 */
export type SessionStatus = 'upcoming' | 'live' | 'processing' | 'final' | 'cancelled'

export interface PodiumEntry {
  position: number
  driverNumber: number
  acronym: string
  fullName: string
  teamName: string
  teamColour: string
}

export interface SessionSummary {
  key: number
  meetingKey: number
  name: string
  type: string
  kind: SessionKind
  dateStart: string
  dateEnd: string
  status: SessionStatus
  /** Content hash of the ingested bundle; append as ?v= to get an immutable response. */
  version: string | null
  /** Telemetry version, null until per-driver telemetry is ingested. */
  telemetryVersion: string | null
  podium: PodiumEntry[] | null
}

export interface MeetingSummary {
  key: number
  year: number
  round: number | null
  name: string
  officialName: string
  location: string
  countryCode: string
  countryName: string
  countryFlag: string | null
  circuitKey: number
  circuitName: string
  circuitImage: string | null
  gmtOffset: string
  dateStart: string
  dateEnd: string
  isCancelled: boolean
  isTesting: boolean
  sessions: SessionSummary[]
}

export interface SeasonResponse {
  year: number
  seasons: number[]
  meetings: MeetingSummary[]
  generatedAt: string
}

export interface MeetingResponse {
  meeting: MeetingSummary
  generatedAt: string
}

export interface Driver {
  number: number
  acronym: string
  fullName: string
  firstName: string
  lastName: string
  teamName: string
  teamColour: string
  headshot: string | null
  countryCode: string | null
}

export type ResultStatus = 'finished' | 'dnf' | 'dns' | 'dsq' | 'nc'

export interface ResultRow {
  position: number | null
  driverNumber: number
  status: ResultStatus
  /** Free text from the official classification, e.g. "+1 Lap", "Engine". */
  statusText: string | null
  laps: number | null
  points: number | null
  /** Total race time (race/sprint) or best lap (practice). */
  time: number | null
  /** Seconds behind the winner, or a lapped label such as "+1 LAP". */
  gap: number | string | null
  /** Qualifying segment times [Q1, Q2, Q3]. */
  q: (number | null)[] | null
  grid: number | null
  bestLap: number | null
}

export interface LapRow {
  /** lap number */
  n: number
  /** lap time */
  t: number | null
  s1: number | null
  s2: number | null
  s3: number | null
  /** speed trap */
  st: number | null
  /** pit out lap */
  po: boolean
  /** seconds since the session start when the lap began */
  at: number | null
}

export type Compound = 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET' | 'UNKNOWN'

export interface Stint {
  driverNumber: number
  stint: number
  compound: Compound
  lapStart: number
  lapEnd: number
  tyreAge: number
}

export interface PitStop {
  driverNumber: number
  lap: number
  /** Time spent in the pit lane. */
  lane: number | null
  /** Stationary time, only reported since 2025. */
  stop: number | null
}

export interface RaceControlMessage {
  date: string
  lap: number | null
  category: string
  flag: string | null
  scope: string | null
  sector: number | null
  driverNumber: number | null
  qualifyingPhase: number | null
  message: string
}

export interface WeatherSample {
  date: string
  air: number
  track: number
  humidity: number
  pressure: number
  rain: boolean
  windSpeed: number
  windDir: number
}

export interface Overtake {
  date: string
  lap: number | null
  by: number
  on: number
  position: number
}

export interface Neutralization {
  type: 'SC' | 'VSC' | 'RED'
  lapStart: number
  lapEnd: number
}

export interface FastestLap {
  driverNumber: number
  lap: number
  time: number
}

export type DatasetName =
  | 'drivers'
  | 'laps'
  | 'stints'
  | 'pit'
  | 'race_control'
  | 'weather'
  | 'session_result'
  | 'position'
  | 'overtakes'
  | 'jolpica'

export type DatasetStatus = 'ok' | 'empty' | 'error'

export interface SessionBundle {
  schema: 1
  version: string
  generatedAt: string
  session: SessionSummary
  meeting: Omit<MeetingSummary, 'sessions'>
  drivers: Driver[]
  results: ResultRow[]
  totalLaps: number
  laps: Record<number, LapRow[]>
  /** Race position at the end of each lap (index 0 = lap 1). */
  positions: Record<number, (number | null)[]>
  /** Gap to the leader at the end of each lap. */
  gaps: Record<number, (number | null)[]>
  stints: Stint[]
  pits: PitStop[]
  raceControl: RaceControlMessage[]
  weather: WeatherSample[]
  overtakes: Overtake[]
  neutralizations: Neutralization[]
  fastestLap: FastestLap | null
  sources: Partial<Record<DatasetName, DatasetStatus>>
}

/** Cheap, short-lived pointer to the immutable resources of a session. */
export interface SessionMeta {
  session: SessionSummary
  meeting: Omit<MeetingSummary, 'sessions'>
  /** /api/sessions/:key/bundle?v=… when available */
  bundleUrl: string | null
  /** per-driver telemetry URL template ({driver} placeholder) */
  telemetryUrl: string | null
  replayUrl: string | null
  circuitUrl: string | null
  retryAfter: number | null
  /** Ingestion gave up (OpenF1 never published this session). */
  unavailable: boolean
}

/** Telemetry of one lap, all channels share the same index. */
export interface LapTelemetry {
  /** ms since lap start */
  t: number[]
  /** metres since lap start (integrated from speed) */
  d: number[]
  /** km/h */
  v: number[]
  /** throttle 0-100 */
  th: number[]
  /** brake on/off */
  br: number[]
  g: number[]
  rpm: number[]
  drs: number[]
  /** car position, OpenF1/MultiViewer coordinates (1/10 m) */
  x: number[]
  y: number[]
}

export interface DriverTelemetry {
  driverNumber: number
  laps: Record<number, LapTelemetry>
}

/** Car positions on a 1s grid, delta-encoded per driver (first value absolute). */
export interface ReplayData {
  /** seconds since the session start of sample 0 */
  start: number
  step: number
  length: number
  cars: Record<number, { dx: number[]; dy: number[] }>
}

export interface CircuitLayout {
  circuitKey: number
  year: number
  x: number[]
  y: number[]
  rotation: number
  corners: { number: number; letter: string; angle: number; x: number; y: number }[]
}

export interface StandingDriver {
  position: number
  points: number
  wins: number
  driverId: string
  code: string
  number: number | null
  givenName: string
  familyName: string
  nationality: string
  teamId: string
  teamName: string
  teamColour: string
  headshot: string | null
}

export interface StandingTeam {
  position: number
  points: number
  wins: number
  teamId: string
  name: string
  nationality: string
  teamColour: string
}

export interface StandingsResponse {
  year: number
  round: number
  drivers: StandingDriver[]
  teams: StandingTeam[]
  progression: {
    rounds: { round: number; name: string; countryCode: string | null; sprint: boolean }[]
    /** cumulative points after each round, keyed by driverId / teamId */
    drivers: Record<string, number[]>
    teams: Record<string, number[]>
  }
  generatedAt: string
}

export interface HomeResponse {
  year: number
  now: string
  live: { meeting: MeetingSummary; session: SessionSummary } | null
  next: { meeting: MeetingSummary; session: SessionSummary } | null
  lastRace: { meeting: MeetingSummary; session: SessionSummary } | null
  currentMeeting: MeetingSummary | null
  standings: Pick<StandingsResponse, 'round' | 'drivers' | 'teams'> | null
  generatedAt: string
}
