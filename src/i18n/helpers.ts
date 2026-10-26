import type { Compound } from '@shared/types'
import { t, type MessageKey } from '.'

/** OpenF1 session names ("Practice 1") → display name; unknown names pass through. */
export function sessionName(name: string): string {
  const key = `sessions.${name}` as MessageKey
  const out = t(key)
  return out === key ? name : out
}

/** "Practice 1" → "FP1", "Race" → "Course" / "Race". */
export function sessionShort(name: string): string {
  const key = `sessionShort.${name}` as MessageKey
  const out = t(key)
  return out === key ? name : out
}

export const tyreLabel = (c: Compound) => t(`tyres.${c}`)
