import React, { useMemo } from 'react'
import { getTeamColor } from '../../../shared/utils/formatters'
import { THEME_COLORS } from '../../../constants/colors'

export function PitStopAnalysis({ sessions, selectedSession, pitStops, drivers, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  // Check if current session is a race session
  const isRace = useMemo(() => {
    const currentSession = sessions?.find(s => 
      s.session_key === selectedSession || 
      s.session_key === String(selectedSession) ||
      String(s.session_key) === String(selectedSession)
    )
    const sessionName = currentSession?.session_name?.toLowerCase() || ''
    const isRaceSession = sessionName.includes('race')
    
    
    return isRaceSession
  }, [sessions, selectedSession])

  // Calculate pit stop statistics
  const pitStopStats = useMemo(() => {
    if (!pitStops || pitStops.length === 0) return null

    const pitStopsByDriver = {}
    pitStops.forEach(stop => {
      if (!pitStopsByDriver[stop.driver_number]) {
        pitStopsByDriver[stop.driver_number] = []
      }
      pitStopsByDriver[stop.driver_number].push(stop)
    })

    const fastestStop = pitStops.reduce((min, stop) => 
      stop.pit_duration < min.pit_duration ? stop : min
    )

    return { pitStopsByDriver, fastestStop }
  }, [pitStops])

  if (!selectedSession || !isRace) {
    return null
  }

  if (!pitStops || pitStops.length === 0) {
    return (
      <div style={{
        backgroundColor: theme.BACKGROUND_SECONDARY,
        padding: '20px',
        borderRadius: '8px',
        boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.3s',
        height: 'fit-content'
      }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px', color: theme.TEXT }}>
          🔧 Pit Stop Analysis
        </h2>
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: theme.TEXT_SECONDARY,
          fontStyle: 'italic'
        }}>
          No pit stop data available for this session
        </div>
      </div>
    )
  }

  const { pitStopsByDriver, fastestStop } = pitStopStats

  return (
    <div style={{
      backgroundColor: theme.BACKGROUND_SECONDARY,
      padding: '20px',
      borderRadius: '8px',
      boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.3s',
      height: 'fit-content'
    }}>
      <h2 style={{ fontSize: '24px', marginBottom: '20px', color: theme.TEXT }}>
        🔧 Pit Stop Analysis
      </h2>
      
      {/* Fastest Stop */}
      <div style={{
        padding: '15px',
        backgroundColor: theme.BACKGROUND_TERTIARY,
        borderRadius: '8px',
        marginBottom: '20px',
        border: '2px solid #3b82f6'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '5px' }}>
          ⚡ Fastest Pit Stop
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            padding: '5px 10px',
            backgroundColor: getTeamColor(drivers?.find(d => d.driver_number === fastestStop.driver_number)?.team_name),
            color: 'white',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            {drivers?.find(d => d.driver_number === fastestStop.driver_number)?.name_acronym || `#${fastestStop.driver_number}`}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme.TEXT }}>
            {fastestStop.pit_duration.toFixed(3)}s
          </div>
          <div style={{ color: theme.TEXT_SECONDARY }}>
            Lap {fastestStop.lap_number}
          </div>
        </div>
      </div>
      
      {/* Pit Stop Summary Table */}
      <div style={{
        backgroundColor: theme.BACKGROUND_TERTIARY,
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '15px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '120px 60px 80px 1fr',
          gap: '10px',
          padding: '12px 15px',
          backgroundColor: theme.BACKGROUND_SECONDARY,
          fontSize: '12px',
          fontWeight: 'bold',
          color: theme.TEXT_SECONDARY,
          borderBottom: `1px solid ${theme.BORDER}`
        }}>
          <div>Driver</div>
          <div>Stops</div>
          <div>Avg Time</div>
          <div>Individual Stops</div>
        </div>
        
        {Object.entries(pitStopsByDriver)
          .sort(([,stopsA], [,stopsB]) => {
            const avgA = stopsA.reduce((sum, stop) => sum + stop.pit_duration, 0) / stopsA.length
            const avgB = stopsB.reduce((sum, stop) => sum + stop.pit_duration, 0) / stopsB.length
            return avgA - avgB
          })
          .map(([driverNumber, stops]) => {
            const driver = drivers?.find(d => d.driver_number === parseInt(driverNumber))
            const avgTime = stops.reduce((sum, stop) => sum + stop.pit_duration, 0) / stops.length

            return (
              <div
                key={driverNumber}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 60px 80px 1fr',
                  gap: '10px',
                  padding: '10px 15px',
                  borderBottom: `1px solid ${theme.BORDER}`,
                  alignItems: 'center',
                  fontSize: '13px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: getTeamColor(driver?.team_name)
                  }} />
                  <span style={{ fontWeight: '600', color: theme.TEXT }}>
                    {driver?.name_acronym || `#${driverNumber}`}
                  </span>
                </div>
                
                <div style={{ fontWeight: '600', color: theme.TEXT }}>
                  {stops.length}
                </div>
                
                <div style={{ 
                  fontWeight: '600', 
                  color: avgTime === Math.min(...Object.values(pitStopsByDriver).map(s => 
                    s.reduce((sum, stop) => sum + stop.pit_duration, 0) / s.length
                  )) ? '#10b981' : theme.TEXT,
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}>
                  {avgTime.toFixed(3)}s
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  gap: '6px', 
                  flexWrap: 'wrap',
                  fontSize: '11px'
                }}>
                  {stops.map((stop, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '2px 5px',
                        backgroundColor: stop.pit_duration === fastestStop.pit_duration 
                          ? '#3b82f6' 
                          : theme.BACKGROUND_SECONDARY,
                        color: stop.pit_duration === fastestStop.pit_duration 
                          ? 'white' 
                          : theme.TEXT_SECONDARY,
                        borderRadius: '3px',
                        fontFamily: 'monospace',
                        fontWeight: '500'
                      }}
                    >
                      L{stop.lap_number}: {stop.pit_duration.toFixed(3)}s
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}