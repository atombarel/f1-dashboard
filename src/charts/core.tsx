import type { ScaleLinear } from 'd3-scale'
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

/** Width of an element, tracked with a ResizeObserver. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

export interface Margin {
  top: number
  right: number
  bottom: number
  left: number
}

export const DEFAULT_MARGIN: Margin = { top: 12, right: 16, bottom: 28, left: 52 }

/**
 * Responsive SVG frame. Children get the inner size; everything is drawn in a translated <g>.
 * Pointer events are reported in inner coordinates for crosshairs.
 */
export function ChartFrame({
  height,
  margin = DEFAULT_MARGIN,
  children,
  onPointer,
  overlay,
  className,
  ariaLabel,
}: {
  height: number
  margin?: Margin
  children: (size: { width: number; height: number }) => ReactNode
  onPointer?: (p: { x: number; y: number } | null) => void
  overlay?: (size: { width: number; height: number }) => ReactNode
  className?: string
  ariaLabel?: string
}) {
  const [ref, outer] = useWidth<HTMLDivElement>()
  const width = Math.max(0, outer - margin.left - margin.right)
  const inner = height - margin.top - margin.bottom
  return (
    <div ref={ref} className={className} style={{ position: 'relative', height }}>
      {outer > 0 && (
        <>
          <svg
            width={outer}
            height={height}
            role="img"
            aria-label={ariaLabel}
            className="block select-none overflow-visible"
            onPointerMove={(e) => {
              if (!onPointer) return
              const r = e.currentTarget.getBoundingClientRect()
              const x = e.clientX - r.left - margin.left
              const y = e.clientY - r.top - margin.top
              onPointer(x >= 0 && x <= width && y >= -margin.top && y <= inner + margin.bottom ? { x, y } : null)
            }}
            onPointerLeave={() => onPointer?.(null)}
          >
            <g transform={`translate(${margin.left},${margin.top})`}>{children({ width, height: inner })}</g>
          </svg>
          {overlay && (
            <div className="pointer-events-none absolute" style={{ left: margin.left, top: margin.top, width, height: inner }}>
              {overlay({ width, height: inner })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function GridY({ scale, width, ticks = 5, format = String }: { scale: ScaleLinear<number, number>; width: number; ticks?: number; format?: (v: number) => string }) {
  return (
    <g>
      {scale.ticks(ticks).map((t) => (
        <g key={t} transform={`translate(0,${scale(t)})`}>
          <line x2={width} stroke="var(--color-line)" strokeDasharray="2 4" />
          <text x={-10} dy="0.32em" textAnchor="end" className="fill-dim font-mono text-[10px]">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

export function AxisX({ scale, height, ticks = 8, format = String, label }: { scale: ScaleLinear<number, number>; height: number; ticks?: number; format?: (v: number) => string; label?: string }) {
  const [x0, x1] = scale.range()
  return (
    <g transform={`translate(0,${height})`}>
      <line x1={x0} x2={x1} stroke="var(--color-line-2)" />
      {scale.ticks(ticks).map((t) => (
        <g key={t} transform={`translate(${scale(t)},0)`}>
          <line y2={4} stroke="var(--color-line-2)" />
          <text y={16} textAnchor="middle" className="fill-dim font-mono text-[10px]">
            {format(t)}
          </text>
        </g>
      ))}
      {label && (
        <text x={x1} y={-6} textAnchor="end" className="fill-dim font-mono text-[9px] uppercase tracking-widest">
          {label}
        </text>
      )}
    </g>
  )
}

/** Floating tooltip positioned inside a ChartFrame overlay; flips side near the right edge. */
export function Tooltip({ x, width, children, top = 0 }: { x: number; width: number; children: ReactNode; top?: number }) {
  const right = x > width * 0.6
  return (
    <div
      className="absolute z-10 min-w-40 border border-line-2 bg-ink/95 px-3 py-2 text-xs shadow-2xl backdrop-blur"
      style={{ top, ...(right ? { right: width - x + 12 } : { left: x + 12 }) }}
    >
      {children}
    </div>
  )
}

/** Index of the value in a sorted array closest to `v`. */
export function nearestIndex(sorted: number[], v: number): number {
  let lo = 0
  let hi = sorted.length - 1
  if (hi < 0) return -1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < v) lo = mid
    else hi = mid
  }
  return Math.abs(sorted[lo] - v) <= Math.abs(sorted[hi] - v) ? lo : hi
}
