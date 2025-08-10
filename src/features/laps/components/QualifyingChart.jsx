import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts'
import { formatLapTime, getTeamColor } from '../../../shared/utils/formatters'
import { THEME_COLORS } from '../../../constants/colors'

// A qualifying-focused chart: horizontal bars sorted by best quali time (Q3 > Q2 > Q1)
// Shows delta to pole and indicates which segment (Q1/Q2/Q3) the best came from
export function QualifyingChart({ sessionResults, drivers, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  const data = useMemo(() => {
    if (!sessionResults || !drivers) return []

    const items = sessionResults.map(r => {
      const driver = drivers.find(d => d.driver_number === r.driver_number)
      const label = driver?.name_acronym || `#${r.driver_number}` // 3-letter code for axis
      const name = driver?.full_name || driver?.broadcast_name || label
      const teamColor = getTeamColor(driver?.team_name)

      let q1 = null, q2 = null, q3 = null
      if (Array.isArray(r.duration)) {
        q1 = typeof r.duration[0] === 'number' ? r.duration[0] : null
        q2 = typeof r.duration[1] === 'number' ? r.duration[1] : null
        q3 = typeof r.duration[2] === 'number' ? r.duration[2] : null
      } else if (typeof r.duration === 'number') {
        // fallback if API provides a single time
        q1 = r.duration
      }

      const bestTime = q3 ?? q2 ?? q1
      const bestSegment = q3 ? 'Q3' : q2 ? 'Q2' : q1 ? 'Q1' : null

      return {
        driver_number: r.driver_number,
        name,
        label,
        teamColor,
        q1,
        q2,
        q3,
        bestTime,
        bestSegment
      }
    }).filter(x => typeof x.bestTime === 'number')

    if (items.length === 0) return []

    const pole = Math.min(...items.map(x => x.bestTime))
    return items
      .map(x => ({ ...x, delta: x.bestTime - pole }))
      .sort((a, b) => a.bestTime - b.bestTime)
  }, [sessionResults, drivers])

  // Segment color accents
  const SEGMENT_COLORS = {
    Q1: '#f59e0b', // amber
    Q2: '#3b82f6', // blue
    Q3: '#a855f7', // purple
  }

  // Per-segment bests for highlighting in tooltip
  const segmentBests = useMemo(() => {
    if (!sessionResults) return { q1: null, q2: null, q3: null }
    const q1Times = sessionResults.map(r => Array.isArray(r.duration) ? r.duration[0] : null).filter(v => typeof v === 'number')
    const q2Times = sessionResults.map(r => Array.isArray(r.duration) ? r.duration[1] : null).filter(v => typeof v === 'number')
    const q3Times = sessionResults.map(r => Array.isArray(r.duration) ? r.duration[2] : null).filter(v => typeof v === 'number')
    return {
      q1: q1Times.length ? Math.min(...q1Times) : null,
      q2: q2Times.length ? Math.min(...q2Times) : null,
      q3: q3Times.length ? Math.min(...q3Times) : null,
    }
  }, [sessionResults])

  // Create color lookup map for Y-axis labels
  const colorByLabel = useMemo(() => Object.fromEntries(data.map(d => [d.label, d.teamColor])), [data])

  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: theme.TEXT_SECONDARY }}>
        No qualifying times available
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null
    const d = payload[0].payload
    return (
      <div style={{
        background: darkMode ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: `1px solid ${theme.BORDER}`,
        padding: '12px 14px',
        borderRadius: 6,
        color: theme.TEXT,
        minWidth: 220
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 9999, background: d.teamColor }} />
          <div style={{ fontWeight: 800, letterSpacing: 0.3 }}>{d.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800 }}>{formatLapTime(d.bestTime)}</div>
          {d.bestSegment && (
            <div style={{ background: SEGMENT_COLORS[d.bestSegment], color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{d.bestSegment}</div>
          )}
        </div>
        <div style={{ color: theme.TEXT_SECONDARY, marginBottom: 8 }}>
          Δ Pole: {d.delta >= 0 ? `+${d.delta.toFixed(3)}s` : `${d.delta.toFixed(3)}s`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', rowGap: 6 }}>
          {['Q1','Q2','Q3'].map((seg, idx) => {
            const value = [d.q1, d.q2, d.q3][idx]
            if (!value) return null
            const bestVal = idx === 0 ? segmentBests.q1 : idx === 1 ? segmentBests.q2 : segmentBests.q3
            const isBest = typeof bestVal === 'number' && Math.abs(bestVal - value) < 1e-6
            return (
              <React.Fragment key={seg}>
                <div style={{ background: SEGMENT_COLORS[seg], color: '#fff', borderRadius: 8, padding: '2px 6px', textAlign: 'center', fontWeight: 700, fontSize: 12 }}>{seg}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: isBest ? 800 : 600, color: isBest ? '#a855f7' : theme.TEXT }}>{formatLapTime(value)}</div>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    )
  }

  const labelFormatter = (props) => {
    const { x, y, width, height, value, payload } = props
    if (!payload) return null
    const seg = payload.bestSegment
    const segColor = SEGMENT_COLORS[seg] || theme.TEXT_SECONDARY
    const timeText = formatLapTime(value)
    const deltaText = payload.delta > 0 ? ` (+${payload.delta.toFixed(3)}s)` : ''
    const centerY = y + (height ? height / 2 : 9) // fallback assumes barSize ~18
    const baseX = x + width + 10
    const pillWidth = 22
    const pillHeight = 16
    const gap = 8
    return (
      <g className="custom-bar-label">
        {seg && (
          <>
            <rect x={baseX} y={centerY - pillHeight / 2} width={pillWidth} height={pillHeight} rx={4} ry={4} fill={segColor} />
            <text x={baseX + pillWidth / 2} y={centerY} fill="#fff" fontSize={11} fontWeight={900} textAnchor="middle" dominantBaseline="middle">{seg}</text>
          </>
        )}
        <text
          x={baseX + (seg ? pillWidth + gap : 0)}
          y={centerY}
          fill={theme.TEXT}
          fontSize={12}
          fontFamily="monospace"
          fontWeight={800}
          dominantBaseline="middle"
        >
          {timeText}{deltaText}
        </text>
      </g>
    )
  }

  const CustomYAxisTick = (props) => {
    const { x, y, payload } = props
    const color = colorByLabel[payload.value] || theme.TEXT
    return (
      <g transform={`translate(${x},${y})`}>
        {/* Center the colored square and text better with the bars */}
        <rect x={-42} y={-5} width={10} height={10} rx={2} ry={2} fill={color} stroke={theme.BACKGROUND} strokeWidth={1} />
        <text x={-28} y={0} textAnchor="start" fill={theme.TEXT} fontSize={12} fontWeight={800} dominantBaseline="middle">
          {payload.value}
        </text>
      </g>
    )
  }

  return (
    <>
      <h2 style={{ fontSize: '24px', marginBottom: '12px', color: theme.TEXT }}>Qualifying – Best Times</h2>
      <div style={{ width: '100%', height: Math.max(340, data.length * 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 120, left: 60, bottom: 10 }}
            barCategoryGap={12}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.BORDER} />
            <XAxis type="number" stroke={theme.TEXT_SECONDARY} tickFormatter={formatLapTime} domain={[data[0].bestTime - 0.3, data[data.length - 1].bestTime + 0.7]} />
            <YAxis 
              type="category" 
              dataKey="label" 
              stroke={theme.TEXT_SECONDARY} 
              width={50} 
              tick={<CustomYAxisTick />} 
              interval={0}
              tickLine={false}
              axisLine={false}
              tickMargin={0}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="bestTime" isAnimationActive={false} radius={[0, 8, 8, 0]} barSize={18} strokeWidth={1.5}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.teamColor} stroke={entry.teamColor} />
              ))}
              <LabelList dataKey="bestTime" position="right" content={labelFormatter} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

