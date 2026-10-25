import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import type { DatasetName, DatasetStatus } from '../../shared/types'
import { getMeetingRow, markIngestError, type SessionRow } from '../lib/db'
import { getJson, keys, putJson } from '../lib/store'
import { jolpica, openf1, type JRace, type JRaceTable, type Upstream } from '../upstream/openf1'
import { pump } from './scheduler'
import { clearScratch, ensureCircuit, OPENF1_DATASETS, publishBundle, readRaw, RETRY } from './workflow'

export interface IngestMeetingParams {
  meetingKey: number
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
 * Backfill a whole weekend at once. OpenF1 filters every dataset by meeting_key, so a Grand Prix
 * costs ~12 upstream requests instead of ~11 per session: the difference matters a lot when the
 * shared upstream quota is the bottleneck.
 */
export class IngestMeetingWorkflow extends WorkflowEntrypoint<Env, IngestMeetingParams> {
  async run(event: WorkflowEvent<IngestMeetingParams>, step: WorkflowStep) {
    const { meetingKey, sessionKeys, pass } = event.payload
    const run = event.instanceId.replace(/[^a-z0-9-]/gi, '').slice(-24)
    const up: Upstream = { env: this.env, priority: 'low' }

    const ctx = await step.do('load context', async () => {
      const meeting = await getMeetingRow(this.env.DB, meetingKey)
      if (!meeting) throw new Error(`unknown meeting ${meetingKey}`)
      const placeholders = sessionKeys.map(() => '?').join(',')
      const { results } = await this.env.DB.prepare(`SELECT * FROM sessions WHERE session_key IN (${placeholders})`)
        .bind(...sessionKeys)
        .all<SessionRow>()
      return { meeting, sessions: results }
    })

    // One request per dataset for the whole weekend, split per session into scratch objects.
    const counts: Record<string, Record<number, number>> = {}
    for (const ds of OPENF1_DATASETS) {
      counts[ds] = await step.do(`fetch ${ds}`, RETRY, async () => {
        const rows = await openf1<{ session_key: number }>(up, ds, { meeting_key: meetingKey })
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
          path && ctx.meeting.round !== null
            ? ((await jolpica<JRaceTable>(up, `${s.year}/${ctx.meeting.round}/${path}`, { limit: 100 })).RaceTable.Races[0] ?? null)
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
        return publishBundle(this.env, s, ctx.meeting, raw, sources, pass)
      })
    }

    await step.do('circuit layout', RETRY, async () => ensureCircuit(this.env, up, ctx.meeting, ctx.meeting.year))

    await step.do('cleanup scratch', async () => {
      for (const s of ctx.sessions) await clearScratch(this.env, s.session_key, run)
      return true
    })

    await step.do('continue backfill', async () => {
      await pump(this.env)
      return true
    })

    return { meetingKey, sessions: sessionKeys.length }
  }
}
