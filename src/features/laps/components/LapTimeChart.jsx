import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatLapTime } from '../../../shared/utils/formatters'
import { THEME_COLORS, BRAND_COLORS } from '../../../constants/colors'
import { CHART_CONFIG } from '../../../constants/config'

export function LapTimeChart({ chartData, drivers, isLoading, selectedSession, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: `4px solid ${BRAND_COLORS.F1_RED}`,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          margin: '0 auto 20px',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: theme.TEXT_SECONDARY, fontSize: '18px' }}>Loading lap data...</p>
      </div>
    )
  }

  if (!selectedSession) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: theme.TEXT_SECONDARY }}>
        <h3 style={{ fontSize: '24px', marginBottom: '10px' }}>Select a session to view lap times</h3>
        <p>Choose a race weekend and session from the dropdowns above</p>
      </div>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: theme.TEXT_SECONDARY }}>
        <h3 style={{ fontSize: '24px', marginBottom: '10px' }}>No lap data available</h3>
        <p>This session might not have lap time data yet</p>
      </div>
    )
  }

  return (
    <>
      <h2 style={{ fontSize: '24px', marginBottom: '20px', color: theme.TEXT }}>
        Lap Times Chart
      </h2>
      <div style={{ width: '100%', height: '500px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid 
              strokeDasharray={CHART_CONFIG.GRID_STROKE_DASH} 
              stroke={theme.BORDER} 
            />
            <XAxis 
              dataKey="lap_number" 
              stroke={theme.TEXT_SECONDARY}
              label={{ 
                value: 'Lap Number', 
                position: 'insideBottom', 
                offset: -10, 
                style: { fontSize: 14, fill: theme.TEXT_SECONDARY } 
              }}
              tick={{ fontSize: 12, fill: theme.TEXT_SECONDARY }}
            />
            <YAxis 
              stroke={theme.TEXT_SECONDARY}
              tickFormatter={(value) => formatLapTime(value)}
              domain={['dataMin - 2', 'dataMax + 5']}
              label={{ 
                value: 'Lap Time', 
                angle: -90, 
                position: 'insideLeft', 
                style: { fontSize: 14, fill: theme.TEXT_SECONDARY } 
              }}
              tick={{ fontSize: 12, fill: theme.TEXT_SECONDARY }}
            />
            <Tooltip 
              formatter={(value) => formatLapTime(value)}
              labelFormatter={(label) => `Lap ${label}`}
              contentStyle={{ 
                backgroundColor: darkMode ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                border: `1px solid ${theme.BORDER}`,
                borderRadius: '4px',
                color: theme.TEXT
              }}
              itemStyle={{ color: theme.TEXT }}
              labelStyle={{ color: theme.TEXT_SECONDARY }}
              animationDuration={CHART_CONFIG.TOOLTIP_ANIMATION_DURATION}
            />
            <Legend />
            {drivers.map(driver => (
              <Line
                key={driver.driver_number}
                type="monotone"
                dataKey={`driver_${driver.driver_number}`}
                name={driver.name_acronym}
                stroke={driver.color}
                strokeWidth={CHART_CONFIG.LINE_STROKE_WIDTH}
                dot={false}
                connectNulls={true}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}