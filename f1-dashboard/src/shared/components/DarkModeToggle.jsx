import React from 'react'
import { THEME_COLORS } from '../../constants/colors'

export function ThemeToggle({ darkMode, themeSource, onThemeChange }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  const getNextTheme = () => {
    switch (themeSource) {
      case 'system': return 'light'
      case 'light': return 'dark'
      case 'dark': return 'system'
      default: return 'system'
    }
  }

  const getThemeIcon = () => {
    switch (themeSource) {
      case 'system': return '🖥️'
      case 'light': return '☀️'
      case 'dark': return '🌙'
      default: return '🖥️'
    }
  }

  const getThemeLabel = () => {
    switch (themeSource) {
      case 'system': return 'System'
      case 'light': return 'Light'
      case 'dark': return 'Dark'
      default: return 'System'
    }
  }

  return (
    <button
      onClick={() => onThemeChange(getNextTheme())}
      style={{
        padding: '10px 20px',
        borderRadius: '20px',
        border: 'none',
        backgroundColor: theme.BACKGROUND_SECONDARY,
        color: theme.TEXT,
        cursor: 'pointer',
        fontWeight: '600',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s'
      }}
    >
      {getThemeIcon()} {getThemeLabel()}
    </button>
  )
}