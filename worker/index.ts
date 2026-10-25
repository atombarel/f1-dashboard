import { Hono } from 'hono'
import type { HomeResponse, MeetingSummary, SessionMeta, SessionSummary } from '../shared/types'
import { syncSeason } from './ingest/calendar'
import { nightly, requestIngestion, requestTelemetry, tick } from './ingest/scheduler'
import { readStandings, refreshStandings } from './ingest/standings'
import { getMeeting, getSeasonMeetings, getSessionRow, listYears, MAX_ATTEMPTS, toSessionSummary, type SessionRow } from './lib/db'
import { edgeCache, IMMUTABLE, json, NO_STORE, r2Gzip, shortLived } from './lib/http'
import { keys } from './lib/store'

export { UpstreamGate } from './upstream/gate'
export { IngestSessionWorkflow } from './ingest/workflow'

type App = { Bindings: Env }
const app = new Hono<App>().basePath('/api')

const intParam = (v: string | undefined) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Shorter caches while something is happening on track; past seasons barely change. */
function calendarCache(meetings: MeetingSummary[]) {
  const now = Date.now()
  if (meetings.every((m) => Date.parse(m.dateEnd) < now - 7 * 86400_000)) return shortLived(3600, 86400)
  const active = meetings.some((m) =>
    m.sessions.some((s) => {
      const start = Date.parse(s.dateStart)
      const end = Date.parse(s.dateEnd)
      return now > start - 60 * 60 * 1000 && now < end + 6 * 60 * 60 * 1000
    }),
  )
  return active ? shortLived(30, 30, 60) : shortLived(60, 120)
}

app.use('*', edgeCache)

app.get('/health', (c) => json(c, { ok: true, time: new Date().toISOString() }, NO_STORE))

app.get('/seasons/:year', async (c) => {
  const year = intParam(c.req.param('year'))
  if (!year) return c.json({ error: 'bad year' }, 400)
  const [meetings, seasons] = await Promise.all([getSeasonMeetings(c.env.DB, year), listYears(c.env.DB)])
  if (!meetings.length) return json(c, { error: 'season not available yet', seasons }, shortLived(60), 200)
  return json(c, { year, seasons, meetings, generatedAt: new Date().toISOString() }, calendarCache(meetings))
})

app.get('/meetings/:key', async (c) => {
  const key = intParam(c.req.param('key'))
  const meeting = key ? await getMeeting(c.env.DB, key) : null
  if (!meeting) return c.json({ error: 'meeting not found' }, 404)
  return json(c, { meeting, generatedAt: new Date().toISOString() }, calendarCache([meeting]))
})

function sessionMeta(row: SessionRow, meeting: MeetingSummary, session: SessionSummary): SessionMeta {
  const { sessions: _, ...m } = meeting
  const base = `/api/sessions/${row.session_key}`
  return {
    session,
    meeting: m,
    bundleUrl: row.version ? `${base}/bundle?v=${row.version}` : null,
    telemetryUrl: row.telemetry_version ? `${base}/telemetry/{driver}?v=${row.telemetry_version}` : null,
    replayUrl: row.telemetry_version && (row.kind === 'race' || row.kind === 'sprint') ? `${base}/replay?v=${row.telemetry_version}` : null,
    circuitUrl: meeting.circuitKey ? `/api/circuits/${meeting.circuitKey}/${meeting.year}` : null,
    retryAfter: session.status === 'processing' ? 4 : session.status === 'live' ? 60 : null,
    unavailable: !row.version && row.ingest_state === 'error' && row.ingest_attempts >= MAX_ATTEMPTS,
  }
}

app.get('/sessions/:key', async (c) => {
  const key = intParam(c.req.param('key'))
  const row = key ? await getSessionRow(c.env.DB, key) : null
  if (!row) return c.json({ error: 'session not found' }, 404)
  const meeting = (await getMeeting(c.env.DB, row.meeting_key))!
  const session = toSessionSummary(row)
  // First visitor on a finished but not yet ingested session kicks off the ingestion.
  if (session.status === 'processing') c.executionCtx.waitUntil(requestIngestion(c.env, row).catch(console.error))
  const meta = sessionMeta(row, meeting, session)
  // Pointers that are about to change (telemetry still being built) must not be served stale.
  const settled = session.status === 'final' && (meta.telemetryUrl || row.kind === 'testing')
  const cc = settled ? shortLived(300, 3600) : session.status === 'final' ? shortLived(10, 15, 0) : NO_STORE
  return json(c, meta, cc)
})

app.get('/sessions/:key/bundle', async (c) => {
  const key = intParam(c.req.param('key'))
  const v = c.req.query('v')
  const row = key ? await getSessionRow(c.env.DB, key) : null
  const version = v ?? row?.version
  if (!key || !version) return c.json({ error: 'bundle not available' }, 404)
  const res = await r2Gzip(c, c.env.BUNDLES, keys.bundle(key, version), v ? IMMUTABLE : shortLived(60))
  return res ?? c.json({ error: 'bundle not found' }, 404)
})

app.get('/sessions/:key/telemetry/:driver', async (c) => {
  const key = intParam(c.req.param('key'))
  const driver = intParam(c.req.param('driver'))
  const v = c.req.query('v')
  if (!key || !driver) return c.json({ error: 'bad request' }, 400)
  if (v) {
    const res = await r2Gzip(c, c.env.BUNDLES, keys.telemetry(key, v, driver), IMMUTABLE)
    if (res) return res
    return c.json({ error: 'no telemetry for this driver' }, 404)
  }
  const row = await getSessionRow(c.env.DB, key)
  if (!row) return c.json({ error: 'session not found' }, 404)
  if (row.telemetry_version) return c.redirect(`/api/sessions/${key}/telemetry/${driver}?v=${row.telemetry_version}`, 302)
  c.executionCtx.waitUntil(requestTelemetry(c.env, row).catch(console.error))
  return json(c, { status: 'processing', retryAfter: 10 }, NO_STORE, 202)
})

app.get('/sessions/:key/replay', async (c) => {
  const key = intParam(c.req.param('key'))
  const v = c.req.query('v')
  if (!key || !v) return c.json({ error: 'bad request' }, 400)
  const res = await r2Gzip(c, c.env.BUNDLES, keys.replay(key, v), IMMUTABLE)
  return res ?? c.json({ error: 'no replay for this session' }, 404)
})

app.get('/circuits/:circuit/:year', async (c) => {
  const circuit = intParam(c.req.param('circuit'))
  const year = intParam(c.req.param('year'))
  if (!circuit || !year) return c.json({ error: 'bad request' }, 400)
  const res = await r2Gzip(c, c.env.BUNDLES, keys.circuit(circuit, year), shortLived(86400, 86400 * 7))
  return res ?? c.json({ error: 'no layout' }, 404)
})

app.get('/standings/:year', async (c) => {
  const year = intParam(c.req.param('year'))
  if (!year) return c.json({ error: 'bad year' }, 400)
  let standings = await readStandings(c.env, year)
  if (!standings) {
    try {
      await refreshStandings({ env: c.env, priority: 'high' }, year)
      standings = await readStandings(c.env, year)
    } catch (err) {
      console.error(err)
    }
  }
  if (!standings) return c.json({ error: 'standings not available' }, 404)
  const past = year < new Date().getUTCFullYear()
  return json(c, standings, past ? shortLived(86400, 86400 * 7) : shortLived(300, 900))
})

app.get('/home', async (c) => {
  const now = Date.now()
  let year = new Date().getUTCFullYear()
  let meetings = await getSeasonMeetings(c.env.DB, year)
  if (!meetings.length) {
    const years = await listYears(c.env.DB)
    if (years.length) meetings = await getSeasonMeetings(c.env.DB, (year = years[0]))
  }
  const flat = meetings.flatMap((meeting) => meeting.sessions.map((session) => ({ meeting, session })))
  const live = flat.find((x) => x.session.status === 'live') ?? null
  const next = flat.find((x) => x.session.status === 'upcoming') ?? null
  const lastRace =
    [...flat].reverse().find((x) => x.session.kind === 'race' && (x.session.status === 'final' || x.session.status === 'processing')) ?? null
  const currentMeeting =
    meetings.find((m) => !m.isTesting && Date.parse(m.dateStart) - 4 * 86400_000 < now && Date.parse(m.dateEnd) + 86400_000 > now) ?? null
  const standings = await readStandings(c.env, year)
  const body: HomeResponse = {
    year,
    now: new Date(now).toISOString(),
    live,
    next,
    lastRace,
    currentMeeting,
    standings: standings ? { round: standings.round, drivers: standings.drivers, teams: standings.teams } : null,
    generatedAt: new Date().toISOString(),
  }
  return json(c, body, calendarCache(meetings))
})

// ---- admin (Authorization: Bearer $ADMIN_TOKEN) ----

const admin = new Hono<App>()
admin.use('*', async (c, next) => {
  if (!c.env.ADMIN_TOKEN || c.req.header('authorization') !== `Bearer ${c.env.ADMIN_TOKEN}`) return c.json({ error: 'unauthorized' }, 401)
  await next()
})
admin.post('/sync/:year', async (c) => {
  const year = intParam(c.req.param('year'))!
  return c.json(await syncSeason({ env: c.env, priority: 'high' }, year))
})
admin.post('/tick', async (c) => {
  await tick(c.env)
  return c.json({ ok: true })
})
admin.post('/standings/:year', async (c) => {
  const version = await refreshStandings({ env: c.env, priority: 'high' }, intParam(c.req.param('year'))!)
  return c.json({ version })
})
admin.post('/ingest/:key', async (c) => {
  const row = await getSessionRow(c.env.DB, intParam(c.req.param('key'))!)
  if (!row) return c.json({ error: 'session not found' }, 404)
  // force: reset attempts and the queue claim
  await c.env.DB.prepare(
    `UPDATE sessions SET ingest_state = 'pending', ingest_attempts = 0, queued_at = NULL, telemetry_state = 'none', telemetry_version = NULL WHERE session_key = ?`,
  )
    .bind(row.session_key)
    .run()
  const started = await requestIngestion(c.env, { ...row, ingest_state: 'pending', ingest_attempts: 0, queued_at: null, telemetry_version: null })
  return c.json({ started })
})
admin.get('/status', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ingest_state, telemetry_state, COUNT(*) AS n FROM sessions GROUP BY ingest_state, telemetry_state`,
  ).all()
  const errors = await c.env.DB.prepare(
    `SELECT session_key, name, year, ingest_error, ingest_attempts FROM sessions WHERE ingest_state = 'error' ORDER BY date_end DESC LIMIT 20`,
  ).all()
  const gate = await c.env.GATE.get(c.env.GATE.idFromName('openf1')).queueDepth()
  return c.json({ states: results, errors: errors.results, openf1Queue: gate })
})
app.route('/admin', admin)

app.all('*', (c) => c.json({ error: 'not found' }, 404))

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(controller.cron === '30 4 * * *' ? nightly(env) : tick(env))
  },
} satisfies ExportedHandler<Env>
