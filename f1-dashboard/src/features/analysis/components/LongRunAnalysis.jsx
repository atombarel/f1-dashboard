import React, { useMemo } from 'react'
import { formatLapTime, getTeamColor, getTireColor } from '../../../shared/utils/formatters'
import { THEME_COLORS } from '../../../constants/colors'
import { LONG_RUN_CONFIG } from '../../../constants/config'

export function LongRunAnalysis({ sessions, selectedSession, stints, allLaps, drivers, selectedDrivers, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  // Check if current session is a practice session
  const isPractice = useMemo(() => {
    // Convert selectedSession to string for comparison if needed
    const currentSession = sessions?.find(s => 
      s.session_key === selectedSession || 
      s.session_key === String(selectedSession) ||
      String(s.session_key) === String(selectedSession)
    )
    const sessionName = currentSession?.session_name?.toLowerCase() || ''
    const isPracticeSession = sessionName.includes('practice')
    
    
    return isPracticeSession
  }, [sessions, selectedSession, stints, allLaps])

  // Calculate stint analysis for long runs
  const stintAnalysis = useMemo(() => {
    if (!isPractice || !stints || !allLaps || !drivers) return {}

    const analysis = {}
    const driversToAnalyze = selectedDrivers.length > 0 
      ? selectedDrivers 
      : drivers.map(d => d.driver_number)

    driversToAnalyze.forEach(driverNum => {
      const driverStints = stints.filter(s => s.driver_number === driverNum)
      const driverLaps = allLaps.filter(l => l.driver_number === driverNum)
      
      if (driverStints.length === 0 || driverLaps.length === 0) return
      
      analysis[driverNum] = driverStints.map(stint => {
        const stintLaps = driverLaps.filter(lap => 
          lap.lap_number >= stint.lap_start && 
          lap.lap_number <= stint.lap_end &&
          lap.lap_number > stint.lap_start // Skip out lap
        )
        
        if (stintLaps.length < LONG_RUN_CONFIG.MIN_LAPS) return null
        
        const avgTime = stintLaps.reduce((sum, lap) => sum + lap.lap_time_seconds, 0) / stintLaps.length
        
        return {
          stint_number: stint.stint_number,
          compound: stint.compound,
          lap_start: stint.lap_start,
          lap_end: stint.lap_end,
          lap_count: stintLaps.length,
          avg_time: avgTime,
          min_time: Math.min(...stintLaps.map(l => l.lap_time_seconds)),
          max_time: Math.max(...stintLaps.map(l => l.lap_time_seconds))
        }
      }).filter(s => s !== null)
    })

    // Remove drivers with no long runs
    Object.keys(analysis).forEach(key => {
      if (analysis[key].length === 0) {
        delete analysis[key]
      }
    })

    return analysis
  }, [isPractice, stints, allLaps, drivers, selectedDrivers])

  if (!selectedSession || !isPractice) {
    return null
  }

  if (Object.keys(stintAnalysis).length === 0) {
    return (
      <div style={{
        backgroundColor: theme.BACKGROUND_SECONDARY,
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.3s'
      }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px', color: theme.TEXT }}>
          Long Run Analysis - Practice Session ({LONG_RUN_CONFIG.MIN_LAPS}+ Laps)
        </h2>
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: theme.TEXT_SECONDARY,
          fontStyle: 'italic'
        }}>
          No long runs ({LONG_RUN_CONFIG.MIN_LAPS}+ laps) found for this practice session. Either no stint data is available or no drivers completed long runs.
        </div>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: theme.BACKGROUND_SECONDARY,
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '30px',
      boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.3s'
    }}>
      <h2 style={{ fontSize: '24px', marginBottom: '20px', color: theme.TEXT }}>
        Long Run Analysis - Practice Session ({LONG_RUN_CONFIG.MIN_LAPS}+ Laps)
      </h2>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '20px'
      }}>
        {Object.entries(stintAnalysis).map(([driverNumber, stints]) => {
          const driver = drivers?.find(d => d.driver_number === parseInt(driverNumber))
          
          return (
            <div 
              key={driverNumber}
              style={{
                border: `3px solid ${getTeamColor(driver?.team_name)}`,
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: theme.BACKGROUND_TERTIARY
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '15px',
                gap: '10px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getTeamColor(driver?.team_name)
                }} />
                <span style={{ 
                  fontWeight: '700', 
                  fontSize: '18px',
                  color: theme.TEXT
                }}>
                  {driver?.name_acronym || `#${driverNumber}`}
                </span>
                <span style={{ 
                  color: theme.TEXT_SECONDARY,
                  fontSize: '14px' 
                }}>
                  {driver?.team_name}
                </span>
              </div>
              
              {stints.map((stint, index) => (
                <div 
                  key={stint.stint_number}
                  style={{
                    backgroundColor: theme.BACKGROUND,
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: index < stints.length - 1 ? '10px' : '0',
                    border: `1px solid ${getTireColor(stint.compound)}40`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: getTireColor(stint.compound)
                      }} />
                      <span style={{ 
                        fontWeight: '600',
                        color: theme.TEXT,
                        fontSize: '14px'
                      }}>
                        {stint.compound}
                      </span>
                    </div>
                    <span style={{ 
                      color: theme.TEXT_SECONDARY,
                      fontSize: '12px'
                    }}>
                      Laps {stint.lap_start + 1}-{stint.lap_end} ({stint.lap_count} laps)
                    </span>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    fontSize: '12px'
                  }}>
                    <div>
                      <div style={{ color: theme.TEXT_SECONDARY }}>Best:</div>
                      <div style={{ 
                        fontWeight: '600',
                        color: '#22c55e',
                        fontFamily: 'monospace'
                      }}>
                        {formatLapTime(stint.min_time)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: theme.TEXT_SECONDARY }}>Avg:</div>
                      <div style={{ 
                        fontWeight: '600',
                        color: theme.TEXT,
                        fontFamily: 'monospace'
                      }}>
                        {formatLapTime(stint.avg_time)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: theme.TEXT_SECONDARY }}>Worst:</div>
                      <div style={{ 
                        fontWeight: '600',
                        color: '#ef4444',
                        fontFamily: 'monospace'
                      }}>
                        {formatLapTime(stint.max_time)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}