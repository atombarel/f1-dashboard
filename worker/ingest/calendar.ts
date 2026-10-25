import { sessionKind } from '../../shared/sessions'
import { kvSet, upsertMeetings, upsertSessions, type MeetingRow, type SessionCalendarRow } from '../lib/db'
import { jolpica, openf1, type JRaceTable, type OF1Meeting, type OF1Session, type Upstream } from '../upstream/openf1'

const day = (iso: string) => iso.slice(0, 10)

/** Pull the calendar of a season from OpenF1 and attach official round numbers from Jolpica. */
export async function syncSeason(up: Upstream, year: number) {
  const [meetings, sessions, jRaces] = await Promise.all([
    openf1<OF1Meeting>(up, 'meetings', { year }),
    openf1<OF1Session>(up, 'sessions', { year }),
    jolpica<JRaceTable>(up, `${year}/races`, { limit: 100 }).catch(() => null),
  ])
  const races = jRaces?.RaceTable.Races ?? []

  const sessionsByMeeting = new Map<number, OF1Session[]>()
  for (const s of sessions) (sessionsByMeeting.get(s.meeting_key) ?? sessionsByMeeting.set(s.meeting_key, []).get(s.meeting_key)!).push(s)

  const meetingRows: MeetingRow[] = meetings.map((m) => {
    const own = sessionsByMeeting.get(m.meeting_key) ?? []
    const isTesting = /testing/i.test(m.meeting_name)
    const dateEnd = m.date_end ?? own.map((s) => s.date_end).sort().at(-1) ?? m.date_start
    // Round = the Jolpica race whose date falls inside this weekend.
    const race = isTesting || m.is_cancelled ? undefined : races.find((r) => r.date >= day(m.date_start) && r.date <= day(dateEnd))
    return {
      meeting_key: m.meeting_key,
      year: m.year,
      round: race ? Number(race.round) : null,
      name: m.meeting_name,
      official_name: m.meeting_official_name,
      location: m.location,
      country_code: m.country_code,
      country_name: m.country_name,
      country_flag: m.country_flag ?? null,
      circuit_key: m.circuit_key,
      circuit_name: m.circuit_short_name,
      circuit_image: m.circuit_image ?? null,
      gmt_offset: m.gmt_offset,
      date_start: m.date_start,
      date_end: dateEnd,
      is_cancelled: m.is_cancelled ? 1 : 0,
      is_testing: isTesting ? 1 : 0,
    }
  })

  const testing = new Set(meetingRows.filter((m) => m.is_testing).map((m) => m.meeting_key))
  const cancelled = new Set(meetingRows.filter((m) => m.is_cancelled).map((m) => m.meeting_key))
  const known = new Set(meetingRows.map((m) => m.meeting_key))
  const sessionRows: SessionCalendarRow[] = sessions
    .filter((s) => known.has(s.meeting_key))
    .map((s) => ({
      session_key: s.session_key,
      meeting_key: s.meeting_key,
      year: s.year,
      name: s.session_name,
      type: s.session_type,
      kind: sessionKind(s.session_name, s.session_type, testing.has(s.meeting_key)),
      date_start: s.date_start,
      date_end: s.date_end,
      is_cancelled: s.is_cancelled || cancelled.has(s.meeting_key) ? 1 : 0,
    }))

  await upsertMeetings(up.env.DB, meetingRows)
  await upsertSessions(up.env.DB, sessionRows)
  await kvSet(up.env.DB, `calendar:${year}`, String(meetingRows.length))
  return { meetings: meetingRows.length, sessions: sessionRows.length }
}
