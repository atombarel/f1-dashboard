import type { SessionKind, SessionStatus } from './types'

export function sessionKind(name: string, type: string, isTesting: boolean): SessionKind {
  if (isTesting) return 'testing'
  const n = name.toLowerCase()
  if (n.includes('sprint') && (n.includes('qualifying') || n.includes('shootout'))) return 'sprint_qualifying'
  if (n === 'sprint') return 'sprint'
  if (n.includes('qualifying')) return 'qualifying'
  if (n === 'race' || type === 'Race') return 'race'
  return 'practice'
}

export const isRaceLike = (k: SessionKind) => k === 'race' || k === 'sprint'
export const isQualiLike = (k: SessionKind) => k === 'qualifying' || k === 'sprint_qualifying'

/** OpenF1 publishes the full data set a little after the chequered flag. */
export const LIVE_GRACE_MS = 30 * 60 * 1000

export function timeStatus(dateStart: string, dateEnd: string, now = Date.now()): Exclude<SessionStatus, 'final' | 'cancelled'> {
  const start = Date.parse(dateStart)
  const end = Date.parse(dateEnd)
  if (now < start) return 'upcoming'
  if (now < end + LIVE_GRACE_MS) return 'live'
  return 'processing'
}

export const SESSION_SHORT: Record<string, string> = {
  'Practice 1': 'FP1',
  'Practice 2': 'FP2',
  'Practice 3': 'FP3',
  Qualifying: 'Q',
  'Sprint Qualifying': 'SQ',
  'Sprint Shootout': 'SQ',
  Sprint: 'Sprint',
  Race: 'Course',
  'Day 1': 'J1',
  'Day 2': 'J2',
  'Day 3': 'J3',
}
