import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { t } from '@/i18n'

export function YearSwitcher({ years, current, to }: { years: number[]; current: number; to: '/saison/$year' | '/classements/$year' }) {
  const list = [...new Set([...years, current])].sort((a, b) => b - a)
  return (
    <div className="flex flex-wrap gap-1" role="navigation" aria-label={t('season.pick')}>
      {list.map((y) => (
        <Link
          key={y}
          to={to}
          params={{ year: y }}
          className={clsx(
            'tnum border px-3 py-1.5 text-xs transition-colors',
            y === current ? 'border-paper bg-paper text-ink' : 'border-line text-muted hover:border-line-2 hover:text-paper',
          )}
        >
          {y}
        </Link>
      ))}
    </div>
  )
}
