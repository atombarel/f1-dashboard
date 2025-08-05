import React, { useMemo } from 'react'
import { EventMultiSelectInline } from '../../../shared/components/EventMultiSelect'
import { THEME_COLORS } from '../../../constants/colors'
import { EVENT_TYPES } from '../../../constants/config'

export function RaceEventsTimeline({ sessions, selectedSession, raceControl, eventFilters, setEventFilters, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  // Check if current session is a race session (not sprint)
  const isRace = useMemo(() => {
    const currentSession = sessions?.find(s => 
      s.session_key === selectedSession || 
      s.session_key === String(selectedSession) ||
      String(s.session_key) === String(selectedSession)
    )
    const sessionName = currentSession?.session_name?.toLowerCase() || ''
    const isRaceSession = sessionName.includes('race') && !sessionName.includes('sprint')
    
    
    return isRaceSession
  }, [sessions, selectedSession])

  // Get event style based on category
  const getEventStyle = (category) => {
    const eventType = EVENT_TYPES.find(type => {
      if (type.value === 'Flag' && category?.includes('Flag')) return true
      if (type.value === 'SafetyCar' && (category?.includes('Safety') || category?.includes('SC'))) return true
      if (type.value === 'DRS' && category?.includes('DRS')) return true
      if (type.value === 'Penalty' && (category?.includes('Penalty') || category?.includes('Time'))) return true
      if (type.value === 'CarEvent' && category?.includes('Car')) return true
      return type.value === 'Other'
    })
    
    return eventType || EVENT_TYPES.find(t => t.value === 'Other')
  }

  // Get event type for filtering
  const getEventType = (category) => {
    if (category?.includes('Flag')) return 'Flag'
    if (category?.includes('Safety') || category?.includes('SC')) return 'SafetyCar'
    if (category?.includes('DRS')) return 'DRS'
    if (category?.includes('Penalty') || category?.includes('Time')) return 'Penalty'
    if (category?.includes('Car')) return 'CarEvent'
    return 'Other'
  }

  // Filter and group events
  const eventsByLap = useMemo(() => {
    if (!raceControl) return {}

    const filteredEvents = raceControl.filter(event => {
      const eventType = getEventType(event.category)
      return eventFilters[eventType]
    })

    const grouped = {}
    filteredEvents.forEach(event => {
      const lap = event.lap_number || 0
      if (!grouped[lap]) grouped[lap] = []
      grouped[lap].push(event)
    })

    return grouped
  }, [raceControl, eventFilters])

  if (!selectedSession || !isRace) {
    return null
  }

  if (!raceControl || raceControl.length === 0) {
    return (
      <div style={{
        backgroundColor: theme.BACKGROUND_SECONDARY,
        padding: '20px',
        borderRadius: '8px',
        height: 'fit-content',
        boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.3s'
      }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px', color: theme.TEXT }}>
          🏁 Race Events Timeline
        </h2>
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: theme.TEXT_SECONDARY,
          fontStyle: 'italic'
        }}>
          No race control data available for this session
        </div>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: theme.BACKGROUND_SECONDARY,
      padding: '20px',
      borderRadius: '8px',
      height: 'fit-content',
      boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.3s'
    }}>
      <h2 style={{ fontSize: '24px', marginBottom: '20px', color: theme.TEXT }}>
        🏁 Race Events Timeline
      </h2>
      
      {/* Filter Controls */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: theme.BACKGROUND_TERTIARY,
        borderRadius: '8px'
      }}>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 'bold', 
          marginBottom: '10px',
          color: theme.TEXT
        }}>
          Filter Events:
        </div>
        <EventMultiSelectInline 
          selectedEvents={eventFilters}
          onSelectionChange={setEventFilters}
          darkMode={darkMode}
        />
      </div>
      
      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        border: `1px solid ${theme.BORDER}`,
        borderRadius: '8px',
        padding: '15px'
      }}>
        {Object.keys(eventsByLap).length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: theme.TEXT_SECONDARY,
            fontStyle: 'italic'
          }}>
            No events match the selected filters. Try selecting more event types.
          </div>
        ) : (
          Object.entries(eventsByLap)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([lap, events]) => (
              <div key={lap} style={{ marginBottom: '20px' }}>
                <div style={{
                  fontWeight: 'bold',
                  color: theme.TEXT_SECONDARY,
                  marginBottom: '10px',
                  fontSize: '14px'
                }}>
                  {lap === '0' ? 'Pre-Race' : `Lap ${lap}`}
                </div>
                {events.map((event, idx) => {
                  const style = getEventStyle(event.category)
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: theme.BACKGROUND,
                        borderRadius: '6px',
                        marginBottom: idx < events.length - 1 ? '8px' : '0',
                        border: `1px solid ${style.color}40`
                      }}
                    >
                      <div style={{
                        fontSize: '20px',
                        minWidth: '24px',
                        textAlign: 'center'
                      }}>
                        {style.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: '600',
                          color: theme.TEXT,
                          fontSize: '14px',
                          marginBottom: '2px'
                        }}>
                          {event.message}
                        </div>
                        {event.driver_number && (
                          <div style={{
                            fontSize: '12px',
                            color: theme.TEXT_SECONDARY
                          }}>
                            Driver #{event.driver_number}
                          </div>
                        )}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: style.color,
                        fontWeight: '600',
                        textAlign: 'right',
                        minWidth: '80px'
                      }}>
                        {event.category}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
        )}
      </div>
    </div>
  )
}