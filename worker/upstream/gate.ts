import { DurableObject } from 'cloudflare:workers'

export interface GateLimits {
  /** Minimum spacing between two requests. */
  minIntervalMs: number
  /** Max requests in any rolling 60s window. */
  perMinute: number
}

export type Priority = 'high' | 'low'

export interface GateResult {
  status: number
  body: string
}

interface Job {
  url: string
  limits: GateLimits
  attempt: number
  resolve: (r: GateResult) => void
  reject: (e: unknown) => void
}

const MAX_ATTEMPTS = 6
const TIMEOUT_MS = 30_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * One instance per upstream host (idFromName('openf1'), idFromName('jolpica'), …).
 * Every upstream request in the app is funnelled through here so the global rate stays
 * under the provider's limits regardless of how many isolates or workflows are running.
 *
 * - two lanes: user-triggered work (high) always jumps ahead of background backfill (low)
 * - identical concurrent requests are coalesced
 * - 429 / 5xx / network errors are retried with backoff, and pause the whole lane
 */
export class UpstreamGate extends DurableObject<Env> {
  private high: Job[] = []
  private low: Job[] = []
  private pumping = false
  private lastSent = 0
  private pausedUntil = 0
  private sent: number[] = []
  private inflight = new Map<string, Promise<GateResult>>()
  /** outcome timestamps over the last hour, for /api/admin/status */
  private stats = { ok: [] as number[], throttled: [] as number[], failed: [] as number[] }

  async fetchText(url: string, limits: GateLimits, priority: Priority = 'low'): Promise<GateResult> {
    const existing = this.inflight.get(url)
    if (existing) return existing
    const p = new Promise<GateResult>((resolve, reject) => {
      ;(priority === 'high' ? this.high : this.low).push({ url, limits, attempt: 0, resolve, reject })
    }).finally(() => this.inflight.delete(url))
    this.inflight.set(url, p)
    void this.pump()
    return p
  }

  async queueDepth() {
    const hourAgo = Date.now() - 60 * 60 * 1000
    const count = (a: number[]) => a.filter((t) => t > hourAgo).length
    return {
      high: this.high.length,
      low: this.low.length,
      inflight: this.inflight.size,
      pausedForMs: Math.max(0, this.pausedUntil - Date.now()),
      lastHour: { ok: count(this.stats.ok), throttled: count(this.stats.throttled), failed: count(this.stats.failed) },
    }
  }

  private record(kind: keyof UpstreamGate['stats']) {
    const now = Date.now()
    const list = this.stats[kind]
    list.push(now)
    while (list.length && list[0] < now - 60 * 60 * 1000) list.shift()
  }

  private nextAllowedAt(limits: GateLimits): number {
    const now = Date.now()
    this.sent = this.sent.filter((t) => t > now - 60_000)
    let at = Math.max(this.lastSent + limits.minIntervalMs, this.pausedUntil)
    if (this.sent.length >= limits.perMinute) at = Math.max(at, this.sent[this.sent.length - limits.perMinute] + 60_000)
    return at
  }

  private async pump() {
    if (this.pumping) return
    this.pumping = true
    try {
      while (this.high.length || this.low.length) {
        const head = this.high[0] ?? this.low[0]
        const wait = this.nextAllowedAt(head.limits) - Date.now()
        if (wait > 0) {
          await sleep(wait)
          continue // a high-priority job may have arrived meanwhile
        }
        const job = (this.high.length ? this.high : this.low).shift()!
        this.lastSent = Date.now()
        this.sent.push(this.lastSent)
        void this.send(job)
      }
    } finally {
      this.pumping = false
    }
  }

  private async send(job: Job) {
    job.attempt++
    let retryIn = 0
    let error = ''
    try {
      const res = await fetch(job.url, {
        headers: { accept: 'application/json', 'user-agent': 'f1-dashboard/2 (+https://github.com/atombarel/f1-dashboard)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after'))
        retryIn = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** job.attempt
        error = `HTTP ${res.status}`
        await res.body?.cancel()
        // Throttled: hold back everybody, not just this job.
        if (res.status === 429) this.pausedUntil = Math.max(this.pausedUntil, Date.now() + retryIn)
        this.record(res.status === 429 ? 'throttled' : 'failed')
      } else {
        job.resolve({ status: res.status, body: await res.text() })
        this.record('ok')
        return
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      retryIn = 1000 * 2 ** job.attempt
      this.record('failed')
    }
    if (job.attempt >= MAX_ATTEMPTS) {
      job.reject(new Error(`Upstream failed after ${job.attempt} attempts (${error}): ${job.url}`))
      return
    }
    await sleep(retryIn)
    this.high.unshift(job) // retries go first: someone is already waiting on them
    void this.pump()
  }
}
