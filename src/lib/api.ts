import { unpackTelemetry, type DriverTelemetryWire } from '@shared/codec'
import { queryOptions } from '@tanstack/react-query'
import type {
  CircuitLayout,
  DriverTelemetry,
  HomeResponse,
  MeetingResponse,
  ReplayData,
  SeasonResponse,
  SessionBundle,
  SessionMeta,
  StandingsResponse,
} from '@shared/types'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** 202 = the resource is being built server-side; callers poll. */
export class PendingError extends ApiError {}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (res.status === 202) throw new PendingError('processing', 202)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

const MIN = 60_000

export const homeQuery = () =>
  queryOptions({ queryKey: ['home'], queryFn: () => get<HomeResponse>('/api/home'), staleTime: 30_000, refetchInterval: MIN })

export const seasonQuery = (year: number) =>
  queryOptions({ queryKey: ['season', year], queryFn: () => get<SeasonResponse>(`/api/seasons/${year}`), staleTime: 2 * MIN })

export const meetingQuery = (key: number) =>
  queryOptions({ queryKey: ['meeting', key], queryFn: () => get<MeetingResponse>(`/api/meetings/${key}`), staleTime: MIN })

/** Session pointer: polls while the server is still ingesting. */
export const sessionMetaQuery = (key: number) =>
  queryOptions({
    queryKey: ['session-meta', key],
    queryFn: () => get<SessionMeta>(`/api/sessions/${key}`),
    staleTime: 30_000,
    refetchInterval: (q) => {
      const meta = q.state.data
      if (!meta) return false
      if (!meta.bundleUrl) return (meta.retryAfter ?? 10) * 1000
      if (!meta.telemetryUrl && meta.session.kind !== 'testing') return 20_000
      return false
    },
  })

/** Versioned URLs are immutable: never refetch. */
const immutable = { staleTime: Infinity, gcTime: 30 * MIN } as const

export const bundleQuery = (url: string) =>
  queryOptions({ queryKey: ['bundle', url], queryFn: () => get<SessionBundle>(url), ...immutable })

export const telemetryQuery = (template: string, driver: number) =>
  queryOptions({
    queryKey: ['telemetry', template, driver],
    queryFn: async (): Promise<DriverTelemetry> => unpackTelemetry(await get<DriverTelemetryWire>(template.replace('{driver}', String(driver)))),
    ...immutable,
  })

export const replayQuery = (url: string) => queryOptions({ queryKey: ['replay', url], queryFn: () => get<ReplayData>(url), ...immutable })

export const circuitQuery = (url: string) =>
  queryOptions({ queryKey: ['circuit', url], queryFn: () => get<CircuitLayout>(url), ...immutable, retry: false })

export const standingsQuery = (year: number) =>
  queryOptions({ queryKey: ['standings', year], queryFn: () => get<StandingsResponse>(`/api/standings/${year}`), staleTime: 5 * MIN })
