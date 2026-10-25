import { isQualiLike, isRaceLike } from '../../shared/sessions'
import { claimSession, claimTelemetry, countQueued, ingestCandidates, kvGet, MAX_ATTEMPTS, telemetryCandidates, type SessionRow } from '../lib/db'
import type { Upstream } from '../upstream/openf1'
import { syncSeason } from './calendar'
import { refreshStandings } from './standings'
import type { IngestParams } from './workflow'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** Concurrent background workflows. User-triggered ones bypass this. */
const MAX_BACKGROUND = 4
/** Telemetry runs are ~45 requests each: keep them from starving the base backfill. */
const MAX_TELEMETRY = 2

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
  if (!(await claimTelemetry(env.DB, row.session_key))) return false
  await startWorkflow(env, { sessionKey: row.session_key, pass: row.ingest_pass === 2 ? 2 : 1, telemetry: true, telemetryOnly: true, priority: 'high' })
  return true
}

/** Every 10 minutes: keep the current calendar fresh and ingest whatever just finished. */
export async function tick(env: Env) {
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
  let slots = MAX_BACKGROUND - (await countQueued(env.DB))
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
    // backlog: batch the whole weekend into one run
    if (!meetings.has(row.meeting_key)) {
      if (meetings.size >= slots) continue
      meetings.set(row.meeting_key, [])
    }
    meetings.get(row.meeting_key)!.push(row)
  }
  for (const [meetingKey, rows] of meetings) {
    const claimed: number[] = []
    for (const r of rows) if (await claimSession(env.DB, r.session_key)) claimed.push(r.session_key)
    if (!claimed.length) continue
    slots--
    const pass = rows.every((r) => r.next_pass === 2) ? 2 : 1
    await env.INGEST_MEETING.create({
      id: `m${meetingKey}-p${pass}-${Date.now().toString(36)}`,
      params: { meetingKey, sessionKeys: claimed, pass },
    })
  }
  if (slots <= 0 || (await ingestCandidates(env.DB, 1)).length) return
  for (const row of await telemetryCandidates(env.DB, Math.min(slots, MAX_TELEMETRY))) {
    if (!(await claimTelemetry(env.DB, row.session_key))) continue
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
