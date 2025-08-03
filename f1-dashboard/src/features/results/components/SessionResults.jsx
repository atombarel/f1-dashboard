import React, { useMemo } from 'react'
import { getTeamColor, formatLapTime } from '../../../shared/utils/formatters'
import { THEME_COLORS } from '../../../constants/colors'

export function SessionResults({ sessions, selectedSession, sessionResults, startingGrid, drivers, allLaps, darkMode, meetings, selectedMeeting }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  // Get meeting info for circuit data
  const meetingInfo = useMemo(() => {
    if (!meetings || !selectedMeeting) return null
    return meetings.find(m => 
      m.meeting_key === selectedMeeting || 
      m.meeting_key === String(selectedMeeting) ||
      String(m.meeting_key) === String(selectedMeeting)
    )
  }, [meetings, selectedMeeting])

  // Determine session type and configuration
  const sessionInfo = useMemo(() => {
    const currentSession = sessions?.find(s => 
      s.session_key === selectedSession || 
      s.session_key === String(selectedSession) ||
      String(s.session_key) === String(selectedSession)
    )
    
    if (!currentSession) return null
    
    const sessionName = currentSession.session_name?.toLowerCase() || ''
    
    const config = {
      name: currentSession.session_name || 'Session',
      type: 'practice',
      showStartingGrid: false,
      showRaceGaps: false,
      showQualifyingBreakdown: false,
      date: currentSession.date_start,
      dateEnd: currentSession.date_end
    }
    
    if (sessionName.includes('qualifying')) {
      config.type = sessionName.includes('sprint') ? 'sprint_qualifying' : 'qualifying'
      config.showQualifyingBreakdown = true
    } else if (sessionName.includes('race')) {
      config.type = sessionName.includes('sprint') ? 'sprint_race' : 'race'
      config.showStartingGrid = true
      config.showRaceGaps = true
    } else if (sessionName.includes('practice')) {
      config.type = 'practice'
    }
    
    return config
  }, [sessions, selectedSession])

  // Combine session results with driver info
  const processedResults = useMemo(() => {
    if (!sessionResults || !drivers) return []
    
    const resultsWithDrivers = sessionResults.map(result => {
      const driver = drivers.find(d => d.driver_number === result.driver_number)
      
      // Determine if this is a DNF or non-finisher
      const hasValidDuration = result.duration && result.duration !== '-' && !(typeof result.duration === 'string' && isNaN(parseFloat(result.duration)))
      const isLapped = result.gap_to_leader && typeof result.gap_to_leader === 'string' && result.gap_to_leader.includes('LAP')
      const isDNF = !hasValidDuration && !isLapped
      
      return {
        ...result,
        driver,
        isDNF,
        isLapped,
        isFinisher: !isDNF && !isLapped
      }
    })
    
    // Custom sorting: Finishers first (by position), then lapped drivers (by position), then DNFs (by position)
    return resultsWithDrivers.sort((a, b) => {
      // Both are finishers - sort by position
      if (a.isFinisher && b.isFinisher) {
        return a.position - b.position
      }
      
      // Both are lapped - sort by position
      if (a.isLapped && b.isLapped) {
        return a.position - b.position
      }
      
      // Both are DNF - sort by position
      if (a.isDNF && b.isDNF) {
        return a.position - b.position
      }
      
      // Mixed types - finishers first, then lapped, then DNF
      if (a.isFinisher && !b.isFinisher) return -1
      if (!a.isFinisher && b.isFinisher) return 1
      
      // Lapped drivers come before DNF drivers
      if (a.isLapped && b.isDNF) return -1
      if (a.isDNF && b.isLapped) return 1
      
      // Fallback to position
      return a.position - b.position
    })
  }, [sessionResults, drivers])

  if (!selectedSession || !sessionInfo) {
    return null
  }

  // Circuit Information Card Component
  const CircuitInfoCard = () => (
    <div style={{
      backgroundColor: theme.BACKGROUND_SECONDARY,
      padding: '20px',
      borderRadius: '8px',
      boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.3s',
      height: 'fit-content'
    }}>
      <h3 style={{ 
        fontSize: '20px', 
        margin: '0 0 20px 0', 
        color: theme.TEXT,
        fontWeight: '600'
      }}>
        🏎️ Circuit Information
      </h3>
      
      {meetingInfo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: theme.BACKGROUND_TERTIARY,
            borderRadius: '6px',
            border: `1px solid ${theme.BORDER}`
          }}>
            <div style={{
              fontSize: '24px',
              minWidth: '32px'
            }}>
              🏁
            </div>
            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: theme.TEXT,
                marginBottom: '4px'
              }}>
                {meetingInfo.meeting_name}
              </div>
              <div style={{
                fontSize: '14px',
                color: theme.TEXT_SECONDARY
              }}>
                {meetingInfo.meeting_official_name}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: theme.BACKGROUND_TERTIARY,
            borderRadius: '6px',
            border: `1px solid ${theme.BORDER}`
          }}>
            <div style={{
              fontSize: '24px',
              minWidth: '32px'
            }}>
              🏛️
            </div>
            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: theme.TEXT,
                marginBottom: '4px'
              }}>
                {meetingInfo.circuit_short_name}
              </div>
              <div style={{
                fontSize: '14px',
                color: theme.TEXT_SECONDARY
              }}>
                {meetingInfo.location}, {meetingInfo.country_name}
              </div>
            </div>
          </div>

          {sessionInfo.date && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              backgroundColor: theme.BACKGROUND_TERTIARY,
              borderRadius: '6px',
              border: `1px solid ${theme.BORDER}`
            }}>
              <div style={{
                fontSize: '24px',
                minWidth: '32px'
              }}>
                📅
              </div>
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: theme.TEXT,
                  marginBottom: '4px'
                }}>
                  {sessionInfo.name}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: theme.TEXT_SECONDARY
                }}>
                  {new Date(sessionInfo.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })} • {new Date(sessionInfo.date).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'UTC'
                  })} UTC
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: theme.TEXT_SECONDARY,
          fontStyle: 'italic'
        }}>
          Circuit information not available
        </div>
      )}
    </div>
  )

  if (!sessionResults || sessionResults.length === 0) {
    // Show message for no results with circuit info
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: theme.BACKGROUND_SECONDARY,
          padding: '20px',
          borderRadius: '8px',
          boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.3s'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px', color: theme.TEXT }}>
            🏁 {sessionInfo.name} Results
          </h2>
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: theme.TEXT_SECONDARY,
            fontStyle: 'italic'
          }}>
            No results available for this session
          </div>
        </div>
        
        <CircuitInfoCard />
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      marginBottom: '25px'
    }}>
      {/* Session Results - Half Width */}
      <div style={{
        backgroundColor: theme.BACKGROUND_SECONDARY,
        padding: '20px',
        borderRadius: '8px',
        boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.3s'
      }}>
        <h3 style={{ 
          fontSize: '20px', 
          margin: '0 0 20px 0', 
          color: theme.TEXT,
          fontWeight: '600'
        }}>
          🏁 {sessionInfo.name} Results
        </h3>
        
        {/* Clean Results Table */}
        <div style={{
          backgroundColor: theme.BACKGROUND_TERTIARY,
          borderRadius: '8px',
          overflow: 'hidden',
          border: `1px solid ${theme.BORDER}`
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '80px 140px 1fr',
            gap: '20px',
            padding: '20px 24px',
            backgroundColor: theme.BACKGROUND_SECONDARY,
            fontSize: '16px',
            fontWeight: '600',
            color: theme.TEXT_SECONDARY,
            borderBottom: `2px solid ${theme.BORDER}`,
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}>
            <div>POS</div>
            <div>DRIVER</div>
            <div>{sessionInfo.showQualifyingBreakdown ? 'Q1 / Q2 / Q3' : 'TIME'}</div>
          </div>
          
          {/* Scrollable Table Body */}
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {/* Table Rows */}
            {processedResults.map((result, index) => {
            const isWinner = result.position === 1
            const isPodium = result.position <= 3
            const isPointScoring = result.position <= 10
            
            return (
              <div
                key={result.driver_number}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 140px 1fr',
                  gap: '20px',
                  padding: '16px 24px',
                  borderBottom: index < processedResults.length - 1 ? `1px solid ${theme.BORDER}` : 'none',
                  alignItems: 'center',
                  fontSize: '16px',
                  backgroundColor: index % 2 === 0 ? 'transparent' : theme.BACKGROUND,
                  transition: 'background-color 0.2s',
                  ':hover': {
                    backgroundColor: theme.BACKGROUND
                  }
                }}
              >
                {/* Position */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '20px',
                    color: isWinner ? '#FFD700' : isPodium ? '#C0C0C0' : theme.TEXT,
                    minWidth: '24px'
                  }}>
                    {result.position}
                  </div>
                  <div style={{
                    fontSize: '16px'
                  }}>
                    {isWinner ? '🏆' : isPodium ? '🥉' : ''}
                  </div>
                </div>
                
                {/* Driver */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px' 
                }}>
                  <div style={{
                    width: '5px',
                    height: '24px',
                    backgroundColor: getTeamColor(result.driver?.team_name),
                    borderRadius: '3px'
                  }} />
                  <span style={{ 
                    fontWeight: '600', 
                    color: theme.TEXT,
                    fontSize: '16px'
                  }}>
                    {result.driver?.name_acronym || `#${result.driver_number}`}
                  </span>
                </div>
                
                {/* Time */}
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '16px',
                  color: theme.TEXT,
                  fontWeight: '500'
                }}>
                  {sessionInfo.showQualifyingBreakdown ? (
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {result.duration && Array.isArray(result.duration) ? (
                        result.duration.map((timeValue, index) => {
                          if (!timeValue || isNaN(timeValue)) return null
                          const segmentName = ['Q1', 'Q2', 'Q3'][index]
                          if (!segmentName) return null
                          return (
                            <div key={index} style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <div style={{
                                fontSize: '12px',
                                color: theme.TEXT_SECONDARY,
                                fontWeight: '500'
                              }}>
                                {segmentName}
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600'
                              }}>
                                {formatLapTime(timeValue)}
                              </div>
                            </div>
                          )
                        }).filter(Boolean)
                      ) : (
                        result.duration && !isNaN(result.duration) ? formatLapTime(result.duration) : '-'
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Handle DNF and race status display */}
                      {(() => {
                        // Check if this is a DNF or non-finisher
                        const isDNF = !result.duration || result.duration === '-' || (typeof result.duration === 'string' && isNaN(parseFloat(result.duration)))
                        const hasGapInfo = result.gap_to_leader && result.gap_to_leader !== '-'
                        
                        if (isDNF) {
                          // For DNF drivers, show status based on gap info
                          return (
                            <div style={{ 
                              color: theme.TEXT_SECONDARY,
                              fontStyle: 'italic',
                              fontSize: '15px'
                            }}>
                              {hasGapInfo && typeof result.gap_to_leader === 'string' && result.gap_to_leader.includes('LAP') ? 
                                result.gap_to_leader : 'DNF'}
                            </div>
                          )
                        } else {
                          // For finishers, show time and gap
                          return (
                            <>
                              {formatLapTime(result.duration)}
                              {sessionInfo.showRaceGaps && hasGapInfo && (
                                <div style={{ 
                                  color: theme.TEXT_SECONDARY, 
                                  fontSize: '14px',
                                  marginTop: '3px'
                                }}>
                                  +{result.gap_to_leader}
                                </div>
                              )}
                            </>
                          )
                        }
                      })()}
                    </>
                  )}
                </div>
              </div>
            )
          })}
          </div>
        </div>
      
        
        {/* Starting Grid for Race Sessions */}
        {sessionInfo.showStartingGrid && startingGrid && startingGrid.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{
              fontSize: '14px',
              color: theme.TEXT,
              marginBottom: '10px',
              fontWeight: '600'
            }}>
              Starting Grid
            </h4>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px'
            }}>
              {startingGrid.slice(0, 20).map((gridPosition) => {
                const driver = drivers?.find(d => d.driver_number === gridPosition.driver_number)
                return (
                  <div
                    key={gridPosition.driver_number}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: getTeamColor(driver?.team_name),
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '600'
                    }}
                  >
                    P{gridPosition.position} {driver?.name_acronym || `#${gridPosition.driver_number}`}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Circuit Information Card - Half Width */}
      <CircuitInfoCard />
    </div>
  )
}