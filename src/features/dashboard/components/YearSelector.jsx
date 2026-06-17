import React from 'react'
import { THEME_COLORS } from '../../../constants/colors'

export function YearSelector({ selectedYear, onYearChange, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2023 + 1 }, (_, index) => currentYear - index)

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
        {years.map(year => (
          <option key={year} value={String(year)}>
            {year}
          </option>
        ))}
      </select>
    </div>
  )
}
