import clsx from 'clsx'
import { Eye, EyeOff } from 'lucide-react'
import { t } from '@/i18n'
import { lapTime } from '@/lib/format'
import type { CarFrame, GhostCar } from './stage'

const ROW_H = 34
const signed = (v: number, digits = 3) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`

/**
 * Order on the road at the current instant, with the official gap and the live gap to the reference (which
 * lands on the official one when the reference takes the flag). Rows animate as the order changes; hidden
 * cars stay listed, greyed out.
 */
export function GapTower({
  all,
  frames,
  hidden,
  onToggle,
}: {
  all: GhostCar[]
  frames: CarFrame[]
  hidden: Set<number>
  onToggle: (driver: number) => void
}) {
  const byDriver = new Map(frames.map((f) => [f.car.driver.number, f]))
  // visible cars in road order, hidden ones below in segment order
  const order = [
    ...[...frames].sort((a, b) => a.order - b.order).map((f) => f.car),
    ...all.filter((c) => hidden.has(c.driver.number)),
  ]
  const index = new Map(order.map((c, i) => [c.driver.number, i]))

  return (
    <div>
      <div className="grid grid-cols-[2rem_1fr_4.5rem_4.25rem_2rem] items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="eyebrow">{t('quali.pos')}</span>
        <span className="eyebrow">{t('quali.driver')}</span>
        <span className="eyebrow text-right">{t('quali.gap')}</span>
        <span className="eyebrow text-right" title={t('quali.liveHint')}>
          {t('quali.live')}
        </span>
        <span />
      </div>
      <div className="relative" style={{ height: all.length * ROW_H }}>
        {all.map((car) => {
          const f = byDriver.get(car.driver.number)
          const i = index.get(car.driver.number)!
          const off = !f
          return (
            <button
              key={car.driver.number}
              onClick={() => onToggle(car.driver.number)}
              aria-pressed={!off}
              title={off ? t('quali.show') : t('quali.hide')}
              className={clsx(
                'group absolute inset-x-0 grid grid-cols-[2rem_1fr_4.5rem_4.25rem_2rem] items-center gap-2 px-3 text-left transition-[top,background-color,opacity] duration-500 ease-out hover:bg-panel',
                off && 'opacity-35',
              )}
              style={{ top: i * ROW_H, height: ROW_H }}
            >
              <span className="tnum text-right text-[11px] text-dim">{off ? '—' : f.order + 1}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="h-4 w-1 shrink-0" style={{ background: car.colour }} />
                <span className="text-sm font-semibold tracking-wide text-paper">{car.driver.acronym}</span>
                <span className="truncate text-[11px] text-dim">{car.driver.teamName}</span>
              </span>
              <span className={clsx('tnum text-right text-xs', f?.gap === 0 ? 'text-purple' : 'text-paper')}>
                {!f ? lapTime(car.time) : f.gap === 0 ? lapTime(car.time) : signed(f.gap)}
              </span>
              <span
                className={clsx(
                  'tnum text-right text-xs',
                  !f || f.gap === 0 ? 'text-dim' : f.live > 0 ? 'text-signal' : 'text-green',
                )}
              >
                {!f || f.gap === 0 ? '—' : signed(f.live)}
              </span>
              <span className="flex justify-end text-dim group-hover:text-paper">{off ? <EyeOff size={13} /> : <Eye size={13} />}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
