import React from 'react'
import { THEME_COLORS } from '../../../constants/colors'

export function MeetingSelector({ meetings, selectedMeeting, onMeetingChange, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  // Filter out testing sessions
  const raceWeekends = meetings?.filter(meeting => 
    !meeting.meeting_name.toLowerCase().includes('test')
  ) || []

  return (
    <div>
      <label style={{ 
        display: 'block', 
        marginBottom: '5px', 
        fontWeight: '600', 
        color: theme.TEXT_SECONDARY 
      }}>
        Race Weekend:
      </label>
      <select 
        value={selectedMeeting} 
        onChange={(e) => onMeetingChange(e.target.value)}
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
        <option value="">Select a race weekend...</option>
        {raceWeekends.map(meeting => (
          <option key={meeting.meeting_key} value={meeting.meeting_key}>
            {meeting.meeting_name}
          </option>
        ))}
      </select>
    </div>
  )
}