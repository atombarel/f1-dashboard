import type { Compound } from '@shared/types'

/** Display names live in i18n (`tyreLabel`). */
export const TYRE: Record<Compound, { color: string; short: string }> = {
  SOFT: { color: 'var(--color-soft)', short: 'S' },
  MEDIUM: { color: 'var(--color-medium)', short: 'M' },
  HARD: { color: 'var(--color-hard)', short: 'H' },
  INTERMEDIATE: { color: 'var(--color-inter)', short: 'I' },
  WET: { color: 'var(--color-wet)', short: 'W' },
  UNKNOWN: { color: 'var(--color-dim)', short: '?' },
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Team colours drawn on the carbon background: lift the darkest ones (e.g. navy liveries) so lines stay visible. */
export function onDark(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const l = luminance(hex)
  if (l > 0.06) return hex
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Second driver of a team gets a dashed line in charts. */
export function teammateIndex(drivers: { number: number; teamName: string }[]): Map<number, number> {
  const seen = new Map<string, number>()
  const out = new Map<number, number>()
  for (const d of [...drivers].sort((a, b) => a.number - b.number)) {
    const i = seen.get(d.teamName) ?? 0
    out.set(d.number, i)
    seen.set(d.teamName, i + 1)
  }
  return out
}
