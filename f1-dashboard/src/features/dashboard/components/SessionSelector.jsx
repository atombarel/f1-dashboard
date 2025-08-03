import React from 'react'
import { THEME_COLORS } from '../../../constants/colors'

export function SessionSelector({ sessions, selectedSession, onSessionChange, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  return (
    <div>
      <label style={{ 
        display: 'block', 
        marginBottom: '5px', 
        fontWeight: '600', 
        color: theme.TEXT_SECONDARY 
      }}>
        Session:
      </label>
      <select 
        value={selectedSession} 
        onChange={(e) => onSessionChange(e.target.value)}
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
        <option value="">Select a session...</option>
        {sessions?.map(session => (
          <option key={session.session_key} value={session.session_key}>
            {session.session_name}
          </option>
        ))}
      </select>
    </div>
  )
}