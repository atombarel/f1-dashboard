import type { CSSProperties, ReactNode } from 'react'
import { useWidth } from '@/charts/core'
import { t } from '@/i18n'
import { lapTime } from '@/lib/format'
import { CAR_LENGTH, CAR_WIDTH, CarGlyph } from './CarGlyph'
import type { Centerline, Point } from './centerline'
import { lanesAt, type CarFrame } from './stage'

/** half the track width, metres */
const HALF_WIDTH = 7
/** most lanes drawn side by side; more cars than that share lanes */
const MAX_LANES = 10
const CHIP_W = 106
const CHIP_H = 42
/** compact name tag, used when a full chip does not fit */
const TAG_W = 46
const TAG_H = 18
/** room kept for the title and clock overlays */
const HUD_H = 62

const fmtGap = (g: number) => `${g >= 0 ? '+' : '−'}${Math.abs(g).toFixed(3)}`

/**
 * Top-down camera riding along the track: the leading car on the road sits near the front of the frame
 * (and the frame stops on the finish line), every other car is drawn at its real distance behind.
 * Horizontal on wide screens, vertical on phones.
 */
export function FinishCam({
  line,
  frames,
  t: now,
  anchor,
  span,
  ariaLabel,
  children,
}: {
  line: Centerline
  frames: CarFrame[]
  /** clock, seconds since the lap start */
  t: number
  /** lap distance the camera is locked on */
  anchor: number
  /** metres of track the frame must show behind the anchor */
  span: number
  ariaLabel: string
  children?: ReactNode
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const vertical = width > 0 && width < 560
  const height = vertical ? Math.round(Math.min(640, width * 1.45)) : Math.round(Math.max(360, Math.min(560, width * 0.56)))

  return (
    <div ref={ref} className="relative w-full overflow-hidden bg-carbon" style={{ height }}>
      {width > 0 && <Scene line={line} frames={frames} t={now} anchor={anchor} span={span} width={width} height={height} vertical={vertical} ariaLabel={ariaLabel} />}
      {children}
    </div>
  )
}

function Scene({
  line,
  frames,
  t: now,
  anchor,
  span,
  width,
  height,
  vertical,
  ariaLabel,
}: {
  line: Centerline
  frames: CarFrame[]
  t: number
  anchor: number
  span: number
  width: number
  height: number
  vertical: boolean
  ariaLabel: string
}) {
  // vertical frames travel upwards, towards the title: keep that band free
  const along = vertical ? height - HUD_H : width
  const originY = vertical ? (height + HUD_H) / 2 : height / 2
  const across = vertical ? width : height
  // px per metre along the track: the span fits the frame, distances along the track are to scale
  const k = Math.min((along * 0.86) / span, (across * 0.42) / (HALF_WIDTH * 2))
  // across the track the layout is schematic (the data has no lateral position): the track keeps the same width
  // on screen whatever the zoom (leaving room for the labels on both sides), split into one lane per car
  const ex = (across * 0.4) / (HALF_WIDTH * 2 * k)
  const slots = Math.max(1, Math.min(MAX_LANES, frames.length))
  const laneWidth = (HALF_WIDTH * 2 * 0.88) / slots
  // cars as long as possible, but never wider than 80 % of their lane
  const carK = Math.min(k * Math.min(ex, 1.8), (laneWidth * ex * k * 0.8) / CAR_WIDTH)
  const visible = along / k
  // camera on the chord from the back of the frame to the anchor, so the anchor stays near the front edge
  // even in the middle of a corner sequence (a hairpin falls back to the local heading)
  const dc = anchor - visible * 0.38
  const back = line.at(anchor - visible * 0.76)
  const front = line.at(anchor)
  const chord = Math.hypot(front.x - back.x, front.y - back.y)
  const C = chord > visible * 0.3 ? { x: (back.x + front.x) / 2, y: (back.y + front.y) / 2 } : line.at(dc)
  const theta = chord > visible * 0.3 ? Math.atan2(front.y - back.y, front.x - back.x) : line.heading(dc, Math.max(10, visible * 0.3))
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const toScreen = (p: Point): [number, number] => {
    const rx = p.x - C.x
    const ry = p.y - C.y
    const u = rx * cos + ry * sin
    const w = -rx * sin + ry * cos
    return vertical ? [width / 2 - w * k, originY - u * k] : [width / 2 + u * k, originY - w * k]
  }
  /** screen angle (degrees, SVG convention) of a world heading */
  const angleOf = (phi: number) => {
    const a = phi - theta
    const [vx, vy] = vertical ? [-Math.sin(a), -Math.cos(a)] : [Math.cos(a), -Math.sin(a)]
    return (Math.atan2(vy, vx) * 180) / Math.PI
  }
  /** point `offset` metres to the left of the track at `d` (lateral exaggeration applied) */
  const side = (d: number, offset: number): Point => {
    const p = line.at(d)
    const phi = line.heading(d, 5)
    return { x: p.x - Math.sin(phi) * offset * ex, y: p.y + Math.cos(phi) * offset * ex }
  }
  const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')

  // track ribbon over the visible window (with margin for the camera rotation)
  const from = dc - visible * 0.75
  const to = dc + visible * 0.75
  const step = Math.max(0.5, visible / 160)
  const left: [number, number][] = []
  const right: [number, number][] = []
  const kerbL: [number, number][] = []
  const kerbR: [number, number][] = []
  const runL: [number, number][] = []
  const runR: [number, number][] = []
  for (let d = from; d <= to; d += step) {
    left.push(toScreen(side(d, HALF_WIDTH)))
    right.push(toScreen(side(d, -HALF_WIDTH)))
    kerbL.push(toScreen(side(d, HALF_WIDTH + 0.45)))
    kerbR.push(toScreen(side(d, -HALF_WIDTH - 0.45)))
    runL.push(toScreen(side(d, HALF_WIDTH + 9)))
    runR.push(toScreen(side(d, -HALF_WIDTH - 9)))
  }
  const ribbon = path([...left, ...[...right].reverse()]) + 'Z'
  const runoff = path([...runL, ...[...runR].reverse()]) + 'Z'

  // distance marks behind the anchor
  const every = k * 10 >= 34 ? 10 : 50
  const marks: { d: number; m: number; major: boolean }[] = []
  for (let m = every; anchor - m > from; m += every) marks.push({ d: anchor - m, m, major: m % 50 === 0 })

  // finish lines inside the window
  const L = line.length
  const finishes: number[] = []
  for (let n = Math.floor(from / L); n <= Math.ceil(to / L); n++) if (n * L >= from && n * L <= to) finishes.push(n * L)

  // cars
  const pad = 30
  // cars are drawn longer than life when zoomed out: that is the room they need to share a lane
  const lanes = lanesAt(
    frames.map((f) => f.car),
    now,
    CAR_LENGTH * (carK / k) + 1.5,
    slots,
  )
  const cars = frames.map((f, i) => {
    const angle = angleOf(line.heading(f.d, 4))
    // (nx, ny) is the nose, on the car's distance; (sx, sy) the middle of the car, for labels
    const [nx, ny] = toScreen(side(f.d, lanes[i] * laneWidth))
    const back = (CAR_LENGTH / 2) * carK
    const sx = nx - Math.cos((angle * Math.PI) / 180) * back
    const sy = ny - Math.sin((angle * Math.PI) / 180) * back
    const inside = sx > -pad && sx < width + pad && sy > -pad && sy < height + pad
    return { f, nx, ny, sx, sy, lane: lanes[i], angle, inside }
  })
  const shown = cars.filter((c) => c.inside)
  const outside = cars.filter((c) => !c.inside && c.f.d < anchor).sort((a, b) => a.f.order - b.f.order)

  // Labels never cover a car: a full chip where there is room, else a compact name tag, else nothing (the
  // tower lists everyone). Fastest cars pick first, on the side of the track their lane is on.
  const placed: { x: number; y: number; w: number; h: number }[] = []
  const carRadius = (CAR_LENGTH / 2) * carK + 3
  const hitsChip = (x: number, y: number, w: number, h: number) =>
    placed.some((p) => x < p.x + p.w + 4 && p.x < x + w + 4 && y < p.y + p.h + 4 && p.y < y + h + 4)
  const hitsCar = (x: number, y: number, w: number, h: number) =>
    shown.some((c) => (Math.max(x, Math.min(x + w, c.sx)) - c.sx) ** 2 + (Math.max(y, Math.min(y + h, c.sy)) - c.sy) ** 2 < carRadius ** 2)
  const spots = (c: (typeof shown)[number], w: number, h: number) => {
    const pref = c.lane < 0 ? 1 : -1
    const out = (vertical ? w : h) + 6
    const base = carRadius + out / 2
    const list: { x: number; y: number }[] = []
    for (let row = 0; row < 4; row++)
      for (const sign of [pref, -pref])
        for (const slide of [0, 0.6, -0.6]) {
          const off = sign * (base + row * out)
          const cx = vertical ? c.sx + off : c.sx + slide * w
          const cy = vertical ? c.sy + slide * h : c.sy + off
          list.push({ x: Math.max(4, Math.min(width - w - 4, cx - w / 2)), y: Math.max(HUD_H, Math.min(height - h - 4, cy - h / 2)) })
        }
    return list
  }
  const chips = [...shown]
    .sort((a, b) => a.f.car.rank - b.f.car.rank)
    .flatMap((c) => {
      for (const [w, h, compact] of [
        [CHIP_W, CHIP_H, false],
        [TAG_W, TAG_H, true],
      ] as const) {
        const pos = spots(c, w, h).find((p) => !hitsChip(p.x, p.y, w, h) && !hitsCar(p.x, p.y, w, h))
        if (pos) {
          placed.push({ ...pos, w, h })
          return [{ c, ...pos, w, h, compact }]
        }
      }
      return []
    })

  const kerbDash = `${(2.4 * k).toFixed(1)} ${(2.4 * k).toFixed(1)}`

  return (
    <>
      <svg width={width} height={height} className="absolute inset-0 block" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id="fc-tarmac" x1="0" x2={vertical ? 1 : 0} y1="0" y2={vertical ? 0 : 1}>
            <stop offset="0" stopColor="#1d2128" />
            <stop offset="0.5" stopColor="#22262e" />
            <stop offset="1" stopColor="#1d2128" />
          </linearGradient>
          <pattern id="fc-check" width="1.2" height="1.2" patternUnits="userSpaceOnUse">
            <rect width="1.2" height="1.2" fill="#eceef2" />
            <rect width="0.6" height="0.6" fill="#08090b" />
            <rect x="0.6" y="0.6" width="0.6" height="0.6" fill="#08090b" />
          </pattern>
        </defs>
        <path d={runoff} fill="#111a16" />
        <path d={ribbon} fill="url(#fc-tarmac)" />
        <path d={path(kerbL)} fill="none" stroke="#e8ebef" strokeWidth={0.9 * k * ex} opacity={0.75} />
        <path d={path(kerbL)} fill="none" stroke="#d9342b" strokeWidth={0.9 * k * ex} strokeDasharray={kerbDash} opacity={0.9} />
        <path d={path(kerbR)} fill="none" stroke="#e8ebef" strokeWidth={0.9 * k * ex} opacity={0.75} />
        <path d={path(kerbR)} fill="none" stroke="#d9342b" strokeWidth={0.9 * k * ex} strokeDasharray={kerbDash} opacity={0.9} />
        <path d={path(left)} fill="none" stroke="#eceef2" strokeOpacity={0.55} strokeWidth={Math.max(1, 0.15 * k * ex)} />
        <path d={path(right)} fill="none" stroke="#eceef2" strokeOpacity={0.55} strokeWidth={Math.max(1, 0.15 * k * ex)} />

        {marks.map((m) => {
          const [ax, ay] = toScreen(side(m.d, -HALF_WIDTH))
          const [bx, by] = toScreen(side(m.d, -HALF_WIDTH + (m.major ? 2.2 : 1.2)))
          const [cx2, cy2] = toScreen(side(m.d, HALF_WIDTH))
          const [dx2, dy2] = toScreen(side(m.d, HALF_WIDTH - (m.major ? 2.2 : 1.2)))
          const [lx, ly] = toScreen(side(m.d, -HALF_WIDTH - 4.2))
          return (
            <g key={m.m}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#eceef2" strokeOpacity={m.major ? 0.5 : 0.25} />
              <line x1={cx2} y1={cy2} x2={dx2} y2={dy2} stroke="#eceef2" strokeOpacity={m.major ? 0.5 : 0.25} />
              {(m.major || every === 10) && (
                <text x={lx} y={ly} dy="0.35em" textAnchor="middle" className="fill-dim font-mono text-[9px]">
                  {m.m} m
                </text>
              )}
            </g>
          )
        })}

        {finishes.map((d) => {
          const [sx, sy] = toScreen(line.at(d))
          return (
            <g key={d} transform={`translate(${sx},${sy}) rotate(${angleOf(line.heading(d, 6))}) scale(${k},${k * ex})`}>
              <rect x={-0.6} y={-HALF_WIDTH} width={1.2} height={HALF_WIDTH * 2} fill="url(#fc-check)" />
            </g>
          )
        })}

        {chips.map(({ c, x, y, w, h }) => (
          <line
            key={c.f.car.driver.number}
            x1={c.sx}
            y1={c.sy}
            x2={Math.max(x, Math.min(x + w, c.sx))}
            y2={Math.max(y, Math.min(y + h, c.sy))}
            stroke={c.f.car.colour}
            strokeOpacity={0.6}
          />
        ))}
        {[...shown]
          .sort((a, b) => b.f.car.rank - a.f.car.rank)
          .map((c) => (
            <g key={c.f.car.driver.number} transform={`translate(${c.nx},${c.ny}) rotate(${c.angle}) scale(${carK})`}>
              <CarGlyph colour={c.f.car.colour} highlight={c.f.car === frames[0]?.car} />
            </g>
          ))}
      </svg>

      {chips.map(({ c, x, y, w, h, compact }) => (
        <Label key={c.f.car.driver.number} frame={c.f} compact={compact} style={{ left: x, top: y, width: w, height: h }} />
      ))}

      {outside.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 right-3 flex max-w-[60%] flex-wrap justify-end gap-1">
          <span className="eyebrow mr-1 self-center">{t('quali.offFrame')}</span>
          {outside.map((c) => (
            <span key={c.f.car.driver.number} className="tnum flex items-center gap-1.5 border border-line bg-ink/85 px-1.5 py-0.5 text-[10px]">
              <span className="h-2.5 w-1" style={{ background: c.f.car.colour }} />
              <span className="text-paper">{c.f.car.driver.acronym}</span>
              <span className="text-muted">{c.f.behind.toFixed(0)} m</span>
            </span>
          ))}
        </div>
      )}
    </>
  )
}

/** Chip next to a car: name, rank, official gap and metres behind; or just the name when space is short. */
function Label({ frame: f, compact, style }: { frame: CarFrame; compact: boolean; style: CSSProperties }) {
  if (compact)
    return (
      <div className="pointer-events-none absolute flex items-center gap-1 border border-line-2 bg-ink/90 pr-1 text-[10px] font-semibold leading-none text-paper" style={style}>
        <span className="h-full w-1 shrink-0" style={{ background: f.car.colour }} />
        {f.car.driver.acronym}
      </div>
    )
  return (
    <div className="pointer-events-none absolute flex border border-line-2 bg-ink/90 shadow-lg" style={style}>
      <span className="w-1 shrink-0" style={{ background: f.car.colour }} />
      <div className="min-w-0 flex-1 px-1.5 py-1 leading-none">
        <div className="flex items-baseline justify-between gap-1">
          <span className="display text-[17px] text-paper">{f.car.driver.acronym}</span>
          <span className="tnum text-[9px] text-dim">P{f.car.rank + 1}</span>
        </div>
        <div className="tnum mt-1 flex items-baseline justify-between gap-1 text-[11px]">
          <span className={f.gap === 0 ? 'text-purple' : 'text-paper'}>{f.gap === 0 ? lapTime(f.car.time) : fmtGap(f.gap)}</span>
          {f.behind > 0.05 && <span className="whitespace-nowrap text-[9px] text-muted">{f.behind.toFixed(1)} m</span>}
        </div>
      </div>
    </div>
  )
}
