import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import { packTelemetry } from '../../shared/codec'
import { isQualiLike, isRaceLike } from '../../shared/sessions'
import type { DatasetName, DatasetStatus, LapRow, SessionBundle } from '../../shared/types'
import {
  getMeetingRow,
  getSessionRow,
  markIngested,
  markIngestError,
  markTelemetry,
  toMeetingSummary,
  toSessionSummary,
  type SessionRow,
} from '../lib/db'
import { contentHash, getJson, keys, putJson } from '../lib/store'
import type { Priority } from '../upstream/gate'
import {
  jolpica,
  multiviewerCircuit,
  openf1,
  type JRace,
  type JRaceTable,
  type OF1CarData,
  type OF1Location,
  type Upstream,
} from '../upstream/openf1'
import { buildBundle, podiumOf, type RawSessionData } from './bundle'
import { pump } from './scheduler'
import { refreshStandings } from './standings'
import { assembleReplay, buildDriverTelemetry, compactLocation, resampleTrack, type CompactTrack } from './telemetry'

export interface IngestParams {
  sessionKey: number
  /** 1 = provisional (shortly after the flag), 2 = final (next day) */
  pass: 1 | 2
  /** Skip the base datasets and only (re)build telemetry. */
  telemetryOnly?: boolean
  telemetry: boolean
  priority: Priority
}

export const OPENF1_DATASETS = [
  'drivers',
  'laps',
  'stints',
  'pit',
  'race_control',
  'weather',
  'session_result',
  'position',
  'overtakes',
] as const satisfies readonly DatasetName[]

export const RETRY = { retries: { limit: 6, delay: '15 seconds', backoff: 'exponential' }, timeout: '10 minutes' } as const

/** Datasets that only exist for some session kinds — an empty answer there is not suspicious. */
export const OPTIONAL: Partial<Record<DatasetName, (row: SessionRow) => boolean>> = {
  position: (r) => !isRaceLike(r.kind),
  overtakes: (r) => !isRaceLike(r.kind),
  pit: () => true,
  session_result: (r) => r.kind === 'testing',
}

export class IngestSessionWorkflow extends WorkflowEntrypoint<Env, IngestParams> {
  async run(event: WorkflowEvent<IngestParams>, step: WorkflowStep) {
    const { sessionKey, pass, priority } = event.payload
    const run = event.instanceId.replace(/[^a-z0-9-]/gi, '').slice(-24)
    const up: Upstream = { env: this.env, priority }

    const ctx = await step.do('load context', async () => {
      const session = await getSessionRow(this.env.DB, sessionKey)
      if (!session) throw new Error(`unknown session ${sessionKey}`)
      const meeting = await getMeetingRow(this.env.DB, session.meeting_key)
      if (!meeting) throw new Error(`unknown meeting ${session.meeting_key}`)
      return { session, meeting }
    })

    let version = ctx.session.version
    try {
      if (!event.payload.telemetryOnly || !version) {
        version = await this.ingestBase(step, up, ctx, run, pass)
      }
    } catch (err) {
      await step.do('record failure', async () => {
        await markIngestError(this.env.DB, sessionKey, err instanceof Error ? err.message : String(err))
      })
      throw err
    }

    if (pass === 1 && isRaceLike(ctx.session.kind)) {
      // Standings are best effort: a Jolpica hiccup must not fail the session.
      await step.do('refresh standings', RETRY, async () => {
        await refreshStandings(up, ctx.session.year)
        return true
      }).catch(() => false)
    }

    await step.do('circuit layout', RETRY, async () => ensureCircuit(this.env, up, ctx.meeting, ctx.session.year))

    if (event.payload.telemetry && version && (event.payload.telemetryOnly || !ctx.session.telemetry_version)) {
      try {
        // Telemetry is heavy (2 requests per driver): only a visitor explicitly waiting for it gets the fast lane.
        const telemetryUp: Upstream = { env: this.env, priority: event.payload.telemetryOnly ? priority : 'low' }
        await this.ingestTelemetry(step, telemetryUp, ctx.session, version, run)
      } catch (err) {
        await step.do('record telemetry failure', async () => markTelemetry(this.env.DB, sessionKey, 'error', null))
        throw err
      }
    }

    await step.do('cleanup scratch', async () => {
      await clearScratch(this.env, sessionKey, run)
      return true
    })

    if (priority === 'low') {
      // background job done: start the next one right away instead of waiting for the cron
      await step.do('continue backfill', async () => {
        await pump(this.env)
        return true
      })
    }

    return { sessionKey, version }
  }

  private async ingestBase(
    step: WorkflowStep,
    up: Upstream,
    ctx: { session: SessionRow; meeting: Parameters<typeof toMeetingSummary>[0] },
    run: string,
    pass: 1 | 2,
  ): Promise<string> {
    const { session, meeting } = ctx
    const sources: Partial<Record<DatasetName, DatasetStatus>> = {}

    // One step per dataset: a failure only retries that request, the others are already checkpointed.
    for (const ds of OPENF1_DATASETS) {
      sources[ds] = await step.do(`fetch ${ds}`, RETRY, async () => {
        const rows = await openf1<unknown>(up, ds, { session_key: session.session_key })
        await putJson(this.env.BUNDLES, keys.scratch(session.session_key, run, ds), rows)
        return rows.length ? 'ok' : 'empty'
      })
    }

    sources.jolpica = await step.do('fetch official classification', RETRY, async () => {
      const path =
        meeting.round === null
          ? null
          : session.kind === 'race'
            ? `${session.year}/${meeting.round}/results`
            : session.kind === 'sprint'
              ? `${session.year}/${meeting.round}/sprint`
              : session.kind === 'qualifying'
                ? `${session.year}/${meeting.round}/qualifying`
                : null
      const race = path ? ((await jolpica<JRaceTable>(up, path, { limit: 100 })).RaceTable.Races[0] ?? null) : null
      await putJson(this.env.BUNDLES, keys.scratch(session.session_key, run, 'jolpica'), race)
      return race ? 'ok' : 'empty'
    })

    // A session whose laps are missing is not "done": let the step retry later instead of publishing an empty page.
    const suspicious = (Object.entries(sources) as [DatasetName, DatasetStatus][]).filter(
      ([ds, st]) => st === 'empty' && ds !== 'jolpica' && !OPTIONAL[ds]?.(session),
    )
    if (sources.laps === 'empty' && session.kind !== 'testing') {
      throw new Error(`no lap data yet for session ${session.session_key} (${suspicious.map(([d]) => d).join(', ')})`)
    }

    return step.do('build bundle', RETRY, async () => {
      const read = async <T>(name: string) => (await getJson<T>(this.env.BUNDLES, keys.scratch(session.session_key, run, name)))!
      return publishBundle(this.env, session, meeting, await readRaw(read), sources, pass)
    })
  }

  private async ingestTelemetry(step: WorkflowStep, up: Upstream, session: SessionRow, bundleVersion: string, run: string) {
    const meta = await step.do('telemetry plan', async () => {
      const bundle = (await getJson<SessionBundle>(this.env.BUNDLES, keys.bundle(session.session_key, bundleVersion)))!
      const drivers = Object.entries(bundle.laps)
        .filter(([, laps]) => laps.some((l) => l.t !== null))
        .map(([d]) => Number(d))
      // counted as a running job by the scheduler while the ~45 requests go through
      await markTelemetry(this.env.DB, session.session_key, 'queued', null)
      // Telemetry is immutable once the session is over: version it independently from the bundle.
      return { drivers, telemetryVersion: `t${run.slice(-10)}` }
    })
    const sessionStart = Date.parse(session.date_start)

    for (const driver of meta.drivers) {
      await step.do(`location ${driver}`, RETRY, async () => {
        const raw = await openf1<OF1Location>(up, 'location', { session_key: session.session_key, driver_number: driver })
        const track = compactLocation(raw, sessionStart)
        await putJson(this.env.BUNDLES, keys.scratch(session.session_key, run, `loc-${driver}`), track)
        return track.t.length
      })
      await step.do(`car data ${driver}`, RETRY, async () => {
        const car = await openf1<OF1CarData>(up, 'car_data', { session_key: session.session_key, driver_number: driver })
        const track = (await getJson<CompactTrack>(this.env.BUNDLES, keys.scratch(session.session_key, run, `loc-${driver}`)))!
        const bundle = (await getJson<SessionBundle>(this.env.BUNDLES, keys.bundle(session.session_key, bundleVersion)))!
        const laps: LapRow[] = bundle.laps[driver] ?? []
        const tel = buildDriverTelemetry(driver, car, track, laps, sessionStart)
        await putJson(this.env.BUNDLES, keys.telemetry(session.session_key, meta.telemetryVersion, driver), packTelemetry(tel))
        return Object.keys(tel.laps).length
      })
    }

    if (isRaceLike(session.kind)) {
      await step.do('replay', RETRY, async () => {
        const bundle = (await getJson<SessionBundle>(this.env.BUNDLES, keys.bundle(session.session_key, bundleVersion)))!
        const starts = Object.values(bundle.laps).flatMap((l) => (l[0]?.at != null ? [l[0].at] : []))
        const ends = Object.values(bundle.laps).flatMap((l) => {
          const last = l.at(-1)
          return last?.at != null ? [last.at + (last.t ?? 0)] : []
        })
        if (!starts.length || !ends.length) return false
        const start = Math.floor(Math.min(...starts)) - 5
        const length = Math.ceil(Math.max(...ends) - start) + 10
        const cars: Record<number, { x: number[]; y: number[] }> = {}
        for (const driver of meta.drivers) {
          const track = await getJson<CompactTrack>(this.env.BUNDLES, keys.scratch(session.session_key, run, `loc-${driver}`))
          if (track?.t.length) cars[driver] = resampleTrack(track, start, length, 1)
        }
        await putJson(this.env.BUNDLES, keys.replay(session.session_key, meta.telemetryVersion), assembleReplay(start, length, 1, cars))
        return true
      })
    }

    await step.do('publish telemetry', async () => {
      await markTelemetry(this.env.DB, session.session_key, 'done', meta.telemetryVersion)
      return true
    })
  }
}

type MeetingRowLike = Parameters<typeof toMeetingSummary>[0]

export async function readRaw(read: <T>(name: string) => Promise<T>): Promise<RawSessionData> {
  return {
    drivers: await read('drivers'),
    laps: await read('laps'),
    stints: await read('stints'),
    pit: await read('pit'),
    race_control: await read('race_control'),
    weather: await read('weather'),
    session_result: await read('session_result'),
    position: await read('position'),
    overtakes: await read('overtakes'),
    jolpica: await read<JRace | null>('jolpica'),
  }
}

/** Normalise, hash and publish a session bundle, then flip the session to "done" in D1. */
export async function publishBundle(
  env: Env,
  session: SessionRow,
  meeting: MeetingRowLike,
  raw: RawSessionData,
  sources: Partial<Record<DatasetName, DatasetStatus>>,
  pass: 1 | 2,
): Promise<string> {
  const { sessions: _, ...meetingSummary } = toMeetingSummary(meeting, [])
  const summary = { ...toSessionSummary(session), status: 'final' as const, version: null, telemetryVersion: null, podium: null }
  const bundle = buildBundle(summary, meetingSummary, raw, sources)
  const version = await contentHash(bundle)
  const podium = isRaceLike(session.kind) || isQualiLike(session.kind) || session.kind === 'practice' ? podiumOf(bundle) : []
  const full: SessionBundle = { ...bundle, session: { ...bundle.session, version, podium }, version, generatedAt: new Date().toISOString() }
  await putJson(env.BUNDLES, keys.bundle(session.session_key, version), full)
  await markIngested(env.DB, session.session_key, pass, version, podium)
  return version
}

export async function ensureCircuit(env: Env, up: Upstream, meeting: MeetingRowLike, year: number): Promise<boolean> {
  const key = keys.circuit(meeting.circuit_key ?? 0, year)
  if (!meeting.circuit_key || (await env.BUNDLES.head(key))) return true
  const c = await multiviewerCircuit(up, meeting.circuit_key, year)
  if (!c) return false
  await putJson(env.BUNDLES, key, {
    circuitKey: meeting.circuit_key,
    year,
    x: c.x,
    y: c.y,
    rotation: c.rotation,
    corners: c.corners.map((k) => ({ number: k.number, letter: k.letter ?? '', angle: k.angle, x: k.trackPosition.x, y: k.trackPosition.y })),
  })
  return true
}

export async function clearScratch(env: Env, sessionKey: number, run: string) {
  const prefix = `tmp/${sessionKey}/${run}/`
  let cursor: string | undefined
  do {
    const list = await env.BUNDLES.list({ prefix, cursor })
    if (list.objects.length) await env.BUNDLES.delete(list.objects.map((o) => o.key))
    cursor = list.truncated ? list.cursor : undefined
  } while (cursor)
}
