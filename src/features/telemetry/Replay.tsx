import type { CircuitLayout, Compound, Driver, ReplayData, SessionBundle } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWidth } from '@/charts/core'
import { EmptyState, Panel, Segmented, StartLights, TyreBadge } from '@/components/ui'
import { circuitQuery, replayQuery } from '@/lib/api'
import { onDark } from '@/lib/colors'
import type { TabProps } from '@/features/session/types'
import { bisectRight, makeProjection } from './math'
import { TelemetryPending, useRequestTelemetry } from './pending'

const SPEEDS = [1, 4, 16, 64] as const
type Speed = (typeof SPEEDS)[number]

interface Car {
  driver: Driver
  colour: string
  x: Int32Array
  y: Int32Array
}

interface Timeline {
  /** per driver, sorted times (s since session start) at which each lap was completed */
  ends: Map<number, number[]>
  /** leader (winner) lap start times, index 0 = lap 1 */
  leaderStarts: number[]
  raceStart: number
  raceEnd: number
  retiredAfter: Map<number, number>
}

function buildTimeline(bundle: SessionBundle): Timeline {
  const ends = new Map<number, number[]>()
  for (const [drv, laps] of Object.entries(bundle.laps)) {
    const e: number[] = []
    laps.forEach((l, i) => {
      const next = laps[i + 1]
      const end = next && next.n === l.n + 1 && next.at !== null ? next.at : l.at !== null && l.t !== null ? l.at + l.t : null
      if (end !== null) e.push(end)
    })
    ends.set(Number(drv), e.sort((a, b) => a - b))
  }
  const winner = bundle.results[0]?.driverNumber
  const leaderStarts = (bundle.laps[winner] ?? []).map((l) => l.at).filter((a): a is number => a !== null)
  const raceStart = leaderStarts[0] ?? 0
  const winnerEnds = ends.get(winner) ?? []
  const raceEnd = winnerEnds.at(-1) ?? raceStart
  const retiredAfter = new Map<number, number>()
  for (const r of bundle.results)
    if (r.status === 'dnf' || r.status === 'dsq' || r.status === 'dns') retiredAfter.set(r.driverNumber, (ends.get(r.driverNumber)?.at(-1) ?? raceStart) + 20)
  return { ends, leaderStarts, raceStart, raceEnd, retiredAfter }
}

interface Row {
  driver: Driver
  colour: string
  laps: number
  gap: string
  compound: Compound | null
  out: boolean
}

function standingsAt(T: number, bundle: SessionBundle, tl: Timeline, drivers: Map<number, Driver>): Row[] {
  const grid = new Map(bundle.results.map((r) => [r.driverNumber, r.grid ?? bundle.positions[r.driverNumber]?.[0] ?? 99]))
  const rows = [...tl.ends.entries()]
    .filter(([d]) => drivers.has(d))
    .map(([d, ends]) => {
      const k = bisectRight(ends, T) + 1
      return { d, k, last: k ? ends[k - 1] : -Infinity, out: (tl.retiredAfter.get(d) ?? Infinity) < T }
    })
  rows.sort((a, b) => Number(a.out) - Number(b.out) || b.k - a.k || a.last - b.last || (grid.get(a.d) ?? 99) - (grid.get(b.d) ?? 99))
  const leader = rows[0]
  const leaderEnds = tl.ends.get(leader?.d) ?? []
  return rows.map((r, i) => {
    let gap = '—'
    if (r.out) gap = 'ABD'
    else if (i === 0) gap = r.k ? `T${Math.min(r.k + 1, bundle.totalLaps)}` : 'Grille'
    else if (r.k > 0) {
      const myEnd = r.last
      const lapsDown = bisectRight(leaderEnds, myEnd) + 1 - r.k
      gap = lapsDown >= 1 ? `+${lapsDown} T` : `+${(myEnd - leaderEnds[r.k - 1]).toFixed(1)}`
    }
    const stint = bundle.stints.find((s) => s.driverNumber === r.d && r.k + 1 >= s.lapStart && r.k + 1 <= s.lapEnd)
    const driver = drivers.get(r.d)!
    return { driver, colour: onDark(driver.teamColour), laps: r.k, gap, compound: stint?.compound ?? null, out: r.out }
  })
}

function clockOf(s: number) {
  const t = Math.max(0, Math.floor(s))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = t % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function Replay({ meta, bundle, ordered, drivers }: TabProps) {
  useRequestTelemetry(meta, ordered[0]?.number)
  const replay = useQuery({ ...replayQuery(meta.replayUrl ?? ''), enabled: Boolean(meta.replayUrl) })
  const layout = useQuery({ ...circuitQuery(meta.circuitUrl ?? ''), enabled: Boolean(meta.circuitUrl) })

  if (!meta.telemetryUrl) return <TelemetryPending title="Replay en préparation" />
  if (!meta.replayUrl) return <EmptyState title="Pas de replay">Le replay n’est disponible que pour les courses et les sprints.</EmptyState>
  if (replay.isPending || (meta.circuitUrl && layout.isPending)) return <StartLights label="Chargement du replay" />
  if (replay.isError) return <EmptyState title="Replay indisponible">{(replay.error as Error).message}</EmptyState>
  return <ReplayPlayer data={replay.data} layout={layout.data} bundle={bundle} drivers={drivers} />
}

function ReplayPlayer({ data, layout, bundle, drivers }: { data: ReplayData; layout: CircuitLayout | undefined; bundle: SessionBundle; drivers: Map<number, Driver> }) {
  const cars = useMemo<Car[]>(() => {
    const out: Car[] = []
    for (const [n, c] of Object.entries(data.cars)) {
      const driver = drivers.get(Number(n))
      if (!driver) continue
      const x = new Int32Array(c.dx.length)
      const y = new Int32Array(c.dy.length)
      let ax = 0
      let ay = 0
      for (let i = 0; i < c.dx.length; i++) {
        x[i] = ax += c.dx[i]
        y[i] = ay += c.dy[i]
      }
      out.push({ driver, colour: onDark(driver.teamColour), x, y })
    }
    return out
  }, [data, drivers])
  const tl = useMemo(() => buildTimeline(bundle), [bundle])

  // outline: official layout, else a lap of the winner's trace
  const outline = useMemo(() => {
    if (layout) return { x: layout.x, y: layout.y, rotation: layout.rotation, closed: true }
    const w = cars.find((c) => c.driver.number === bundle.results[0]?.driverNumber) ?? cars[0]
    const s = Math.max(0, Math.round((tl.leaderStarts[1] ?? tl.raceStart) - data.start))
    const e = Math.min(data.length - 1, Math.round((tl.leaderStarts[2] ?? tl.raceStart + 120) - data.start))
    return { x: Array.from(w?.x.slice(s, e) ?? []), y: Array.from(w?.y.slice(s, e) ?? []), rotation: 0, closed: false }
  }, [layout, cars, bundle, tl, data])

  const tStart = Math.max(data.start, tl.raceStart - 5)
  const tEnd = Math.min(data.start + data.length - 1, tl.raceEnd + 30)

  const tRef = useRef(tStart)
  const [displayT, setDisplayT] = useState(tStart)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(16)
  const [focus, setFocus] = useState<number | null>(null)
  const dirty = useRef(true)

  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const aspect = useMemo(() => makeProjection(outline.x, outline.y, outline.rotation, 1000, 1000, 0).aspect, [outline])
  const height = Math.round(Math.min(640, Math.max(300, width * Math.min(aspect, 1)))) || 400
  const proj = useMemo(() => makeProjection(outline.x, outline.y, outline.rotation, width || 1, height, 34), [outline, width, height])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const neutralAt = useCallback(
    (T: number) =>
      bundle.neutralizations.find((n) => {
        const s = tl.leaderStarts[n.lapStart - 1]
        const e = tl.ends.get(bundle.results[0]?.driverNumber)?.[n.lapEnd - 1] ?? tl.leaderStarts[n.lapEnd]
        return s !== undefined && e !== undefined && T >= s && T <= e
      }),
    [bundle, tl],
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !width) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const css = getComputedStyle(document.documentElement)
    const T = tRef.current
    const neutral = neutralAt(T)

    // track
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i < outline.x.length; i++) {
      const [px, py] = proj.project(outline.x[i], outline.y[i])
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    if (outline.closed) ctx.closePath()
    ctx.strokeStyle = css.getPropertyValue('--color-line').trim() || '#242932'
    ctx.lineWidth = 18
    ctx.stroke()
    ctx.strokeStyle = css.getPropertyValue('--color-panel-2').trim() || '#181c22'
    ctx.lineWidth = 14
    ctx.stroke()
    ctx.strokeStyle = neutral
      ? neutral.type === 'RED'
        ? css.getPropertyValue('--color-signal').trim()
        : css.getPropertyValue('--color-yellow').trim()
      : css.getPropertyValue('--color-line-2').trim() || '#313743'
    ctx.lineWidth = neutral ? 2 : 1
    ctx.globalAlpha = neutral ? 0.8 : 1
    ctx.stroke()
    ctx.globalAlpha = 1

    // cars, interpolated between the 1 s samples
    const f = (T - data.start) / data.step
    const i0 = Math.max(0, Math.min(data.length - 1, Math.floor(f)))
    const i1 = Math.min(data.length - 1, i0 + 1)
    const k = Math.max(0, Math.min(1, f - i0))
    const ordered = [...cars].sort((a, b) => Number(a.driver.number === focus) - Number(b.driver.number === focus))
    ctx.font = '600 9px "Martian Mono Variable", monospace'
    ctx.textBaseline = 'middle'
    for (const car of ordered) {
      if ((tl.retiredAfter.get(car.driver.number) ?? Infinity) < T) continue
      const x = car.x[i0] + (car.x[i1] - car.x[i0]) * k
      const y = car.y[i0] + (car.y[i1] - car.y[i0]) * k
      if (x === 0 && y === 0) continue
      const [px, py] = proj.project(x, y)
      const isFocus = focus === car.driver.number
      const dim = focus !== null && !isFocus
      ctx.globalAlpha = dim ? 0.35 : 1
      if (isFocus) {
        ctx.beginPath()
        ctx.arc(px, py, 13, 0, Math.PI * 2)
        ctx.fillStyle = car.colour + '33'
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(px, py, isFocus ? 7 : 5.5, 0, Math.PI * 2)
      ctx.fillStyle = car.colour
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#08090b'
      ctx.stroke()
      if (!dim || isFocus) {
        ctx.fillStyle = isFocus ? '#ffffff' : 'rgba(236,238,242,.82)'
        ctx.fillText(car.driver.acronym, px + 9, py - 7)
      }
    }
    ctx.globalAlpha = 1
  }, [width, height, outline, proj, cars, data, focus, tl, neutralAt])

  // animation loop: advance the clock while playing, redraw when something changed
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (playing) {
        tRef.current = Math.min(tEnd, tRef.current + dt * speed)
        if (tRef.current >= tEnd) setPlaying(false)
        dirty.current = true
      }
      if (dirty.current) {
        draw()
        if (progressRef.current) progressRef.current.style.width = `${((tRef.current - tStart) / (tEnd - tStart)) * 100}%`
        if (now - lastUi > 200) {
          lastUi = now
          setDisplayT(tRef.current)
        }
        dirty.current = playing
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, draw, tStart, tEnd])

  useEffect(() => {
    dirty.current = true
  }, [draw])

  useEffect(() => {
    const onVis = () => document.hidden && setPlaying(false)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const seek = (T: number) => {
    tRef.current = Math.max(tStart, Math.min(tEnd, T))
    setDisplayT(tRef.current)
    dirty.current = true
  }

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    const f = (tRef.current - data.start) / data.step
    const i = Math.max(0, Math.min(data.length - 1, Math.round(f)))
    let best: number | null = null
    let bestD = 18 * 18
    for (const c of cars) {
      const [px, py] = proj.project(c.x[i], c.y[i])
      const d = (px - mx) ** 2 + (py - my) ** 2
      if (d < bestD) {
        bestD = d
        best = c.driver.number
      }
    }
    setFocus((cur) => (best === null || cur === best ? null : best))
    dirty.current = true
  }

  const rows = useMemo(() => standingsAt(displayT, bundle, tl, drivers), [displayT, bundle, tl, drivers])
  const leaderLaps = rows[0]?.laps ?? 0
  const neutral = neutralAt(displayT)
  const span = tEnd - tStart
  const pct = (T: number) => `${((T - tStart) / span) * 100}%`

  return (
    <div
      className="grid gap-6 outline-none lg:grid-cols-12"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault()
          setPlaying((p) => !p)
        } else if (e.key === 'ArrowRight') seek(tRef.current + 10 * Math.max(1, speed / 4))
        else if (e.key === 'ArrowLeft') seek(tRef.current - 10 * Math.max(1, speed / 4))
      }}
    >
      <div className="lg:col-span-8">
        <Panel className="relative overflow-hidden">
          <div className="absolute left-4 top-4 z-10 flex flex-col gap-1">
            <div className="eyebrow">Tour</div>
            <div className="display text-5xl leading-none">
              {Math.min(Math.max(1, leaderLaps + 1), bundle.totalLaps)}
              <span className="text-2xl text-dim">/{bundle.totalLaps}</span>
            </div>
            <div className="tnum text-xs text-muted">{clockOf(displayT - tl.raceStart)}</div>
          </div>
          {neutral && (
            <div
              className={clsx(
                'absolute right-4 top-4 z-10 border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest',
                neutral.type === 'RED' ? 'border-signal bg-signal text-white' : 'border-yellow bg-yellow text-ink',
              )}
            >
              {neutral.type === 'SC' ? 'Safety car' : neutral.type === 'VSC' ? 'Virtual safety car' : 'Drapeau rouge'}
            </div>
          )}
          <div ref={wrapRef} className="w-full">
            <canvas ref={canvasRef} onClick={onCanvasClick} style={{ width: '100%', height }} className="block cursor-pointer" aria-label="Replay de la course" />
          </div>
        </Panel>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              if (tRef.current >= tEnd) seek(tStart)
              setPlaying((p) => !p)
            }}
            className="flex h-10 w-24 items-center justify-center gap-2 bg-signal font-mono text-xs uppercase tracking-wider text-white transition-transform active:scale-95"
            aria-label={playing ? 'Pause' : 'Lecture'}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            {playing ? 'Pause' : 'Lecture'}
          </button>
          <button onClick={() => seek(tStart)} className="flex size-10 items-center justify-center border border-line-2 text-muted hover:text-paper" aria-label="Revenir au départ">
            <RotateCcw size={15} />
          </button>
          <Segmented items={SPEEDS.map((s) => ({ value: String(s) as `${Speed}`, label: `${s}×` }))} value={String(speed) as `${Speed}`} onChange={(v) => setSpeed(Number(v) as Speed)} />
          <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-wider text-dim sm:inline">Espace · ← →</span>
        </div>

        <Scrubber
          tStart={tStart}
          tEnd={tEnd}
          pct={pct}
          progressRef={progressRef}
          leaderStarts={tl.leaderStarts}
          bands={bundle.neutralizations.map((n) => ({
            type: n.type,
            s: tl.leaderStarts[n.lapStart - 1] ?? tStart,
            e: tl.ends.get(bundle.results[0]?.driverNumber)?.[n.lapEnd - 1] ?? tl.leaderStarts[n.lapEnd] ?? tEnd,
          }))}
          onSeek={seek}
        />
      </div>

      <div className="lg:col-span-4">
        <Panel flat className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="eyebrow">Classement en direct</span>
            <span className="eyebrow">Écart</span>
          </div>
          <Leaderboard rows={rows} focus={focus} onFocus={(n) => { setFocus((c) => (c === n ? null : n)); dirty.current = true }} />
        </Panel>
        <p className="mt-3 text-[11px] leading-relaxed text-dim">
          Positions GPS à 1 Hz interpolées. Cliquez sur une voiture ou un pilote pour le suivre.
        </p>
      </div>
    </div>
  )
}

const ROW_H = 30

function Leaderboard({ rows, focus, onFocus }: { rows: Row[]; focus: number | null; onFocus: (n: number) => void }) {
  // rows are absolutely positioned so overtakes animate as the order changes
  const index = new Map(rows.map((r, i) => [r.driver.number, i]))
  const stable = [...rows].sort((a, b) => a.driver.number - b.driver.number)
  return (
    <div className="relative" style={{ height: rows.length * ROW_H }}>
      {stable.map((r) => {
        const i = index.get(r.driver.number)!
        const on = focus === r.driver.number
        return (
          <button
            key={r.driver.number}
            onClick={() => onFocus(r.driver.number)}
            className={clsx(
              'absolute inset-x-0 flex items-center gap-3 px-4 text-left transition-[top,background-color] duration-500 ease-out',
              on ? 'bg-panel-2' : 'hover:bg-panel',
              r.out && 'opacity-40',
            )}
            style={{ top: i * ROW_H, height: ROW_H }}
          >
            <span className="tnum w-5 text-right text-[11px] text-dim">{r.out ? '—' : i + 1}</span>
            <span className="h-4 w-1" style={{ background: r.colour }} />
            <span className={clsx('w-10 text-sm font-semibold tracking-wide', on ? 'text-paper' : 'text-paper/90')}>{r.driver.acronym}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-dim">{r.driver.teamName}</span>
            {r.compound && <TyreBadge compound={r.compound} size={16} />}
            <span className={clsx('tnum w-14 text-right text-xs', i === 0 ? 'text-signal' : 'text-muted')}>{r.gap}</span>
          </button>
        )
      })}
    </div>
  )
}

function Scrubber({
  tStart,
  tEnd,
  pct,
  progressRef,
  leaderStarts,
  bands,
  onSeek,
}: {
  tStart: number
  tEnd: number
  pct: (T: number) => string
  progressRef: React.RefObject<HTMLDivElement | null>
  leaderStarts: number[]
  bands: { type: 'SC' | 'VSC' | 'RED'; s: number; e: number }[]
  onSeek: (T: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const toT = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return tStart + ((clientX - r.left) / r.width) * (tEnd - tStart)
  }
  return (
    <div className="mt-5 select-none">
      <div
        ref={ref}
        role="slider"
        aria-label="Position dans la course"
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={-1}
        className="group relative h-9 cursor-pointer touch-none"
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          onSeek(toT(e.clientX))
        }}
        onPointerMove={(e) => dragging.current && onSeek(toT(e.clientX))}
        onPointerUp={() => (dragging.current = false)}
      >
        <div className="absolute inset-x-0 top-3 h-3 bg-panel-2" />
        {bands.map((b, i) => (
          <div
            key={i}
            className="absolute top-3 h-3"
            title={b.type}
            style={{
              left: pct(b.s),
              width: `calc(${pct(b.e)} - ${pct(b.s)})`,
              background:
                b.type === 'RED'
                  ? 'var(--color-signal)'
                  : b.type === 'SC'
                    ? 'var(--color-yellow)'
                    : 'repeating-linear-gradient(45deg, var(--color-yellow) 0 4px, transparent 4px 8px)',
              opacity: 0.85,
            }}
          />
        ))}
        <div ref={progressRef} className="pointer-events-none absolute left-0 top-3 h-3 bg-paper/25" style={{ width: 0 }}>
          <div className="absolute -right-px -top-1.5 h-6 w-0.5 bg-signal shadow-[0_0_10px_var(--color-signal)]" />
        </div>
        {leaderStarts.map((s, i) => (
          <div
            key={i}
            className={clsx('pointer-events-none absolute top-[26px] w-px', (i + 1) % 10 === 0 || i === 0 ? 'h-2 bg-line-2' : 'h-1 bg-line')}
            style={{ left: pct(s) }}
          />
        ))}
      </div>
      <div className="relative h-4">
        {leaderStarts.map((s, i) =>
          (i + 1) % 10 === 0 || i === 0 ? (
            <span key={i} className="tnum absolute -translate-x-1/2 text-[9px] text-dim" style={{ left: pct(s) }}>
              T{i + 1}
            </span>
          ) : null,
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-4 text-[10px] text-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 bg-yellow" /> Safety car
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4" style={{ background: 'repeating-linear-gradient(45deg, var(--color-yellow) 0 3px, transparent 3px 6px)' }} /> VSC
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 bg-signal" /> Drapeau rouge
        </span>
      </div>
    </div>
  )
}
