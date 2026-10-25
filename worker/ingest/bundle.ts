import { isQualiLike, isRaceLike } from '../../shared/sessions'
import type {
  Compound,
  DatasetName,
  DatasetStatus,
  Driver,
  FastestLap,
  LapRow,
  MeetingSummary,
  Neutralization,
  Overtake,
  ResultRow,
  ResultStatus,
  SessionBundle,
  SessionSummary,
  Stint,
} from '../../shared/types'
import type {
  JQualifying,
  JRace,
  JResult,
  OF1Driver,
  OF1Lap,
  OF1Overtake,
  OF1Pit,
  OF1Position,
  OF1RaceControl,
  OF1SessionResult,
  OF1Stint,
  OF1Weather,
} from '../upstream/openf1'

export interface RawSessionData {
  drivers: OF1Driver[]
  laps: OF1Lap[]
  stints: OF1Stint[]
  pit: OF1Pit[]
  race_control: OF1RaceControl[]
  weather: OF1Weather[]
  session_result: OF1SessionResult[]
  position: OF1Position[]
  overtakes: OF1Overtake[]
  /** The matching Jolpica race with Results / SprintResults / QualifyingResults when relevant. */
  jolpica: JRace | null
}

export type UnversionedBundle = Omit<SessionBundle, 'version' | 'generatedAt'>

const round3 = (n: number) => Math.round(n * 1000) / 1000
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function teamColour(hex: string | null | undefined): string {
  if (!hex) return '#7c7c86'
  const h = hex.replace('#', '').trim()
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toUpperCase()}` : '#7c7c86'
}

/** "1:29.123" | "29.123" | "1:42:00.785" → seconds */
export function parseClock(s: string | undefined | null): number | null {
  if (!s) return null
  const parts = s.replace('+', '').split(':').map(Number)
  if (parts.some((p) => !Number.isFinite(p))) return null
  return round3(parts.reduce((acc, p) => acc * 60 + p, 0))
}

function normaliseCompound(c: string | null | undefined): Compound {
  const u = (c ?? '').toUpperCase()
  return (['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'] as const).find((x) => x === u) ?? 'UNKNOWN'
}

export function buildDrivers(raw: OF1Driver[], jolpica: JRace | null): Driver[] {
  const byNumber = new Map<number, Driver>()
  for (const d of raw) {
    if (byNumber.has(d.driver_number)) continue
    byNumber.set(d.driver_number, {
      number: d.driver_number,
      acronym: d.name_acronym ?? String(d.driver_number),
      fullName: titleCase(d.full_name ?? d.broadcast_name ?? ''),
      firstName: d.first_name ?? '',
      lastName: d.last_name ?? '',
      teamName: d.team_name ?? '—',
      teamColour: teamColour(d.team_colour),
      headshot: d.headshot_url ? d.headshot_url.replace('/1col/', '/2col/') : null,
      countryCode: d.country_code,
    })
  }
  // Drivers that only appear in the official classification (OpenF1 occasionally misses one).
  const jRows: (JResult | JQualifying)[] = [...(jolpica?.Results ?? []), ...(jolpica?.SprintResults ?? []), ...(jolpica?.QualifyingResults ?? [])]
  for (const r of jRows) {
    const n = Number(r.number)
    if (!Number.isFinite(n) || byNumber.has(n)) continue
    byNumber.set(n, {
      number: n,
      acronym: r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase(),
      fullName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      firstName: r.Driver.givenName,
      lastName: r.Driver.familyName,
      teamName: r.Constructor.name,
      teamColour: teamColour(null),
      headshot: null,
      countryCode: null,
    })
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number)
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function buildLaps(raw: OF1Lap[], sessionStart: number): Record<number, LapRow[]> {
  const out: Record<number, LapRow[]> = {}
  for (const l of raw) {
    const start = l.date_start ? Date.parse(l.date_start) : NaN
    ;(out[l.driver_number] ??= []).push({
      n: l.lap_number,
      t: num(l.lap_duration),
      s1: num(l.duration_sector_1),
      s2: num(l.duration_sector_2),
      s3: num(l.duration_sector_3),
      st: num(l.st_speed),
      po: Boolean(l.is_pit_out_lap),
      at: Number.isFinite(start) ? round3((start - sessionStart) / 1000) : null,
    })
  }
  for (const k of Object.keys(out)) {
    const laps = out[Number(k)].sort((a, b) => a.n - b.n)
    // de-duplicate lap numbers (seen on red-flagged sessions)
    out[Number(k)] = laps.filter((l, i) => i === 0 || laps[i - 1].n !== l.n)
  }
  return out
}

/** End of lap `n` in seconds since session start, or null when unknown. */
function lapEnd(laps: LapRow[], idx: number): number | null {
  const lap = laps[idx]
  const next = laps[idx + 1]
  if (next && next.n === lap.n + 1 && next.at !== null) return next.at
  if (lap.at !== null && lap.t !== null) return round3(lap.at + lap.t)
  return null
}

/**
 * Running order at the end of every lap, derived from the time each car crossed the line.
 * Cars that have not completed a lap get null for it.
 */
export function buildLapPositions(laps: Record<number, LapRow[]>, totalLaps: number) {
  const positions: Record<number, (number | null)[]> = {}
  const gaps: Record<number, (number | null)[]> = {}
  const ends: Record<number, Map<number, number>> = {}
  for (const [drv, list] of Object.entries(laps)) {
    const m = new Map<number, number>()
    list.forEach((l, i) => {
      const e = lapEnd(list, i)
      if (e !== null) m.set(l.n, e)
    })
    ends[Number(drv)] = m
    positions[Number(drv)] = Array(totalLaps).fill(null)
    gaps[Number(drv)] = Array(totalLaps).fill(null)
  }
  for (let n = 1; n <= totalLaps; n++) {
    const crossed = Object.entries(ends)
      .map(([drv, m]) => [Number(drv), m.get(n)] as const)
      .filter((x): x is readonly [number, number] => x[1] !== undefined)
      .sort((a, b) => a[1] - b[1])
    const leader = crossed[0]?.[1]
    crossed.forEach(([drv, t], i) => {
      positions[drv][n - 1] = i + 1
      gaps[drv][n - 1] = round3(t - leader)
    })
  }
  return { positions, gaps }
}

function resultStatus(r: OF1SessionResult): ResultStatus {
  if (r.dsq) return 'dsq'
  if (r.dns) return 'dns'
  if (r.dnf) return 'dnf'
  return 'finished'
}

function jolpicaStatus(r: JResult): ResultStatus {
  switch (r.positionText) {
    case 'D':
    case 'E':
      return 'dsq'
    case 'W':
    case 'F':
      return 'dns'
    case 'R':
      return 'dnf'
    case 'N':
      return 'nc'
    default:
      return 'finished'
  }
}

function bestLaps(laps: Record<number, LapRow[]>) {
  const best = new Map<number, number>()
  for (const [drv, list] of Object.entries(laps)) {
    const times = list.map((l) => l.t).filter((t): t is number => t !== null)
    if (times.length) best.set(Number(drv), Math.min(...times))
  }
  return best
}

export function buildResults(
  kind: SessionSummary['kind'],
  raw: OF1SessionResult[],
  jolpica: JRace | null,
  laps: Record<number, LapRow[]>,
): ResultRow[] {
  const best = bestLaps(laps)
  const jRace = kind === 'race' ? jolpica?.Results : kind === 'sprint' ? jolpica?.SprintResults : undefined
  const jByNumber = new Map((jRace ?? []).map((r) => [Number(r.number), r]))
  const jQuali = kind === 'qualifying' ? jolpica?.QualifyingResults : undefined

  let rows: ResultRow[]
  if (raw.length) {
    rows = raw.map((r) => {
      const j = jByNumber.get(r.driver_number)
      const quali = isQualiLike(kind) && Array.isArray(r.duration)
      const duration = Array.isArray(r.duration) ? r.duration.filter((d): d is number => typeof d === 'number') : []
      const gapRaw = Array.isArray(r.gap_to_leader) ? r.gap_to_leader.filter((g) => g !== null).at(-1) ?? null : r.gap_to_leader
      return {
        position: r.position ?? null,
        driverNumber: r.driver_number,
        status: j ? jolpicaStatus(j) : resultStatus(r),
        statusText: j?.status ?? null,
        laps: r.number_of_laps ?? null,
        points: num(r.points) ?? (j ? Number(j.points) : null),
        time: quali ? (duration.length ? Math.min(...duration) : null) : num(r.duration),
        gap: typeof gapRaw === 'number' ? round3(gapRaw) : (gapRaw ?? null),
        q: quali ? (r.duration as (number | null)[]).map((d) => num(d)) : null,
        grid: j ? Number(j.grid) || null : null,
        bestLap: best.get(r.driver_number) ?? null,
      }
    })
  } else if (jRace?.length) {
    // OpenF1 has no classification yet: fall back to the official one.
    const winner = parseClock(jRace[0].Time?.time)
    rows = jRace.map((r, i) => {
      const t = r.Time?.time
      const status = jolpicaStatus(r)
      return {
        position: status === 'finished' || status === 'nc' ? i + 1 : null,
        driverNumber: Number(r.number),
        status,
        statusText: r.status,
        laps: Number(r.laps),
        points: Number(r.points),
        time: i === 0 ? winner : winner !== null && t?.startsWith('+') ? round3(winner + (parseClock(t) ?? 0)) : null,
        gap: i === 0 ? 0 : t?.startsWith('+') ? parseClock(t) : status === 'finished' ? r.status : null,
        q: null,
        grid: Number(r.grid) || null,
        bestLap: best.get(Number(r.number)) ?? null,
      }
    })
  } else if (jQuali?.length) {
    rows = jQuali.map((r) => {
      const q = [parseClock(r.Q1), parseClock(r.Q2), parseClock(r.Q3)]
      const valid = q.filter((x): x is number => x !== null)
      return {
        position: Number(r.position),
        driverNumber: Number(r.number),
        status: 'finished',
        statusText: null,
        laps: laps[Number(r.number)]?.length ?? null,
        points: null,
        time: valid.length ? Math.min(...valid) : null,
        gap: null,
        q,
        grid: null,
        bestLap: best.get(Number(r.number)) ?? null,
      }
    })
  } else {
    // Practice / testing without a classification: order by best lap.
    const ordered = [...best.entries()].sort((a, b) => a[1] - b[1])
    const top = ordered[0]?.[1]
    rows = ordered.map(([drv, t], i) => ({
      position: i + 1,
      driverNumber: drv,
      status: 'finished',
      statusText: null,
      laps: laps[drv]?.length ?? null,
      points: null,
      time: t,
      gap: i === 0 ? 0 : round3(t - top),
      q: null,
      grid: null,
      bestLap: t,
    }))
  }

  return rows.sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || (b.laps ?? 0) - (a.laps ?? 0))
}

function buildNeutralizations(rc: OF1RaceControl[], totalLaps: number): Neutralization[] {
  const out: Neutralization[] = []
  const open: Partial<Record<Neutralization['type'], number>> = {}
  const start = (type: Neutralization['type'], lap: number) => {
    if (open[type] === undefined) open[type] = lap
  }
  const end = (type: Neutralization['type'], lap: number) => {
    const s = open[type]
    if (s === undefined) return
    out.push({ type, lapStart: s, lapEnd: Math.max(s, lap) })
    delete open[type]
  }
  for (const m of [...rc].sort((a, b) => a.date.localeCompare(b.date))) {
    const lap = m.lap_number ?? 1
    const msg = m.message.toUpperCase()
    if (m.flag === 'RED') start('RED', lap)
    else if (open.RED !== undefined && (m.flag === 'GREEN' || msg.includes('RESUME'))) end('RED', lap)
    if (m.category !== 'SafetyCar') continue
    const virtual = msg.includes('VSC') || msg.includes('VIRTUAL')
    if (msg.includes('DEPLOYED')) start(virtual ? 'VSC' : 'SC', lap)
    else if (virtual && msg.includes('ENDING')) end('VSC', lap)
    else if (!virtual && (msg.includes('IN THIS LAP') || msg.includes('ENDING'))) end('SC', lap)
  }
  for (const [type, s] of Object.entries(open)) out.push({ type: type as Neutralization['type'], lapStart: s, lapEnd: totalLaps || s })
  return out.sort((a, b) => a.lapStart - b.lapStart)
}

function lapAt(laps: LapRow[] | undefined, at: number): number | null {
  if (!laps) return null
  let found: number | null = null
  for (const l of laps) {
    if (l.at !== null && l.at <= at) found = l.n
    else if (l.at !== null) break
  }
  return found
}

export function buildBundle(
  session: SessionSummary,
  meeting: Omit<MeetingSummary, 'sessions'>,
  raw: RawSessionData,
  sources: Partial<Record<DatasetName, DatasetStatus>>,
): UnversionedBundle {
  const sessionStart = Date.parse(session.dateStart)
  const drivers = buildDrivers(raw.drivers, raw.jolpica)
  const laps = buildLaps(raw.laps, sessionStart)
  const results = buildResults(session.kind, raw.session_result, raw.jolpica, laps)

  const maxLap = Math.max(0, ...Object.values(laps).flatMap((l) => l.map((x) => x.n)))
  const totalLaps = isRaceLike(session.kind) ? Math.max(results[0]?.laps ?? 0, 0) || maxLap : maxLap

  const { positions, gaps } = isRaceLike(session.kind) ? buildLapPositions(laps, totalLaps) : { positions: {}, gaps: {} }

  let fastestLap: FastestLap | null = null
  for (const [drv, list] of Object.entries(laps))
    for (const l of list)
      if (l.t !== null && (!fastestLap || l.t < fastestLap.time)) fastestLap = { driverNumber: Number(drv), lap: l.n, time: l.t }

  const stints: Stint[] = raw.stints
    .filter((s) => s.lap_start !== null)
    .map((s) => ({
      driverNumber: s.driver_number,
      stint: s.stint_number,
      compound: normaliseCompound(s.compound),
      lapStart: s.lap_start!,
      lapEnd: s.lap_end ?? (Math.max(s.lap_start!, laps[s.driver_number]?.at(-1)?.n ?? totalLaps) || s.lap_start!),
      tyreAge: s.tyre_age_at_start ?? 0,
    }))
    .sort((a, b) => a.driverNumber - b.driverNumber || a.stint - b.stint)

  const overtakes: Overtake[] = raw.overtakes
    .map((o) => ({
      date: o.date,
      lap: lapAt(laps[o.overtaking_driver_number], (Date.parse(o.date) - sessionStart) / 1000),
      by: o.overtaking_driver_number,
      on: o.overtaken_driver_number,
      position: o.position,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    schema: 1,
    session,
    meeting,
    drivers,
    results,
    totalLaps,
    laps,
    positions,
    gaps,
    stints,
    pits: raw.pit
      .map((p) => ({
        driverNumber: p.driver_number,
        lap: p.lap_number,
        lane: num(p.lane_duration) ?? num(p.pit_duration),
        stop: num(p.stop_duration),
      }))
      .sort((a, b) => a.lap - b.lap || a.driverNumber - b.driverNumber),
    raceControl: raw.race_control
      .map((m) => ({
        date: m.date,
        lap: m.lap_number,
        category: m.category,
        flag: m.flag,
        scope: m.scope,
        sector: m.sector,
        driverNumber: m.driver_number,
        qualifyingPhase: m.qualifying_phase ?? null,
        message: m.message,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    weather: raw.weather
      // the feed occasionally emits all-zero glitch samples
      .filter((w) => !(w.air_temperature === 0 && w.humidity === 0))
      .map((w) => ({
        date: w.date,
        air: w.air_temperature,
        track: w.track_temperature,
        humidity: w.humidity,
        pressure: w.pressure,
        rain: Boolean(w.rainfall),
        windSpeed: w.wind_speed,
        windDir: w.wind_direction,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    overtakes,
    neutralizations: isRaceLike(session.kind) ? buildNeutralizations(raw.race_control, totalLaps) : [],
    fastestLap,
    sources,
  }
}

export function podiumOf(bundle: UnversionedBundle) {
  const byNumber = new Map(bundle.drivers.map((d) => [d.number, d]))
  return bundle.results
    .filter((r) => r.position !== null && r.position <= 3)
    .map((r) => {
      const d = byNumber.get(r.driverNumber)
      return {
        position: r.position!,
        driverNumber: r.driverNumber,
        acronym: d?.acronym ?? String(r.driverNumber),
        fullName: d?.fullName ?? '',
        teamName: d?.teamName ?? '',
        teamColour: d?.teamColour ?? '#7c7c86',
      }
    })
}
