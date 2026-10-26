import type { SessionMeta } from '@shared/types'
import { useEffect } from 'react'
import { t } from '@/i18n'

const triggered = new Set<number>()

/**
 * When telemetry has not been ingested yet, ask the API once (unversioned URL → 202) so the server
 * starts the job; the session meta query polls and picks up `telemetryUrl` when it lands.
 */
export function useRequestTelemetry(meta: SessionMeta, driver: number | undefined) {
  const key = meta.session.key
  const missing = !meta.telemetryUrl
  useEffect(() => {
    if (!missing || driver === undefined || triggered.has(key)) return
    triggered.add(key)
    void fetch(`/api/sessions/${key}/telemetry/${driver}`).catch(() => triggered.delete(key))
  }, [missing, key, driver])
}

export function TelemetryPending({ title = t('telemetry.pending.title') }: { title?: string }) {
  return (
    <div className="panel relative overflow-hidden px-6 py-20 text-center">
      <svg viewBox="0 0 600 120" className="mx-auto mb-6 h-24 w-full max-w-xl" aria-hidden>
        <defs>
          <linearGradient id="tp-fade" x1="0" x2="1">
            <stop offset="0" stopColor="var(--color-signal)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--color-signal)" stopOpacity="1" />
            <stop offset="1" stopColor="var(--color-signal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 90 L60 90 C80 90 85 30 110 30 L230 30 C250 30 255 75 275 75 L300 75 C320 75 322 20 345 20 L470 20 C495 20 500 95 525 95 L600 95"
          fill="none"
          stroke="var(--color-line-2)"
          strokeWidth="2"
        />
        <path
          d="M0 90 L60 90 C80 90 85 30 110 30 L230 30 C250 30 255 75 275 75 L300 75 C320 75 322 20 345 20 L470 20 C495 20 500 95 525 95 L600 95"
          fill="none"
          stroke="url(#tp-fade)"
          strokeWidth="2.5"
          strokeDasharray="120 700"
        >
          <animate attributeName="stroke-dashoffset" from="120" to="-700" dur="2.4s" repeatCount="indefinite" />
        </path>
      </svg>
      <div className="display text-4xl">{title}</div>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">
        {t('telemetry.pending.body')}
      </p>
    </div>
  )
}
