import { getLocale, t } from '@/i18n'

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** 92.456 → "1:32.456" */
export function lapTime(s: number | null | undefined, digits = 3): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return '—'
  const m = Math.floor(s / 60)
  const rest = (s - m * 60).toFixed(digits).padStart(digits + 3, '0')
  return m ? `${m}:${rest}` : (s).toFixed(digits)
}

/** 6120.785 → "1:42:00.785" */
export function raceTime(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = (s % 60).toFixed(3).padStart(6, '0')
  return h ? `${h}:${pad(m)}:${sec}` : `${m}:${sec}`
}

export function gap(g: number | string | null | undefined, digits = 3): string {
  if (g === null || g === undefined) return '—'
  if (typeof g === 'string') return g.replace('LAPS', t('format.laps')).replace('LAP', t('format.lap'))
  if (g === 0) return t('format.leader')
  return `+${g.toFixed(digits)}`
}

export const delta = (d: number, digits = 3) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(digits)}`

const formatters = new Map<string, Intl.DateTimeFormat>()
/** Formatter for the current language, built once per (locale, options). */
function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = getLocale()
  const id = locale + JSON.stringify(options)
  let f = formatters.get(id)
  if (!f) formatters.set(id, (f = new Intl.DateTimeFormat(locale, options)))
  return f
}
const DATE = { day: 'numeric', month: 'short' } as const
const DAY = { weekday: 'short', day: 'numeric', month: 'short' } as const
const TIME = { hour: '2-digit', minute: '2-digit' } as const
const LONG = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' } as const

export const shortDate = (iso: string) => fmt(DATE).format(new Date(iso))
export const dayDate = (iso: string) => fmt(DAY).format(new Date(iso))
export const clock = (iso: string) => fmt(TIME).format(new Date(iso))
export const longDate = (iso: string) => fmt(LONG).format(new Date(iso))

/** "6–8 mars" / "6–8 Mar" */
export function dateRange(startIso: string, endIso: string): string {
  const s = new Date(startIso)
  const e = new Date(endIso)
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${fmt({ month: 'short' }).format(e)}`
  return `${fmt(DATE).format(s)} – ${fmt(DATE).format(e)}`
}

/** Circuit-local clock from the meeting's gmt offset ("08:00:00"). */
export function localClock(iso: string, gmtOffset: string): string {
  const [h, m] = gmtOffset.replace('-', '').split(':').map(Number)
  const sign = gmtOffset.startsWith('-') ? -1 : 1
  const d = new Date(Date.parse(iso) + sign * (h * 60 + m) * 60_000)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export function countdownParts(ms: number) {
  const t = Math.max(0, ms)
  return {
    days: Math.floor(t / 86_400_000),
    hours: Math.floor((t % 86_400_000) / 3_600_000),
    minutes: Math.floor((t % 3_600_000) / 60_000),
    seconds: Math.floor((t % 60_000) / 1000),
  }
}

export const points = (p: number | null | undefined) => (p === null || p === undefined ? '—' : Number.isInteger(p) ? String(p) : p.toFixed(1))
