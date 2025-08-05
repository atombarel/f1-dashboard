import React from 'react'
import { THEME_COLORS } from '../../../constants/colors'

export function YearSelector({ selectedYear, onYearChange, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  return (
    <div>
      <label style={{ 
        display: 'block', 
        marginBottom: '5px', 
        fontWeight: '600', 
        color: theme.TEXT_SECONDARY 
      }}>
        Year:
      </label>
      <select 
        value={selectedYear} 
        onChange={(e) => onYearChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px',
          border: `2px solid ${theme.BORDER}`,
          borderRadius: '4px',
          fontSize: '14px',
          backgroundColor: theme.BACKGROUND_TERTIARY,
          color: theme.TEXT
        }}
      >
        <option value="2025">2025</option>
        <option value="2024">2024</option>
        <option value="2023">2023</option>
      </select>
    </div>
  )
}