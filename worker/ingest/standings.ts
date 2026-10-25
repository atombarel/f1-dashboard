import type { Driver, SessionBundle, StandingsResponse } from '../../shared/types'
import { kvGet, kvSet, type SessionRow } from '../lib/db'
import { contentHash, getJson, keys, putJson } from '../lib/store'
import { jolpica, type JRace, type JRaceTable, type JStandingsTable, type Upstream } from '../upstream/openf1'
import { teamColour } from './bundle'

async function allRaces(up: Upstream, path: string): Promise<JRace[]> {
  const out: JRace[] = []
  for (let offset = 0; offset < 2000; offset += 100) {
    const page = await jolpica<JRaceTable>(up, path, { limit: 100, offset })
    // Jolpica paginates over result rows, so the same race can straddle two pages.
    for (const race of page.RaceTable.Races) {
      const prev = out.find((r) => r.round === race.round)
      if (prev) {
        prev.Results = [...(prev.Results ?? []), ...(race.Results ?? [])]
        prev.SprintResults = [...(prev.SprintResults ?? []), ...(race.SprintResults ?? [])]
      } else out.push(race)
    }
    if (offset + 100 >= Number(page.total)) break
  }
  return out
}

/** Driver colours and headshots come from the most recent ingested race of the season. */
async function latestDrivers(env: Env, year: number): Promise<Driver[]> {
  const row = await env.DB.prepare(
    `SELECT * FROM sessions WHERE year = ? AND kind IN ('race', 'sprint') AND version IS NOT NULL ORDER BY date_start DESC LIMIT 1`,
  )
    .bind(year)
    .first<SessionRow>()
  if (!row?.version) return []
  const bundle = await getJson<SessionBundle>(env.BUNDLES, keys.bundle(row.session_key, row.version))
  return bundle?.drivers ?? []
}

export async function buildStandings(up: Upstream, year: number): Promise<StandingsResponse> {
  const [drv, cons, results, sprints, drivers] = await Promise.all([
    jolpica<JStandingsTable>(up, `${year}/driverstandings`, { limit: 100 }),
    jolpica<JStandingsTable>(up, `${year}/constructorstandings`, { limit: 100 }),
    allRaces(up, `${year}/results`),
    allRaces(up, `${year}/sprint`),
    latestDrivers(up.env, year),
  ])
  const byNumber = new Map(drivers.map((d) => [d.number, d]))

  // Car number actually raced (can differ from permanentNumber, e.g. #1 for the champion).
  const raceNumber = new Map<string, number>()
  const teamOf = new Map<string, string>()
  for (const race of results)
    for (const r of race.Results ?? []) {
      raceNumber.set(r.Driver.driverId, Number(r.number))
      teamOf.set(r.Driver.driverId, r.Constructor.constructorId)
    }
  const teamColours = new Map<string, string>()
  for (const [driverId, teamId] of teamOf) {
    const colour = byNumber.get(raceNumber.get(driverId) ?? -1)?.teamColour
    if (colour && !teamColours.has(teamId)) teamColours.set(teamId, colour)
  }

  const driverList = drv.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
  const teamList = cons.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []

  const rounds = results
    .map((r) => ({
      round: Number(r.round),
      name: r.raceName,
      countryCode: null as string | null,
      sprint: sprints.some((s) => s.round === r.round),
    }))
    .sort((a, b) => a.round - b.round)

  // Points scored per round (race + sprint), then accumulated into one series per driver / team.
  const perRound = rounds.map(({ round }) => {
    const d = new Map<string, number>()
    const t = new Map<string, number>()
    const rows = [
      ...(results.find((r) => Number(r.round) === round)?.Results ?? []),
      ...(sprints.find((r) => Number(r.round) === round)?.SprintResults ?? []),
    ]
    for (const r of rows) {
      d.set(r.Driver.driverId, (d.get(r.Driver.driverId) ?? 0) + Number(r.points))
      t.set(r.Constructor.constructorId, (t.get(r.Constructor.constructorId) ?? 0) + Number(r.points))
    }
    return { d, t }
  })
  const accumulate = (pick: (x: (typeof perRound)[number]) => Map<string, number>) => {
    const ids = new Set(perRound.flatMap((x) => [...pick(x).keys()]))
    const out: Record<string, number[]> = {}
    for (const id of ids) {
      let total = 0
      out[id] = perRound.map((x) => (total += pick(x).get(id) ?? 0))
    }
    return out
  }
  const progression: StandingsResponse['progression'] = {
    rounds,
    drivers: accumulate((x) => x.d),
    teams: accumulate((x) => x.t),
  }

  return {
    year,
    round: Number(drv.StandingsTable.StandingsLists[0]?.round ?? rounds.at(-1)?.round ?? 0),
    drivers: driverList.map((d, i) => {
      const team = d.Constructors.at(-1)
      const number = raceNumber.get(d.Driver.driverId) ?? (Number(d.Driver.permanentNumber) || null)
      const od = number !== null ? byNumber.get(number) : undefined
      return {
        position: Number(d.position ?? i + 1),
        points: Number(d.points),
        wins: Number(d.wins),
        driverId: d.Driver.driverId,
        code: d.Driver.code ?? d.Driver.familyName.slice(0, 3).toUpperCase(),
        number,
        givenName: d.Driver.givenName,
        familyName: d.Driver.familyName,
        nationality: d.Driver.nationality,
        teamId: team?.constructorId ?? '',
        teamName: team?.name ?? '',
        teamColour: od?.teamColour ?? teamColours.get(team?.constructorId ?? '') ?? teamColour(null),
        headshot: od?.headshot ?? null,
      }
    }),
    teams: teamList.map((t, i) => ({
      position: Number(t.position ?? i + 1),
      points: Number(t.points),
      wins: Number(t.wins),
      teamId: t.Constructor.constructorId,
      name: t.Constructor.name,
      nationality: t.Constructor.nationality,
      teamColour: teamColours.get(t.Constructor.constructorId) ?? teamColour(null),
    })),
    progression,
    generatedAt: new Date().toISOString(),
  }
}

export async function refreshStandings(up: Upstream, year: number): Promise<string> {
  const standings = await buildStandings(up, year)
  const { generatedAt: _, ...stable } = standings
  const version = await contentHash(stable)
  await putJson(up.env.BUNDLES, keys.standings(year, version), standings)
  await kvSet(up.env.DB, `standings:${year}`, version)
  return version
}

export async function readStandings(env: Env, year: number): Promise<StandingsResponse | null> {
  const v = await kvGet(env.DB, `standings:${year}`)
  return v ? getJson<StandingsResponse>(env.BUNDLES, keys.standings(year, v.value)) : null
}
