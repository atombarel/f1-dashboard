import { SESSION_SHORT } from '@shared/sessions'
import type { MeetingSummary, PodiumEntry, SessionSummary } from '@shared/types'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { StatusPill } from '@/components/ui'
import { onDark } from '@/lib/colors'
import { clock, dayDate, localClock } from '@/lib/format'

/** Current time, re-rendered every `interval` ms. */
export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}

export const shortName = (name: string) => name.replace('Grand Prix', 'GP')
export const sessionShort = (name: string) => SESSION_SHORT[name] ?? name

export function PodiumChips({ podium, className }: { podium: PodiumEntry[] | null; className?: string }) {
  if (!podium?.length) return null
  return (
    <div className={clsx('flex flex-wrap gap-1', className)}>
      {podium.map((p) => (
        <span key={p.position} className="inline-flex items-center gap-1.5 border border-line bg-carbon py-0.5 pr-2 font-mono text-[10px]" title={`${p.fullName} — ${p.teamName}`}>
          <span className="self-stretch px-1 text-ink" style={{ background: onDark(p.teamColour) }}>
            P{p.position}
          </span>
          <span className="text-paper">{p.acronym}</span>
        </span>
      ))}
    </div>
  )
}

/** One session of a weekend: day, user-local time, circuit-local time, status, podium. */
export function SessionCard({ session, meeting, highlight, index }: { session: SessionSummary; meeting: MeetingSummary; highlight?: boolean; index?: number }) {
  const muted = session.status === 'cancelled'
  return (
    <Link
      to="/session/$sessionKey"
      params={{ sessionKey: session.key }}
      className={clsx(
        'group animate-rise relative flex min-w-0 flex-col gap-3 border bg-carbon p-4 transition-colors',
        highlight ? 'border-signal/70 bg-signal-soft' : 'border-line hover:border-line-2 hover:bg-panel',
        muted && 'opacity-50',
      )}
      style={index !== undefined ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={clsx('display text-3xl', highlight ? 'text-signal' : 'text-paper')}>{sessionShort(session.name)}</span>
        <StatusPill status={session.status} className="shrink-0 whitespace-nowrap" />
      </div>
      <div>
        <div className="text-xs capitalize text-muted">{dayDate(session.dateStart)}</div>
        <div className="tnum mt-0.5 text-lg text-paper">{clock(session.dateStart)}</div>
        <div className="tnum text-[10px] text-dim">{localClock(session.dateStart, meeting.gmtOffset)} sur place</div>
      </div>
      {session.podium?.length ? (
        <PodiumChips podium={session.podium} />
      ) : session.status === 'processing' ? (
        <div className="font-mono text-[10px] uppercase tracking-wider text-amber">Données en cours de récupération</div>
      ) : (
        <div className="font-mono text-[10px] uppercase tracking-wider text-dim">{session.name}</div>
      )}
      <span className="absolute right-3 bottom-3 font-mono text-xs text-dim transition-all group-hover:translate-x-0.5 group-hover:text-signal">→</span>
    </Link>
  )
}
