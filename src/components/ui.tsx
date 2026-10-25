import type { Compound, Driver, SessionStatus } from '@shared/types'
import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { onDark, TYRE } from '@/lib/colors'

export function PageHeader({ eyebrow, title, children, aside }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="animate-rise relative mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-3 flex items-center gap-2">{eyebrow}</div>}
        <h1 className="display text-5xl text-paper sm:text-7xl">{title}</h1>
        {children && <div className="mt-3 max-w-3xl text-sm text-muted">{children}</div>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  )
}

export function SectionTitle({ index, title, aside, className }: { index?: string; title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-4', className)}>
      <div className="flex items-end justify-between gap-4 pb-2">
        <h2 className="display flex items-baseline gap-3 text-2xl sm:text-3xl">
          {index && <span className="tnum text-xs font-normal text-signal">{index}</span>}
          {title}
        </h2>
        {aside && <div className="text-xs text-muted">{aside}</div>}
      </div>
      <div className="ruler" />
    </div>
  )
}

export function Panel({ className, children, flat }: { className?: string; children: ReactNode; flat?: boolean }) {
  return <div className={clsx(flat ? 'panel-flat' : 'panel', className)}>{children}</div>
}

export function Stat({ label, value, sub, accent }: { label: ReactNode; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="tnum truncate text-xl text-paper sm:text-2xl" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 truncate text-xs text-muted">{sub}</div>}
    </div>
  )
}

/** Five red lights, one after the other: the loading state of the whole app. */
export function StartLights({ label = 'Chargement' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16" role="status" aria-live="polite">
      <div className="flex gap-2.5 rounded-sm border border-line bg-carbon px-4 py-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="size-4 rounded-full bg-signal shadow-[0_0_14px_var(--color-signal)]"
            style={{ animation: `pulse-dot 1.5s ${i * 0.18}s ease-in-out infinite` }}
          />
        ))}
      </div>
      <span className="eyebrow">{label}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('relative overflow-hidden bg-panel', className)}>
      <div className="animate-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  )
}

export function EmptyState({ title, children, icon }: { title: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="text-dim">{icon}</div>}
      <div className="display text-2xl text-paper">{title}</div>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  )
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <EmptyState title="Drapeau rouge">
      <p>{error instanceof Error ? error.message : 'Une erreur est survenue.'}</p>
      {retry && (
        <button onClick={retry} className="mt-4 border border-line-2 px-4 py-2 text-xs uppercase tracking-widest hover:border-signal hover:text-signal">
          Réessayer
        </button>
      )}
    </EmptyState>
  )
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <ErrorState
      error={error}
      retry={() => {
        reset()
        void router.invalidate()
      }}
    />
  )
}

export function NotFound() {
  return (
    <EmptyState title="Hors piste">
      Cette page n’existe pas.{' '}
      <Link to="/" className="text-signal link-underline">
        Retour au stand
      </Link>
    </EmptyState>
  )
}

const STATUS: Record<SessionStatus, { label: string; className: string; dot?: boolean }> = {
  upcoming: { label: 'À venir', className: 'text-muted border-line-2' },
  live: { label: 'En cours', className: 'text-signal border-signal/60 bg-signal-soft', dot: true },
  processing: { label: 'Traitement', className: 'text-amber border-amber/40' },
  final: { label: 'Terminée', className: 'text-paper/80 border-line-2' },
  cancelled: { label: 'Annulée', className: 'text-dim border-line line-through' },
}

export function StatusPill({ status, className }: { status: SessionStatus; className?: string }) {
  const s = STATUS[status]
  return (
    <span className={clsx('inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]', s.className, className)}>
      {s.dot && <span className="animate-pulse-dot size-1.5 rounded-full bg-signal" />}
      {s.label}
    </span>
  )
}

export function TeamBar({ colour, className }: { colour: string; className?: string }) {
  return <span className={clsx('inline-block w-1 shrink-0 self-stretch', className)} style={{ background: onDark(colour) }} />
}

export function DriverTag({ driver, size = 'md', showTeam }: { driver: Pick<Driver, 'acronym' | 'number' | 'teamColour' | 'teamName' | 'fullName'>; size?: 'sm' | 'md'; showTeam?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-stretch gap-2">
      <TeamBar colour={driver.teamColour} />
      <span className="flex min-w-0 flex-col justify-center leading-tight">
        <span className={clsx('flex items-baseline gap-1.5', size === 'sm' ? 'text-xs' : 'text-sm')}>
          <span className="font-semibold tracking-wide text-paper">{driver.acronym}</span>
          <span className="tnum text-[10px] text-dim">{driver.number}</span>
        </span>
        {showTeam && <span className="truncate text-[11px] text-muted">{driver.teamName}</span>}
      </span>
    </span>
  )
}

export function TyreBadge({ compound, size = 18, age }: { compound: Compound; size?: number; age?: number }) {
  const t = TYRE[compound]
  return (
    <span className="inline-flex items-center gap-1" title={`${t.label}${age ? ` · ${age} tours à l’origine` : ''}`}>
      <span
        className="inline-flex items-center justify-center rounded-full font-mono font-bold text-ink"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.5,
          background: `radial-gradient(circle, var(--color-carbon) 0 38%, ${t.color} 40% 100%)`,
          color: t.color,
        }}
      >
        {t.short}
      </span>
    </span>
  )
}

export function Flag({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  if (!src) return null
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={clsx('aspect-[16/9] object-cover', className)} />
}

export interface SegmentItem<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
  hint?: string
}

export function Segmented<T extends string>({ items, value, onChange, className }: { items: SegmentItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={clsx('inline-flex border border-line bg-carbon p-0.5', className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={it.value === value}
          disabled={it.disabled}
          title={it.hint}
          onClick={() => onChange(it.value)}
          className={clsx(
            'px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors',
            it.value === value ? 'bg-paper text-ink' : 'text-muted hover:text-paper',
            it.disabled && 'cursor-not-allowed opacity-30 hover:text-muted',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
