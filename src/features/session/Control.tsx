import type { Driver, RaceControlMessage, SessionBundle } from '@shared/types'
import clsx from 'clsx'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { useMemo, useState } from 'react'
import { AxisX, ChartFrame, GridY, nearestIndex, Tooltip } from '@/charts/core'
import { DriverTag, EmptyState, Panel, SectionTitle, Segmented, Stat } from '@/components/ui'
import { t } from '@/i18n'
import { clock } from '@/lib/format'
import type { TabProps } from './types'

type Filter = 'all' | 'flags' | 'sc' | 'stewards' | 'limits'
type FlagLabel = 'green' | 'clear' | 'yellow' | 'doubleYellow' | 'red' | 'blue' | 'chequered' | 'blackWhite' | 'blackOrange' | 'black'

const FLAG_STYLE: Record<string, { bg: string; fg: string; label: FlagLabel }> = {
  GREEN: { bg: 'var(--color-green)', fg: 'var(--color-ink)', label: 'green' },
  CLEAR: { bg: 'var(--color-line-2)', fg: 'var(--color-paper)', label: 'clear' },
  YELLOW: { bg: 'var(--color-yellow)', fg: 'var(--color-ink)', label: 'yellow' },
  'DOUBLE YELLOW': { bg: 'repeating-linear-gradient(90deg, var(--color-yellow) 0 6px, var(--color-ink) 6px 8px)', fg: 'var(--color-ink)', label: 'doubleYellow' },
  RED: { bg: 'var(--color-signal)', fg: 'white', label: 'red' },
  BLUE: { bg: 'var(--color-wet)', fg: 'white', label: 'blue' },
  CHEQUERED: { bg: 'repeating-conic-gradient(var(--color-paper) 0 25%, var(--color-ink) 0 50%) 0 0 / 8px 8px', fg: 'var(--color-ink)', label: 'chequered' },
  'BLACK AND WHITE': { bg: 'linear-gradient(135deg, var(--color-paper) 50%, var(--color-ink) 50%)', fg: 'var(--color-ink)', label: 'blackWhite' },
  'BLACK AND ORANGE': { bg: 'var(--color-amber)', fg: 'var(--color-ink)', label: 'blackOrange' },
  BLACK: { bg: 'var(--color-ink)', fg: 'var(--color-paper)', label: 'black' },
}

const isStewards = (m: RaceControlMessage) => /STEWARDS|INCIDENT|PENALTY|INVESTIGAT|REPRIMAND|SUMMONED/.test(m.message)
const isLimits = (m: RaceControlMessage) => /DELETED|TRACK LIMITS/.test(m.message) && !/STEWARDS/.test(m.message)
const isSc = (m: RaceControlMessage) => m.category === 'SafetyCar' || m.flag === 'RED'

function chip(m: RaceControlMessage) {
  if (m.flag && FLAG_STYLE[m.flag]) return { ...FLAG_STYLE[m.flag], label: t(`control.flag.${FLAG_STYLE[m.flag].label}`) }
  if (m.category === 'SafetyCar') return { bg: 'var(--color-amber)', fg: 'var(--color-ink)', label: /VSC|VIRTUAL/.test(m.message) ? 'VSC' : 'Safety car' }
  if (isStewards(m)) return { bg: 'transparent', fg: 'var(--color-signal)', label: t('control.chipStewards') }
  if (isLimits(m)) return { bg: 'transparent', fg: 'var(--color-amber)', label: t('control.chipLimits') }
  if (m.category === 'SessionStatus') return { bg: 'transparent', fg: 'var(--color-paper)', label: 'Session' }
  if (m.category === 'Drs') return { bg: 'transparent', fg: 'var(--color-green)', label: 'DRS' }
  return { bg: 'transparent', fg: 'var(--color-muted)', label: 'Info' }
}

/** Drivers named in a message: either the structured driver number or "CAR 87 (BEA)". */
function mentions(m: RaceControlMessage, drivers: Map<number, Driver>): Driver[] {
  const nums = new Set<number>()
  if (m.driverNumber) nums.add(m.driverNumber)
  for (const match of m.message.matchAll(/CARS? (\d{1,2})\b/g)) nums.add(Number(match[1]))
  for (const match of m.message.matchAll(/\b(\d{1,2}) \([A-Z]{3}\)/g)) nums.add(Number(match[1]))
  return [...nums].map((n) => drivers.get(n)).filter((d): d is Driver => Boolean(d))
}

function groupKey(m: RaceControlMessage, race: boolean) {
  if (race) return m.lap ? t('control.lapN', { n: m.lap }) : t('control.beforeStart')
  if (m.qualifyingPhase) return `Q${m.qualifyingPhase}`
  return t('control.hour', { h: clock(m.date).slice(0, 2) })
}

function Messages({ bundle, drivers }: Pick<TabProps, 'bundle' | 'drivers'>) {
  const [filter, setFilter] = useState<Filter>('all')
  const [blue, setBlue] = useState(false)
  const race = bundle.session.kind === 'race' || bundle.session.kind === 'sprint'
  const counts = useMemo(
    () => ({
      flags: bundle.raceControl.filter((m) => m.category === 'Flag' && m.flag !== 'BLUE').length,
      sc: bundle.raceControl.filter(isSc).length,
      stewards: bundle.raceControl.filter(isStewards).length,
      limits: bundle.raceControl.filter(isLimits).length,
      blue: bundle.raceControl.filter((m) => m.flag === 'BLUE').length,
    }),
    [bundle],
  )
  const groups = useMemo(() => {
    const keep = (m: RaceControlMessage) => {
      if (m.flag === 'BLUE' && !blue) return false
      switch (filter) {
        case 'flags':
          return m.category === 'Flag'
        case 'sc':
          return isSc(m)
        case 'stewards':
          return isStewards(m)
        case 'limits':
          return isLimits(m)
        default:
          return true
      }
    }
    const out: { key: string; items: RaceControlMessage[] }[] = []
    for (const m of bundle.raceControl.filter(keep)) {
      const key = groupKey(m, race)
      const last = out.at(-1)
      if (last?.key === key) last.items.push(m)
      else out.push({ key, items: [m] })
    }
    return out
  }, [bundle, filter, blue, race])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto [&_button]:whitespace-nowrap">
        <Segmented
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: t('control.filterAll') },
            { value: 'flags', label: t('control.filterFlags', { n: counts.flags }) },
            { value: 'sc', label: t('control.filterSc', { n: counts.sc }), disabled: !counts.sc },
            { value: 'stewards', label: t('control.filterStewards', { n: counts.stewards }), disabled: !counts.stewards },
            { value: 'limits', label: t('control.filterLimits', { n: counts.limits }), disabled: !counts.limits },
          ]}
        />
        </div>
        {counts.blue > 0 && (
          <label className="flex cursor-pointer items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            <input type="checkbox" checked={blue} onChange={(e) => setBlue(e.target.checked)} className="accent-[var(--color-wet)]" />
            {t('control.blueFlags', { n: counts.blue })}
          </label>
        )}
      </div>
      {!groups.length ? (
        <EmptyState title={t('control.noMessages')} />
      ) : (
        <Panel flat className="max-h-[720px] overflow-y-auto">
          {groups.map((g, gi) => (
            <div key={`${gi}-${g.key}`} className="grid grid-cols-[64px_1fr] border-b border-line/60 sm:grid-cols-[88px_1fr]">
              <div className="sticky top-0 self-start px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-signal">{g.key}</div>
              <div className="border-l border-line/60">
                {g.items.map((m, i) => {
                  const c = chip(m)
                  const who = mentions(m, drivers)
                  return (
                    <div key={i} className="flex flex-col gap-1.5 px-3 py-2.5 hover:bg-panel-2 sm:flex-row sm:items-start sm:gap-3">
                      <div className="flex shrink-0 items-center gap-2 sm:w-44">
                        <span className="tnum text-[10px] text-dim">{clock(m.date)}</span>
                        <span
                          className={clsx('px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider', c.bg === 'transparent' && 'border border-current')}
                          style={{ background: c.bg, color: c.fg }}
                        >
                          {c.label}
                          {m.sector ? ` · S${m.sector}` : ''}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 text-[13px] leading-snug text-paper/85">{m.message}</div>
                      {who.length > 0 && (
                        <div className="flex shrink-0 gap-3">
                          {who.slice(0, 3).map((d) => (
                            <DriverTag key={d.number} driver={d} size="sm" />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </Panel>
      )}
    </div>
  )
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

function Weather({ bundle }: { bundle: SessionBundle }) {
  const [hover, setHover] = useState<number | null>(null)
  // the feed occasionally reports 0 °C / 0 % samples: drop them
  const w = useMemo(() => bundle.weather.filter((x) => x.air > 0 && x.track > 0 && x.humidity > 0), [bundle])
  const start = Date.parse(bundle.session.dateStart)
  const pts = useMemo(() => w.map((s) => ({ ...s, m: (Date.parse(s.date) - start) / 60_000 })), [w, start])
  if (!pts.length) return <EmptyState title={t('control.noWeather')} />
  const avg = (f: (x: (typeof pts)[number]) => number) => pts.reduce((a, x) => a + f(x), 0) / pts.length
  const temps = pts.flatMap((p) => [p.air, p.track])
  // wind direction: vector mean
  const vx = avg((p) => Math.sin((p.windDir * Math.PI) / 180) * p.windSpeed)
  const vy = avg((p) => Math.cos((p.windDir * Math.PI) / 180) * p.windSpeed)
  const dir = ((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360
  const rainy = pts.filter((p) => p.rain).length
  const ms = pts.map((p) => p.m)

  return (
    <div className="space-y-4">
      <Panel className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4 xl:grid-cols-2">
        <Stat label={t('control.air')} value={`${avg((p) => p.air).toFixed(1)}°`} sub={`${Math.min(...pts.map((p) => p.air)).toFixed(0)}–${Math.max(...pts.map((p) => p.air)).toFixed(0)} °C`} />
        <Stat label={t('control.track')} value={`${avg((p) => p.track).toFixed(1)}°`} sub={`${Math.min(...pts.map((p) => p.track)).toFixed(0)}–${Math.max(...pts.map((p) => p.track)).toFixed(0)} °C`} accent="var(--color-signal)" />
        <Stat label={t('control.humidity')} value={t('control.percent', { n: avg((p) => p.humidity).toFixed(0) })} sub={`${avg((p) => p.pressure).toFixed(0)} hPa`} />
        <div>
          <div className="eyebrow mb-1.5">{t('control.wind')}</div>
          <div className="flex items-center gap-3">
            <svg viewBox="-12 -12 24 24" className="size-9 shrink-0">
              <circle r={11} fill="none" stroke="var(--color-line-2)" />
              <g transform={`rotate(${dir + 180})`}>
                <path d="M0 -8 L3.5 5 L0 2.5 L-3.5 5 Z" fill="var(--color-paper)" />
              </g>
            </svg>
            <div>
              <div className="tnum whitespace-nowrap text-xl">{(avg((p) => p.windSpeed) * 3.6).toFixed(0)} km/h</div>
              <div className="text-xs text-muted">{t('control.windFrom', { dir: t(`control.compass.${COMPASS[Math.round(dir / 45) % 8]}`) })}</div>
            </div>
          </div>
        </div>
      </Panel>
      <Panel className="p-3 sm:p-4">
        <ChartFrame
          height={260}
          ariaLabel={t('control.temperatures')}
          onPointer={(p) => setHover(p ? p.x : null)}
          overlay={({ width }) => {
            if (hover === null) return null
            const x = scaleLinear().domain([Math.min(...ms), Math.max(...ms)]).range([0, width])
            const p = pts[nearestIndex(ms, x.invert(hover))]
            return (
              <Tooltip x={x(p.m)} width={width} top={8}>
                <div className="eyebrow mb-1">{clock(p.date)}</div>
                <div className="tnum">{t('control.air')} {p.air.toFixed(1)}° · {t('control.track')} <span className="text-signal">{p.track.toFixed(1)}°</span></div>
                <div className="tnum text-dim">{t('control.tooltipHumidity', { n: p.humidity.toFixed(0) })}{p.rain ? ` · ${t('control.rain')}` : ''}</div>
              </Tooltip>
            )
          }}
        >
          {({ width, height }) => {
            const x = scaleLinear().domain([Math.min(...ms), Math.max(...ms)]).range([0, width])
            const y = scaleLinear().domain([Math.min(...temps) - 2, Math.max(...temps) + 2]).range([height, 0]).nice()
            const mk = (k: 'air' | 'track') =>
              line<(typeof pts)[number]>()
                .x((p) => x(p.m))
                .y((p) => y(p[k]))(pts) ?? ''
            const step = pts.length > 1 ? (ms.at(-1)! - ms[0]) / (pts.length - 1) : 1
            return (
              <>
                {pts.map((p, i) => (p.rain ? <rect key={i} x={x(p.m - step / 2)} width={Math.max(1, x(step) - x(0))} height={height} fill="var(--color-wet)" opacity={0.18} /> : null))}
                <GridY scale={y} width={width} ticks={5} format={(v) => `${v}°`} />
                <AxisX scale={x} height={height} ticks={Math.max(4, Math.floor(width / 70))} format={(v) => `${Math.round(v)}′`} label={t('control.minutesSinceStart')} />
                <path d={mk('track')} fill="none" stroke="var(--color-signal)" strokeWidth={2} />
                <path d={mk('air')} fill="none" stroke="var(--color-paper)" strokeOpacity={0.7} strokeWidth={1.6} />
                {hover !== null && <line x1={hover} x2={hover} y2={height} stroke="var(--color-paper)" strokeOpacity={0.25} />}
              </>
            )
          }}
        </ChartFrame>
        <div className="mt-2 flex flex-wrap gap-4 border-t border-line pt-3 text-[11px] text-dim">
          <span><span className="text-signal">━</span> {t('control.legendTrack')}</span>
          <span><span className="text-paper/70">━</span> {t('control.legendAir')}</span>
          {rainy > 0 && <span><span className="text-wet">■</span> {t('control.rain')}</span>}
        </div>
      </Panel>
    </div>
  )
}

export default function Control({ bundle, drivers }: TabProps) {
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="min-w-0">
        <SectionTitle index="01" title={t('control.title')} aside={t('control.messages', { count: bundle.raceControl.length })} />
        <Messages bundle={bundle} drivers={drivers} />
      </section>
      <section className="min-w-0">
        <SectionTitle index="02" title={t('control.weather')} />
        <Weather bundle={bundle} />
      </section>
    </div>
  )
}
