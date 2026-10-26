import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { useMemo, useState } from 'react'
import { AxisX, ChartFrame, GridY, Tooltip } from '@/charts/core'
import { t } from '@/i18n'

export interface Series {
  id: string
  label: string
  colour: string
  dashed: boolean
  values: number[]
}

/** Cumulative points per round, one line per driver / team. */
export function ProgressionChart({
  series,
  rounds,
  highlight,
  onHighlight,
}: {
  series: Series[]
  rounds: { round: number; name: string; sprint: boolean }[]
  highlight: string | null
  onHighlight: (id: string | null) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = useMemo(() => Math.max(10, ...series.flatMap((s) => s.values)), [series])
  const n = rounds.length

  return (
    <ChartFrame
      height={420}
      margin={{ top: 16, right: 64, bottom: 30, left: 44 }}
      ariaLabel={t('standings.chartAria')}
      onPointer={(p) => setHover(p ? p.x : null)}
      overlay={({ width }) => {
        if (hover === null || n === 0) return null
        const x = scaleLinear().domain([0, Math.max(1, n - 1)]).range([0, width])
        const i = Math.max(0, Math.min(n - 1, Math.round(x.invert(hover))))
        const rows = series
          .map((s) => ({ s, v: s.values[i] ?? 0 }))
          .sort((a, b) => b.v - a.v)
          .slice(0, 10)
        return (
          <Tooltip x={x(i)} width={width}>
            <div className="eyebrow mb-1.5">
              {t('season.round', { n: rounds[i].round })} {rounds[i].sprint && '· sprint'}
            </div>
            <div className="mb-2 text-paper">{rounds[i].name.replace('Grand Prix', 'GP')}</div>
            <ul className="space-y-0.5">
              {rows.map(({ s, v }, k) => (
                <li key={s.id} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2">
                    <span className="tnum w-4 text-[10px] text-dim">{k + 1}</span>
                    <span className="h-0.5 w-3" style={{ background: s.colour }} />
                    {s.label}
                  </span>
                  <span className="tnum text-paper">{v}</span>
                </li>
              ))}
            </ul>
          </Tooltip>
        )
      }}
    >
      {({ width, height }) => {
        const x = scaleLinear().domain([0, Math.max(1, n - 1)]).range([0, width])
        const y = scaleLinear().domain([0, max]).range([height, 0]).nice()
        const path = line<number>()
          .x((_, i) => x(i))
          .y((v) => y(v))
        const hi = hover === null ? null : Math.max(0, Math.min(n - 1, Math.round(x.invert(hover))))

        // end labels for the leading lines, nudged apart so they never overlap
        const ends = series
          .map((s) => ({ s, y: y(s.values.at(-1) ?? 0) }))
          .sort((a, b) => a.y - b.y)
          .slice(0, 8)
        for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12

        const ordered = [...series].sort((a, b) => (a.id === highlight ? 1 : b.id === highlight ? -1 : 0))
        return (
          <>
            <GridY scale={y} width={width} ticks={6} />
            <AxisX scale={x} height={height} ticks={Math.max(2, Math.min(n, Math.floor(width / 44)))} format={(v) => (Number.isInteger(v) && rounds[v] ? `R${rounds[v].round}` : '')} />
            {rounds.map((r, i) =>
              r.sprint ? <rect key={r.round} x={x(i) - 2} y={height} width={4} height={3} fill="var(--color-amber)" opacity={0.7} /> : null,
            )}
            {hi !== null && <line x1={x(hi)} x2={x(hi)} y2={height} stroke="var(--color-line-2)" />}
            {ordered.map((s) => {
              const dim = highlight !== null && highlight !== s.id
              return (
                <g key={s.id} onPointerEnter={() => onHighlight(s.id)} onPointerLeave={() => onHighlight(null)} style={{ transition: 'opacity .2s' }} opacity={dim ? 0.12 : 1}>
                  <path d={path(s.values) ?? ''} fill="none" stroke="transparent" strokeWidth={10} />
                  <path
                    d={path(s.values) ?? ''}
                    fill="none"
                    stroke={s.colour}
                    strokeWidth={highlight === s.id ? 3 : 1.75}
                    strokeDasharray={s.dashed ? '5 4' : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {hi !== null && <circle cx={x(hi)} cy={y(s.values[hi] ?? 0)} r={2.5} fill={s.colour} />}
                </g>
              )
            })}
            {ends.map(({ s, y: ly }) => (
              <g key={s.id} transform={`translate(${width + 8},${ly})`} opacity={highlight && highlight !== s.id ? 0.25 : 1}>
                <text dy="0.32em" className="font-mono text-[10px]" fill={s.colour}>
                  {s.label}
                </text>
              </g>
            ))}
          </>
        )
      }}
    </ChartFrame>
  )
}
