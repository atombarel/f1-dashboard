import { isQualiLike, isRaceLike } from '../../shared/sessions'
import { claimSession, claimTelemetry, countQueued, ingestCandidates, kvGet, type SessionRow } from '../lib/db'
import type { Priority } from '../upstream/gate'
import type { Upstream } from '../upstream/openf1'
import { syncSeason } from './calendar'
import { refreshStandings } from './standings'
import type { IngestParams } from './workflow'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** Concurrent background workflows. User-triggered ones bypass this. */
const MAX_BACKGROUND = 3

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

  // Ingestion
  const queued = await countQueued(env.DB)
  const slots = MAX_BACKGROUND - queued
  if (slots <= 0) return
  for (const row of await ingestCandidates(env.DB, slots)) {
    if (!(await claimSession(env.DB, row.session_key))) continue
    const fresh = Date.now() - Date.parse(row.date_end) < 2 * DAY
    const priority: Priority = fresh ? 'high' : 'low'
    await startWorkflow(env, {
      sessionKey: row.session_key,
      pass: row.next_pass === 2 ? 2 : 1,
      telemetry: !row.telemetry_version && wantsTelemetry(row, true),
      priority,
    })
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
  // Early December the next season's calendar is usually published.
  if (new Date().getUTCMonth() >= 10) await syncSeason(up, year + 1).catch(() => undefined)
  await refreshStandings(up, year)
}
