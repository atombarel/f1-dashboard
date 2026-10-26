import { isQualiLike, isRaceLike } from '../../shared/sessions'
import { claimSession, claimTelemetry, countQueued, ingestCandidates, kvGet, MAX_ATTEMPTS, type Runner, telemetryCandidates, type SessionRow } from '../lib/db'
import type { Upstream } from '../upstream/openf1'
import { syncSeason } from './calendar'
import { refreshStandings } from './standings'
import type { IngestParams } from './workflow'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** Concurrent background workflows. User-triggered ones bypass this. */
const MAX_BACKGROUND = 3
/** Weekends fetched together by one backfill run. */
const MEETINGS_PER_BATCH = 6
const MAX_KEY_SPAN = 8
/**
 * Telemetry runs are ~45 requests each. OpenF1 throttles the Worker's IPs to a couple of large requests a
 * minute whatever the concurrency, so more jobs only make each one wait longer (4 hit the 10 min step timeout).
 */
const MAX_TELEMETRY = 2
/** Telemetry jobs run by the local helper, on top of the production ones (its own IP, its own OpenF1 quota). */
const MAX_LOCAL_TELEMETRY = 4

const runner = (env: Env): Runner => (env.RUNNER === 'local' ? 'local' : 'prod')

const currentYear = () => new Date().getUTCFullYear()

async function lastSync(env: Env, key: string): Promise<number> {
  const row = await kvGet(env.DB, key)
  return row ? Date.parse(row.updated_at) : 0
}

/** Recent sessions get everything; old ones only get telemetry where it is the most interesting. */
function wantsTelemetry(row: Pick<SessionRow, 'kind' | 'date_end'>, background: boolean) {
  if (row.kind === 'testing') return false
  if (!background) return true
  const recent = Date.now() - Date.parse(row.date_end) < 14 * DAY
  return recent || isRaceLike(row.kind) || isQualiLike(row.kind)
}

async function startWorkflow(env: Env, params: IngestParams) {
  const id = `s${params.sessionKey}-p${params.pass}${params.telemetryOnly ? '-tel' : ''}-${Date.now().toString(36)}`
  await env.INGEST.create({ id, params })
}

/** Called from the API when a visitor opens a session that has not been ingested yet. */
export async function requestIngestion(env: Env, row: SessionRow): Promise<boolean> {
  if (row.is_cancelled || Date.now() < Date.parse(row.date_end) + 10 * 60 * 1000) return false
  if (!(await claimSession(env.DB, row.session_key))) return false
  const pass = Date.now() - Date.parse(row.date_end) > 26 * HOUR ? 2 : 1
  await startWorkflow(env, { sessionKey: row.session_key, pass, telemetry: wantsTelemetry(row, false), priority: 'high' })
  return true
}

export async function requestTelemetry(env: Env, row: SessionRow): Promise<boolean> {
  if (!row.version || row.kind === 'testing') return false
  if (!(await claimTelemetry(env.DB, row.session_key, runner(env)))) return false
  await startWorkflow(env, { sessionKey: row.session_key, pass: row.ingest_pass === 2 ? 2 : 1, telemetry: true, telemetryOnly: true, priority: 'high' })
  return true
}

/** Every 10 minutes: keep the current calendar fresh and ingest whatever just finished. */
export async function tick(env: Env) {
  // the local helper only lends a hand with the telemetry backlog; the calendar stays production's job
  if (runner(env) === 'local') return pump(env)
  const up: Upstream = { env, priority: 'low' }
  const year = currentYear()
  const first = Number(env.FIRST_SEASON)

  // Calendar: hourly, every 10 min during a race weekend, plus any season never synced (bootstrap).
  const raceWeekend = await env.DB.prepare(
    `SELECT 1 FROM meetings WHERE date_start <= ?1 AND date_end >= ?2 AND is_testing = 0 LIMIT 1`,
  )
    .bind(new Date(Date.now() + DAY).toISOString(), new Date(Date.now() - DAY).toISOString())
    .first()
  if (Date.now() - (await lastSync(env, `calendar:${year}`)) > (raceWeekend ? 9 * 60 * 1000 : HOUR)) {
    await syncSeason(up, year)
  }
  for (let y = year - 1; y >= first; y--) {
    if (!(await kvGet(env.DB, `calendar:${y}`))) {
      await syncSeason(up, y)
      break // one season per tick, the backfill is not urgent
    }
  }

  await pump(env)
}

/**
 * Fill the background slots: first the base data of every finished session (cheap, makes the
 * site useful), then telemetry for the sessions where it matters most. Called by the cron and by
 * every background workflow when it finishes, so the backfill runs at the speed of the upstream
 * gate rather than at the cron cadence.
 */
export async function pump(env: Env) {
  if (runner(env) === 'local') return pumpTelemetry(env, MAX_LOCAL_TELEMETRY - (await countQueued(env.DB, 'local')))
  let slots = MAX_BACKGROUND - (await countQueued(env.DB, 'prod'))
  if (slots <= 0) return
  const candidates = await ingestCandidates(env.DB, 60)
  const meetings = new Map<number, typeof candidates>()
  for (const row of candidates) {
    if (slots <= 0) break
    const fresh = Date.now() - Date.parse(row.date_end) < 2 * DAY
    if (fresh) {
      // just finished: one fast, high-priority run per session with telemetry included
      if (!(await claimSession(env.DB, row.session_key))) continue
      slots--
      await startWorkflow(env, {
        sessionKey: row.session_key,
        pass: row.next_pass === 2 ? 2 : 1,
        telemetry: !row.telemetry_version && wantsTelemetry(row, true),
        priority: 'high',
      })
      continue
    }
    // backlog: batch whole weekends into one run
    if (!meetings.has(row.meeting_key)) meetings.set(row.meeting_key, [])
    meetings.get(row.meeting_key)!.push(row)
  }
  // Group neighbouring weekends of the same season (key range kept tight so payloads stay small).
  const batches: { year: number; keys: number[]; rows: typeof candidates }[] = []
  for (const [key, rows] of meetings) {
    const b = batches.find((x) => x.year === rows[0].year && x.keys.length < MEETINGS_PER_BATCH && Math.max(...x.keys, key) - Math.min(...x.keys, key) <= MAX_KEY_SPAN)
    if (b) {
      b.keys.push(key)
      b.rows.push(...rows)
    } else batches.push({ year: rows[0].year, keys: [key], rows: [...rows] })
  }
  for (const batch of batches) {
    if (slots <= 0) break
    const claimed: number[] = []
    const at = new Date().toISOString()
    for (const r of batch.rows) if (await claimSession(env.DB, r.session_key, undefined, at)) claimed.push(r.session_key)
    if (!claimed.length) continue
    slots--
    const pass = batch.rows.every((r) => r.next_pass === 2) ? 2 : 1
    await env.INGEST_MEETING.create({
      id: `m${batch.keys[0]}x${batch.keys.length}-p${pass}-${Date.now().toString(36)}`,
      params: { meetingKeys: batch.keys, sessionKeys: claimed, pass },
    })
  }
  if (slots <= 0 || (await ingestCandidates(env.DB, 1)).length) return
  await pumpTelemetry(env, Math.min(slots, MAX_TELEMETRY))
}

async function pumpTelemetry(env: Env, slots: number) {
  if (slots <= 0) return
  for (const row of await telemetryCandidates(env.DB, slots)) {
    if (!(await claimTelemetry(env.DB, row.session_key, runner(env)))) continue
    await startWorkflow(env, { sessionKey: row.session_key, pass: row.ingest_pass === 2 ? 2 : 1, telemetry: true, telemetryOnly: true, priority: 'low' })
  }
}

/** Nightly: refresh past calendars weekly and the current standings. */
export async function nightly(env: Env) {
  const up: Upstream = { env, priority: 'low' }
  const year = currentYear()
  for (let y = Number(env.FIRST_SEASON); y < year; y++) {
    if (Date.now() - (await lastSync(env, `calendar:${y}`)) > 7 * DAY) await syncSeason(up, y)
    if (!(await kvGet(env.DB, `standings:${y}`))) await refreshStandings(up, y)
  }
  // Sessions that exhausted their attempts get a fresh chance every few days (OpenF1 sometimes backfills late).
  await env.DB.prepare(`UPDATE sessions SET ingest_attempts = 0 WHERE ingest_state = 'error' AND ingest_attempts >= ?1 AND updated_at < ?2`)
    .bind(MAX_ATTEMPTS, new Date(Date.now() - 3 * DAY).toISOString())
    .run()
  // Early December the next season's calendar is usually published.
  if (new Date().getUTCMonth() >= 10) await syncSeason(up, year + 1).catch(() => undefined)
  await refreshStandings(up, year)
}
