import React from 'react'
import { formatLapTime } from '../../../shared/utils/formatters'
import { THEME_COLORS, BRAND_COLORS } from '../../../constants/colors'

export function SessionStats({ chartData, drivers, allLaps, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  if (!chartData || chartData.length === 0 || !allLaps || allLaps.length === 0) {
    return null
  }

  const fastestLap = Math.min(...allLaps.map(l => l.lap_time_seconds))

  return (
    <div style={{ 
      marginTop: '20px', 
      padding: '15px', 
      backgroundColor: theme.BACKGROUND_TERTIARY,
      borderRadius: '4px',
      display: 'flex',
      justifyContent: 'space-around',
      flexWrap: 'wrap'
    }}>
      <div style={{ textAlign: 'center', margin: '10px' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: BRAND_COLORS.F1_RED }}>
          {chartData.length}
        </div>
        <div style={{ color: theme.TEXT_SECONDARY, fontSize: '14px' }}>Total Laps</div>
      </div>
      <div style={{ textAlign: 'center', margin: '10px' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: BRAND_COLORS.F1_RED }}>
          {drivers.length}
        </div>
        <div style={{ color: theme.TEXT_SECONDARY, fontSize: '14px' }}>Drivers</div>
      </div>
      <div style={{ textAlign: 'center', margin: '10px' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: BRAND_COLORS.F1_RED }}>
          {formatLapTime(fastestLap)}
        </div>
        <div style={{ color: theme.TEXT_SECONDARY, fontSize: '14px' }}>Fastest Lap</div>
      </div>
    </div>
  )
}