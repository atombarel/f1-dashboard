import type { Driver } from '@shared/types'
import clsx from 'clsx'
import { onDark } from '@/lib/colors'

/** Toggle chips, one per driver, in classification order. */
export function DriverPicker({
  drivers,
  selected,
  onChange,
  max,
  className,
}: {
  drivers: Driver[]
  selected: number[]
  onChange: (next: number[]) => void
  max?: number
  className?: string
}) {
  const toggle = (n: number) => {
    if (selected.includes(n)) onChange(selected.filter((x) => x !== n))
    else if (max === 1) onChange([n])
    else if (!max || selected.length < max) onChange([...selected, n])
    else onChange([...selected.slice(1), n])
  }
  return (
    <div className={clsx('flex flex-wrap gap-1', className)}>
      {drivers.map((d) => {
        const on = selected.includes(d.number)
        const c = onDark(d.teamColour)
        return (
          <button
            key={d.number}
            onClick={() => toggle(d.number)}
            aria-pressed={on}
            title={`${d.fullName} — ${d.teamName}`}
            className={clsx(
              'relative flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] tracking-wide transition-all',
              on ? 'text-ink' : 'border-line bg-carbon text-muted hover:border-line-2 hover:text-paper',
            )}
            style={on ? { background: c, borderColor: c } : undefined}
          >
            {!on && <span className="h-2.5 w-0.5" style={{ background: c }} />}
            {d.acronym}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button onClick={() => onChange([])} className="px-2 py-1 font-mono text-[11px] text-dim hover:text-signal">
          effacer
        </button>
      )}
    </div>
  )
}
