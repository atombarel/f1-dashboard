import { timeStatus } from '../../shared/sessions'
import type { MeetingSummary, PodiumEntry, SessionKind, SessionStatus, SessionSummary } from '../../shared/types'

export interface MeetingRow {
  meeting_key: number
  year: number
  round: number | null
  name: string
  official_name: string | null
  location: string | null
  country_code: string | null
  country_name: string | null
  country_flag: string | null
  circuit_key: number | null
  circuit_name: string | null
  circuit_image: string | null
  gmt_offset: string | null
  date_start: string
  date_end: string
  is_cancelled: number
  is_testing: number
}

export interface SessionRow {
  session_key: number
  meeting_key: number
  year: number
  name: string
  type: string
  kind: SessionKind
  date_start: string
  date_end: string
  is_cancelled: number
  ingest_state: 'pending' | 'queued' | 'done' | 'error'
  ingest_pass: number
  ingest_attempts: number
  ingest_error: string | null
  queued_at: string | null
  ingested_at: string | null
  version: string | null
  telemetry_state: 'none' | 'queued' | 'done' | 'error'
  telemetry_version: string | null
  podium: string | null
}

/** Delay after the end of a session before OpenF1 data is considered complete enough. */
export const FIRST_PASS_DELAY_MS = 40 * 60 * 1000
/** Second pass picks up stewards' decisions and late corrections. */
export const FINAL_PASS_DELAY_MS = 26 * 60 * 60 * 1000
export const MAX_ATTEMPTS = 6

const now = () => new Date().toISOString()

export function sessionStatus(row: SessionRow, at = Date.now()): SessionStatus {
  if (row.is_cancelled) return 'cancelled'
  if (row.version) return 'final'
  return timeStatus(row.date_start, row.date_end, at)
}

export function toSessionSummary(row: SessionRow, at = Date.now()): SessionSummary {
  return {
    key: row.session_key,
    meetingKey: row.meeting_key,
    name: row.name,
    type: row.type,
    kind: row.kind,
    dateStart: row.date_start,
    dateEnd: row.date_end,
    status: sessionStatus(row, at),
    version: row.version,
    telemetryVersion: row.telemetry_version,
    podium: row.podium ? (JSON.parse(row.podium) as PodiumEntry[]) : null,
  }
}

export function toMeetingSummary(row: MeetingRow, sessions: SessionRow[], at = Date.now()): MeetingSummary {
  return {
    key: row.meeting_key,
    year: row.year,
    round: row.round,
    name: row.name,
    officialName: row.official_name ?? row.name,
    location: row.location ?? '',
    countryCode: row.country_code ?? '',
    countryName: row.country_name ?? '',
    countryFlag: row.country_flag,
    circuitKey: row.circuit_key ?? 0,
    circuitName: row.circuit_name ?? '',
    circuitImage: row.circuit_image,
    gmtOffset: row.gmt_offset ?? '00:00:00',
    dateStart: row.date_start,
    dateEnd: row.date_end,
    isCancelled: Boolean(row.is_cancelled),
    isTesting: Boolean(row.is_testing),
    sessions: sessions
      .filter((s) => s.meeting_key === row.meeting_key)
      .sort((a, b) => a.date_start.localeCompare(b.date_start))
      .map((s) => toSessionSummary(s, at)),
  }
}

export async function listYears(db: D1Database): Promise<number[]> {
  const { results } = await db.prepare('SELECT DISTINCT year FROM meetings ORDER BY year DESC').all<{ year: number }>()
  return results.map((r) => r.year)
}

export async function getSeasonMeetings(db: D1Database, year: number): Promise<MeetingSummary[]> {
  const [meetings, sessions] = await db.batch([
    db.prepare('SELECT * FROM meetings WHERE year = ? ORDER BY date_start').bind(year),
    db.prepare('SELECT * FROM sessions WHERE year = ? ORDER BY date_start').bind(year),
  ])
  const s = sessions.results as unknown as SessionRow[]
  return (meetings.results as unknown as MeetingRow[]).map((m) => toMeetingSummary(m, s))
}

export async function getMeeting(db: D1Database, key: number): Promise<MeetingSummary | null> {
  const [meetings, sessions] = await db.batch([
    db.prepare('SELECT * FROM meetings WHERE meeting_key = ?').bind(key),
    db.prepare('SELECT * FROM sessions WHERE meeting_key = ?').bind(key),
  ])
  const m = meetings.results[0] as unknown as MeetingRow | undefined
  return m ? toMeetingSummary(m, sessions.results as unknown as SessionRow[]) : null
}

export async function getSessionRow(db: D1Database, key: number) {
  return db.prepare('SELECT * FROM sessions WHERE session_key = ?').bind(key).first<SessionRow>()
}

export async function getMeetingRow(db: D1Database, key: number) {
  return db.prepare('SELECT * FROM meetings WHERE meeting_key = ?').bind(key).first<MeetingRow>()
}

export async function upsertMeetings(db: D1Database, rows: MeetingRow[]) {
  if (!rows.length) return
  const ts = now()
  const stmt = db.prepare(`
    INSERT INTO meetings (meeting_key, year, round, name, official_name, location, country_code, country_name, country_flag,
      circuit_key, circuit_name, circuit_image, gmt_offset, date_start, date_end, is_cancelled, is_testing, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
    ON CONFLICT (meeting_key) DO UPDATE SET
      year = excluded.year, round = excluded.round, name = excluded.name, official_name = excluded.official_name,
      location = excluded.location, country_code = excluded.country_code, country_name = excluded.country_name,
      country_flag = excluded.country_flag, circuit_key = excluded.circuit_key, circuit_name = excluded.circuit_name,
      circuit_image = excluded.circuit_image, gmt_offset = excluded.gmt_offset, date_start = excluded.date_start,
      date_end = excluded.date_end, is_cancelled = excluded.is_cancelled, is_testing = excluded.is_testing,
      updated_at = excluded.updated_at`)
  await db.batch(
    rows.map((r) =>
      stmt.bind(
        r.meeting_key, r.year, r.round, r.name, r.official_name, r.location, r.country_code, r.country_name, r.country_flag,
        r.circuit_key, r.circuit_name, r.circuit_image, r.gmt_offset, r.date_start, r.date_end, r.is_cancelled, r.is_testing, ts,
      ),
    ),
  )
}

export type SessionCalendarRow = Pick<
  SessionRow,
  'session_key' | 'meeting_key' | 'year' | 'name' | 'type' | 'kind' | 'date_start' | 'date_end' | 'is_cancelled'
>

/** Calendar fields only — never touches the ingestion state. */
export async function upsertSessions(db: D1Database, rows: SessionCalendarRow[]) {
  if (!rows.length) return
  const ts = now()
  const stmt = db.prepare(`
    INSERT INTO sessions (session_key, meeting_key, year, name, type, kind, date_start, date_end, is_cancelled, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    ON CONFLICT (session_key) DO UPDATE SET
      meeting_key = excluded.meeting_key, year = excluded.year, name = excluded.name, type = excluded.type,
      kind = excluded.kind, date_start = excluded.date_start, date_end = excluded.date_end,
      is_cancelled = excluded.is_cancelled, updated_at = excluded.updated_at`)
  await db.batch(
    rows.map((r) =>
      stmt.bind(r.session_key, r.meeting_key, r.year, r.name, r.type, r.kind, r.date_start, r.date_end, r.is_cancelled, ts),
    ),
  )
}

/**
 * Atomically claim a session for ingestion. Refused when it is already queued, was attempted
 * less than RETRY_GAP ago (so visitors hitting an errored session don't spawn a workflow each),
 * or ran out of attempts.
 */
export const RETRY_GAP_MS = 8 * 60 * 1000
/** `at` lets a batch share one queued_at, which is how running batches are counted. */
export async function claimSession(db: D1Database, key: number, staleAfterMs = 30 * 60 * 1000, at = now()): Promise<boolean> {
  const staleBefore = new Date(Date.now() - staleAfterMs).toISOString()
  const retryBefore = new Date(Date.now() - RETRY_GAP_MS).toISOString()
  const res = await db
    .prepare(
      `UPDATE sessions SET ingest_state = 'queued', queued_at = ?1, ingest_attempts = ingest_attempts + 1, updated_at = ?1
       WHERE session_key = ?2 AND ingest_attempts < ?5
         AND (queued_at IS NULL OR queued_at < ?4)
         AND (ingest_state != 'queued' OR queued_at < ?3)`,
    )
    .bind(at, key, staleBefore, retryBefore, MAX_ATTEMPTS)
    .run()
  return res.meta.changes > 0
}

/** A telemetry run can take a while when the upstream throttles: give it time before calling it stale. */
const TELEMETRY_STALE_MS = 2 * 60 * 60 * 1000

/** Who runs a telemetry job: the production Worker, or the local helper (`npm run backfill:local`). */
export type Runner = 'prod' | 'local'

export async function claimTelemetry(db: D1Database, key: number, runner: Runner): Promise<boolean> {
  const staleBefore = new Date(Date.now() - TELEMETRY_STALE_MS).toISOString()
  const at = now()
  const res = await db
    .prepare(
      `UPDATE sessions SET telemetry_state = 'queued', telemetry_runner = ?4, telemetry_claimed_at = ?1, updated_at = ?1
       WHERE session_key = ?2 AND telemetry_state != 'done'
         AND (telemetry_state != 'queued' OR COALESCE(telemetry_claimed_at, updated_at) < ?3)`,
    )
    .bind(at, key, staleBefore, runner)
    .run()
  return res.meta.changes > 0
}

export async function markIngested(db: D1Database, key: number, pass: number, version: string, podium: PodiumEntry[]) {
  await db
    .prepare(
      `UPDATE sessions SET ingest_state = 'done', ingest_pass = MAX(ingest_pass, ?1), version = ?2, podium = ?3,
         ingest_error = NULL, ingested_at = ?4, updated_at = ?4 WHERE session_key = ?5`,
    )
    .bind(pass, version, podium.length ? JSON.stringify(podium) : null, now(), key)
    .run()
}

export async function markIngestError(db: D1Database, key: number, error: string) {
  await db
    .prepare(`UPDATE sessions SET ingest_state = 'error', ingest_error = ?1, updated_at = ?2 WHERE session_key = ?3`)
    .bind(error.slice(0, 500), now(), key)
    .run()
}

export async function markTelemetry(db: D1Database, key: number, state: SessionRow['telemetry_state'], version: string | null) {
  await db
    .prepare(`UPDATE sessions SET telemetry_state = ?1, telemetry_version = COALESCE(?2, telemetry_version), updated_at = ?3 WHERE session_key = ?4`)
    .bind(state, version, now(), key)
    .run()
}

/**
 * Sessions due for ingestion, most recent first:
 *  - pass 0 → 1 once the session ended FIRST_PASS_DELAY ago
 *  - pass 1 → 2 once it ended FINAL_PASS_DELAY ago
 * Old sessions (backfill) go straight to the final pass.
 */
export async function ingestCandidates(db: D1Database, limit: number, at = Date.now()): Promise<(SessionRow & { next_pass: number })[]> {
  const first = new Date(at - FIRST_PASS_DELAY_MS).toISOString()
  const final = new Date(at - FINAL_PASS_DELAY_MS).toISOString()
  const staleQueue = new Date(at - 30 * 60 * 1000).toISOString()
  const { results } = await db
    .prepare(
      `SELECT *, CASE WHEN date_end < ?4 THEN 2 ELSE 1 END AS next_pass FROM sessions
       WHERE is_cancelled = 0 AND ingest_attempts < ?1
         AND (ingest_state != 'queued' OR queued_at < ?2)
         AND ((ingest_pass = 0 AND date_end < ?3) OR (ingest_pass = 1 AND date_end < ?4))
       ORDER BY date_end DESC LIMIT ?5`,
    )
    .bind(MAX_ATTEMPTS, staleQueue, first, final, limit)
    .all<SessionRow & { next_pass: number }>()
  return results
}

/** Running background jobs of one runner (the local helper only runs telemetry). */
export async function countQueued(db: D1Database, runner: Runner): Promise<number> {
  const staleQueue = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const staleTelemetry = new Date(Date.now() - TELEMETRY_STALE_MS).toISOString()
  const row = await db
    // one slot per running batch (sessions claimed together share their queued_at) plus one per telemetry job
    .prepare(`SELECT
         CASE WHEN ?3 = 'prod' THEN COUNT(DISTINCT CASE WHEN ingest_state = 'queued' AND queued_at >= ?1 THEN queued_at END) ELSE 0 END
       + COUNT(CASE WHEN telemetry_state = 'queued' AND COALESCE(telemetry_runner, 'prod') = ?3
                     AND COALESCE(telemetry_claimed_at, updated_at) >= ?2 THEN 1 END) AS n
       FROM sessions`)
    .bind(staleQueue, staleTelemetry, runner)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/** Ingested sessions still missing telemetry, most interesting first (races, then qualifying), newest first. */
export async function telemetryCandidates(db: D1Database, limit: number): Promise<SessionRow[]> {
  const staleBefore = new Date(Date.now() - TELEMETRY_STALE_MS).toISOString()
  const { results } = await db
    .prepare(
      `SELECT * FROM sessions
       WHERE version IS NOT NULL AND telemetry_version IS NULL AND kind != 'testing'
         AND (telemetry_state IN ('none', 'error') OR (telemetry_state = 'queued' AND COALESCE(telemetry_claimed_at, updated_at) < ?2))
       ORDER BY CASE kind WHEN 'race' THEN 0 WHEN 'qualifying' THEN 1 WHEN 'sprint' THEN 2 WHEN 'sprint_qualifying' THEN 3 ELSE 4 END,
                date_end DESC
       LIMIT ?1`,
    )
    .bind(limit, staleBefore)
    .all<SessionRow>()
  return results
}

export async function kvGet(db: D1Database, key: string): Promise<{ value: string; updated_at: string } | null> {
  return db.prepare('SELECT value, updated_at FROM kv WHERE key = ?').bind(key).first()
}

export async function kvSet(db: D1Database, key: string, value: string) {
  await db
    .prepare('INSERT INTO kv (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .bind(key, value, now())
    .run()
}
