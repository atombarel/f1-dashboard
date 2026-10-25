import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import type { DatasetName, DatasetStatus } from '../../shared/types'
import { getMeetingRow, markIngestError, type SessionRow } from '../lib/db'
import { getJson, keys, putJson } from '../lib/store'
import { jolpica, openf1, type JRace, type JRaceTable, type Upstream } from '../upstream/openf1'
import { pump } from './scheduler'
import { clearScratch, ensureCircuit, OPENF1_DATASETS, publishBundle, readRaw, RETRY } from './workflow'

export interface IngestMeetingParams {
  /** up to a handful of weekends of the same season, fetched together */
  meetingKeys: number[]
  /** sessions claimed by the scheduler for this run */
  sessionKeys: number[]
  pass: 1 | 2
}

const JOLPICA_PATH: Partial<Record<SessionRow['kind'], string>> = {
  race: 'results',
  sprint: 'sprint',
  qualifying: 'qualifying',
}

/**
 * Backfill several weekends at once. OpenF1 filters every dataset by a meeting_key range, so six
 * Grands Prix (~30 sessions) cost 9 OpenF1 requests instead of ~11 per session: the difference
 * matters a lot when the shared upstream quota is the bottleneck.
 */
export class IngestMeetingWorkflow extends WorkflowEntrypoint<Env, IngestMeetingParams> {
  async run(event: WorkflowEvent<IngestMeetingParams>, step: WorkflowStep) {
    const { sessionKeys, pass } = event.payload
    // instances queued before multi-weekend batches carried a single meetingKey
    const legacy = (event.payload as { meetingKey?: number }).meetingKey
    const meetingKeys = event.payload.meetingKeys ?? (legacy ? [legacy] : [])
    const run = event.instanceId.replace(/[^a-z0-9-]/gi, '').slice(-24)
    const up: Upstream = { env: this.env, priority: 'low' }

    const ctx = await step.do('load context', async () => {
      const meetings = []
      for (const key of meetingKeys) {
        const m = await getMeetingRow(this.env.DB, key)
        if (m) meetings.push(m)
      }
      const placeholders = sessionKeys.map(() => '?').join(',')
      const { results } = await this.env.DB.prepare(`SELECT * FROM sessions WHERE session_key IN (${placeholders})`)
        .bind(...sessionKeys)
        .all<SessionRow>()
      return { meetings, sessions: results }
    })
    const meetingOf = (s: SessionRow) => ctx.meetings.find((m) => m.meeting_key === s.meeting_key)!
    // one weekend: meeting_key=…; several: a key range, rows of unrelated sessions are dropped
    const filter =
      meetingKeys.length === 1
        ? { meeting_key: meetingKeys[0] }
        : { 'meeting_key>=': Math.min(...meetingKeys), 'meeting_key<=': Math.max(...meetingKeys) }

    // One request per dataset for the whole weekend, split per session into scratch objects.
    const counts: Record<string, Record<number, number>> = {}
    for (const ds of OPENF1_DATASETS) {
      counts[ds] = await step.do(`fetch ${ds}`, RETRY, async () => {
        const rows = await openf1<{ session_key: number }>(up, ds, filter)
        const per: Record<number, number> = {}
        for (const s of ctx.sessions) {
          const own = rows.filter((r) => r.session_key === s.session_key)
          per[s.session_key] = own.length
          await putJson(this.env.BUNDLES, keys.scratch(s.session_key, run, ds), own)
        }
        return per
      })
    }

    // Official classifications (one Jolpica call per kind present in this batch).
    for (const s of ctx.sessions) {
      const path = JOLPICA_PATH[s.kind]
      await step.do(`classification ${s.session_key}`, RETRY, async () => {
        const race =
          path && meetingOf(s).round !== null
            ? ((await jolpica<JRaceTable>(up, `${s.year}/${meetingOf(s).round}/${path}`, { limit: 100 })).RaceTable.Races[0] ?? null)
            : null
        await putJson(this.env.BUNDLES, keys.scratch(s.session_key, run, 'jolpica'), race)
        return race ? 'ok' : 'empty'
      })
    }

    for (const s of ctx.sessions) {
      await step.do(`build ${s.session_key}`, RETRY, async () => {
        const sources: Partial<Record<DatasetName, DatasetStatus>> = {}
        for (const ds of OPENF1_DATASETS) sources[ds] = counts[ds][s.session_key] ? 'ok' : 'empty'
        if (!counts.laps[s.session_key] && s.kind !== 'testing') {
          // Not fatal for the batch: this session stays in the backlog and is retried later.
          await markIngestError(this.env.DB, s.session_key, 'no lap data in OpenF1')
          return null
        }
        const read = async <T>(name: string) => (await getJson<T>(this.env.BUNDLES, keys.scratch(s.session_key, run, name)))!
        const raw = await readRaw(read)
        sources.jolpica = (raw.jolpica as JRace | null) ? 'ok' : 'empty'
        return publishBundle(this.env, s, meetingOf(s), raw, sources, pass)
      })
    }

    for (const m of ctx.meetings) {
      await step.do(`circuit layout ${m.meeting_key}`, RETRY, async () => ensureCircuit(this.env, up, m, m.year))
    }

    await step.do('cleanup scratch', async () => {
      for (const s of ctx.sessions) await clearScratch(this.env, s.session_key, run)
      return true
    })

    await step.do('continue backfill', async () => {
      await pump(this.env)
      return true
    })

    return { meetings: meetingKeys.length, sessions: sessionKeys.length }
  }
}
