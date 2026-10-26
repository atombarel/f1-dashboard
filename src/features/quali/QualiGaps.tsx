import type { CircuitLayout, SessionBundle } from '@shared/types'
import { useQueries, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Flag, Pause, Play, RotateCcw } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { EmptyState, Panel, SectionTitle, Segmented, StartLights } from '@/components/ui'
import { t } from '@/i18n'
import { circuitQuery, telemetryQuery } from '@/lib/api'
import { onDark } from '@/lib/colors'
import { lapTime } from '@/lib/format'
import { sessionRoute } from '@/router'
import type { TabProps } from '@/features/session/types'
import { TelemetryPending, useRequestTelemetry } from '@/features/telemetry/pending'
import { centerlineFromLap, centerlineFromLayout, type Centerline } from './centerline'
import { FinishCam } from './FinishCam'
import { GapTower } from './GapTower'
import { GhostMap } from './GhostMap'
import { prepareGhost, speedAt } from './ghost'
import { qualiSegments, segmentEntries, type SegmentId } from './segments'
import { frameAt, spanAt, type GhostCar } from './stage'
import { SPEEDS, useLapClock, type Speed } from './useLapClock'

/**
 * Qualifying gaps: every driver's reference lap (Q1, Q2 or Q3) replayed as ghosts released together.
 * The default frame is the instant the fastest car takes the flag, with everyone at their real distance.
 */
export default function QualiGaps({ meta, bundle }: TabProps) {
  const search = sessionRoute.useSearch()
  const navigate = sessionRoute.useNavigate()
  const segments = useMemo(() => qualiSegments(bundle), [bundle])
  const seg = search.seg && segments.includes(search.seg) ? search.seg : segments[segments.length - 1]
  const entries = useMemo(() => segmentEntries(bundle, seg), [bundle, seg])

  useRequestTelemetry(meta, entries[0]?.driver.number)
  const tels = useQueries({
    queries: entries.map((e) => ({ ...telemetryQuery(meta.telemetryUrl ?? '', e.driver.number), enabled: Boolean(meta.telemetryUrl) })),
  })
  const layout = useQuery({ ...circuitQuery(meta.circuitUrl ?? ''), enabled: Boolean(meta.circuitUrl) })
  const stamp = tels.map((q) => q.dataUpdatedAt).join()

  const built = useMemo(() => {
    const laps = entries.map((e, i) => tels[i]?.data?.laps[e.lap.n])
    const first = entries.findIndex((_, i) => laps[i] && laps[i].t.length >= 10)
    if (first < 0) return null
    const ref = prepareGhost(laps[first]!, entries[first].time, null)
    const cars: GhostCar[] = []
    const missing: string[] = []
    entries.forEach((e, i) => {
      const lap = laps[i]
      if (!lap || lap.t.length < 10) return void missing.push(e.driver.acronym)
      cars.push({
        driver: e.driver,
        colour: onDark(e.driver.teamColour),
        ghost: i === first ? ref : prepareGhost(lap, e.time, ref.length),
        lap: e.lap,
        time: e.time,
        rank: cars.length,
      })
    })
    return { cars, missing, refLap: laps[first]! }
    // `tels` changes identity on every render, its data only changes with `stamp`
  }, [entries, stamp])

  const line = useMemo<Centerline | null>(() => {
    if (!built) return null
    const length = built.cars[0].ghost.length
    return layout.data ? centerlineFromLayout(layout.data, built.refLap, length) : centerlineFromLap(built.refLap, length)
  }, [built, layout.data])

  const setSeg = (s: SegmentId) => navigate({ search: (p) => ({ ...p, seg: s }), replace: true, resetScroll: false })
  const loaded = tels.filter((q) => !q.isPending).length

  if (!meta.telemetryUrl) return <TelemetryPending />
  if (entries.length < 2) return <EmptyState title={t('quali.notEnough')}>{t('quali.notEnoughBody')}</EmptyState>

  return (
    <div className="space-y-6">
      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">{t('quali.segment')}</span>
          <Segmented items={segments.map((s) => ({ value: s, label: segmentLabel(s, bundle) }))} value={seg} onChange={setSeg} />
        </div>
        <span className="text-[11px] text-dim">{t('quali.segmentHint', { n: entries.length })}</span>
      </Panel>

      {loaded < entries.length || (meta.circuitUrl && layout.isPending) ? (
        <StartLights label={t('quali.loading', { n: loaded, total: entries.length })} />
      ) : !built || !line || built.cars.length < 2 ? (
        <EmptyState title={t('quali.notEnough')}>{t('quali.notEnoughBody')}</EmptyState>
      ) : (
        <Stage key={seg} cars={built.cars} missing={built.missing} line={line} layout={layout.data} title={`${segmentLabel(seg, bundle)} · ${meta.meeting.name}`} />
      )}
    </div>
  )
}

function segmentLabel(s: SegmentId, bundle: SessionBundle) {
  if (s === 'best') return t('quali.bestLap')
  return bundle.session.kind === 'sprint_qualifying' ? s.replace('q', 'SQ') : s.toUpperCase()
}

function Stage({ cars, missing, line, layout, title }: { cars: GhostCar[]; missing: string[]; line: Centerline; layout: CircuitLayout | undefined; title: string }) {
  const [hidden, setHidden] = useState<Set<number>>(() => new Set())
  const visible = useMemo(() => cars.filter((c) => !hidden.has(c.driver.number)), [cars, hidden])
  const reference = visible[0]
  const clock = useLapClock(Math.max(...cars.map((c) => c.time)) + 1.5, cars[0].time)
  const { frames, anchor } = useMemo(() => frameAt(visible, clock.t), [visible, clock.t])

  const span = useMemo(() => spanAt(visible, clock.t), [visible, clock.t])

  const toggle = (n: number) =>
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(n)) next.delete(n)
      else if (cars.length - next.size > 2) next.add(n) // keep at least two cars
      return next
    })
  const showOnly = (keep: number[]) => setHidden(new Set(cars.map((c) => c.driver.number).filter((n) => !keep.includes(n))))

  const s1 = reference.lap.s1
  const s2 = reference.lap.s2
  const sector = clock.t >= reference.time ? null : s1 !== null && clock.t < s1 ? 1 : s1 !== null && s2 !== null && clock.t < s1 + s2 ? 2 : 3
  const marks = [s1, s1 !== null && s2 !== null ? s1 + s2 : null].filter((m): m is number => m !== null)

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <Panel className="overflow-hidden">
          <FinishCam line={line} frames={frames} t={clock.t} anchor={anchor} span={span} ariaLabel={t('quali.camAria')}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-carbon via-carbon/75 to-transparent" />
            <div className="pointer-events-none absolute left-4 top-3 max-w-[58%]">
              <div className="eyebrow truncate">{title}</div>
              <div className="display text-3xl leading-none text-paper sm:text-4xl">{t('quali.title')}</div>
            </div>
            <div className="pointer-events-none absolute right-4 top-3 text-right">
              <div className="eyebrow">{sector ? t('quali.sector', { n: sector }) : t('quali.flag')}</div>
              <div className="tnum text-2xl leading-none text-paper">{lapTime(Math.min(clock.t, Math.max(...visible.map((c) => c.time))))}</div>
              <div className="tnum mt-1 text-[11px] text-muted">
                {reference.driver.acronym} · {Math.round(speedAt(reference.ghost, clock.t))} km/h
              </div>
            </div>
          </FinishCam>
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={clock.toggle}
            className="flex h-10 w-24 items-center justify-center gap-2 bg-signal font-mono text-xs uppercase tracking-wider text-white transition-transform active:scale-95"
            aria-label={clock.playing ? t('quali.pause') : t('quali.play')}
          >
            {clock.playing ? <Pause size={15} /> : <Play size={15} />}
            {clock.playing ? t('quali.pause') : t('quali.play')}
          </button>
          <button
            onClick={() => clock.seek(0)}
            className="flex size-10 items-center justify-center border border-line-2 text-muted hover:text-paper"
            aria-label={t('quali.restart')}
            title={t('quali.restart')}
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={() => {
              clock.pause()
              clock.seek(reference.time)
            }}
            className="flex h-10 items-center gap-2 border border-line-2 px-3 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-paper"
          >
            <Flag size={14} />
            {t('quali.finish')}
          </button>
          <Segmented items={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} value={clock.speed} onChange={(v: Speed) => clock.setSpeed(v)} />
        </div>

        <LapScrubber t={clock.t} end={Math.max(...cars.map((c) => c.time)) + 1.5} flag={reference.time} marks={marks} onSeek={clock.seek} />

        <div className="pt-2">
          <SectionTitle index="G2" title={t('quali.map')} />
          <Panel className="p-2">
            <GhostMap line={line} rotation={layout?.rotation ?? 0} frames={frames} window={[anchor - span, anchor + span * 0.12]} />
          </Panel>
        </div>
      </div>

      <div className="space-y-6 lg:col-span-4">
        <div>
          <SectionTitle
            index="G1"
            title={t('quali.order')}
            aside={
              <span className="flex gap-1">
                <PresetButton active={hidden.size === 0} onClick={() => setHidden(new Set())}>
                  {t('quali.all')}
                </PresetButton>
                <PresetButton active={visible.length === 2 && visible[0] === cars[0] && visible[1] === cars[1]} onClick={() => showOnly([cars[0], cars[1]].map((c) => c.driver.number))}>
                  {t('quali.duel')}
                </PresetButton>
              </span>
            }
          />
          <Panel flat className="overflow-hidden">
            <GapTower all={cars} frames={frames} hidden={hidden} onToggle={toggle} />
          </Panel>
        </div>
        <p className="text-[11px] leading-relaxed text-dim">
          {t('quali.footnote')}
          {missing.length > 0 && <> {t('quali.missing', { drivers: missing.join(', ') })}</>}
        </p>
      </div>
    </div>
  )
}

function PresetButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
        active ? 'border-paper bg-paper text-ink' : 'border-line-2 text-muted hover:text-paper',
      )}
    >
      {children}
    </button>
  )
}

function LapScrubber({ t: now, end, flag, marks, onSeek }: { t: number; end: number; flag: number; marks: number[]; onSeek: (t: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = (v: number) => `${(Math.max(0, Math.min(end, v)) / end) * 100}%`
  const toT = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return ((clientX - r.left) / r.width) * end
  }
  return (
    <div className="select-none">
      <div
        ref={ref}
        role="slider"
        aria-label={t('quali.scrubberAria')}
        aria-valuemin={0}
        aria-valuemax={Math.round(end * 1000)}
        aria-valuenow={Math.round(now * 1000)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(now + 1)
          else if (e.key === 'ArrowLeft') onSeek(now - 1)
        }}
        className="relative h-9 cursor-pointer touch-none outline-none"
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          onSeek(toT(e.clientX))
        }}
        onPointerMove={(e) => dragging.current && onSeek(toT(e.clientX))}
        onPointerUp={() => (dragging.current = false)}
      >
        <div className="absolute inset-x-0 top-3 h-3 bg-panel-2" />
        <div className="pointer-events-none absolute left-0 top-3 h-3 bg-paper/25" style={{ width: pct(now) }}>
          <div className="absolute -right-px -top-1.5 h-6 w-0.5 bg-signal shadow-[0_0_10px_var(--color-signal)]" />
        </div>
        {marks.map((m, i) => (
          <div key={m} className="pointer-events-none absolute top-[26px] -translate-x-1/2 font-mono text-[9px] text-dim" style={{ left: pct(m) }}>
            <div className="mx-auto mb-0.5 h-1.5 w-px bg-line-2" />
            {t('quali.sector', { n: i + 2 })}
          </div>
        ))}
        <div className="pointer-events-none absolute top-1 h-7 w-px bg-purple" style={{ left: pct(flag) }} />
      </div>
    </div>
  )
}
