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

  // Combine session results with driver info and compute qualifying gaps per segment
  const processedResults = useMemo(() => {
    if (!sessionResults || !drivers) return []

    const resultsWithDrivers = sessionResults.map(result => {
      const driver = drivers.find(d => d.driver_number === result.driver_number)

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

    // If qualifying, compute per-segment bests and gaps (Q1/Q2/Q3)
    const isQuali = sessionInfo?.showQualifyingBreakdown
    if (isQuali) {
      // duration can be number (seconds) or array [q1,q2,q3] seconds according to existing UI
      const segmentBests = [0,1,2].map(segIdx => {
        const times = resultsWithDrivers
          .map(r => Array.isArray(r.duration) ? Number(r.duration[segIdx]) : NaN)
          .filter(v => typeof v === 'number' && !isNaN(v) && v > 0)
        if (times.length === 0) return null
        return Math.min(...times)
      })

      return resultsWithDrivers.map(r => {
        if (!Array.isArray(r.duration)) return r
        const gaps = r.duration.map((val, idx) => {
          const best = segmentBests[idx]
          if (!best || !val || isNaN(val)) return null
          const delta = Number(val) - best
          return delta >= 0 ? delta : 0
        })
        return { ...r, quali_segment_gaps: gaps, quali_segment_bests: segmentBests }
      })
      .sort((a, b) => a.position - b.position)
    }

    // Non-qualifying: original ordering rules
    return resultsWithDrivers.sort((a, b) => {
      if (a.isFinisher && b.isFinisher) return a.position - b.position
      if (a.isLapped && b.isLapped) return a.position - b.position
      if (a.isDNF && b.isDNF) return a.position - b.position
      if (a.isFinisher && !b.isFinisher) return -1
      if (!a.isFinisher && b.isFinisher) return 1
      if (a.isLapped && b.isDNF) return -1
      if (a.isDNF && b.isLapped) return 1
      return a.position - b.position
    })
  }, [sessionResults, drivers, sessionInfo])

  // Q3 Top 2 comparison: extract sector times and speeds from matching laps
  const q3Top2Comparison = useMemo(() => {
    if (!sessionInfo?.showQualifyingBreakdown) return null
    if (!processedResults || processedResults.length === 0 || !allLaps) return null

    // pick top two by position that have Q3 times
    const topWithQ3 = processedResults
      .filter(r => Array.isArray(r.duration) && typeof r.duration[2] === 'number' && !isNaN(r.duration[2]) && r.duration[2] > 0)
      .sort((a, b) => a.position - b.position)
      .slice(0, 2)

    if (topWithQ3.length < 2) return null

    const tolerance = 0.02 // seconds tolerance when matching Q3 time to a lap
    const enrich = (result) => {
      const q3 = Number(result.duration[2])
      const driverLaps = allLaps.filter(l => l.driver_number === result.driver_number && typeof l.lap_duration === 'number')
      // find lap with lap_duration close to q3
      let bestLap = null
      let bestDiff = Infinity
      for (const lap of driverLaps) {
        const diff = Math.abs(Number(lap.lap_duration) - q3)
        if (diff < bestDiff) {
          bestDiff = diff
          bestLap = lap
        }
      }
      if (!bestLap || bestDiff > tolerance) {
        // fallback: take min lap (should equal Q3 best) if within sanity bounds
        const sorted = [...driverLaps].sort((a, b) => a.lap_duration - b.lap_duration)
        bestLap = sorted[0] || null
      }
      return {
        driver_number: result.driver_number,
        name_acronym: result.driver?.name_acronym || `#${result.driver_number}`,
        team_name: result.driver?.team_name || 'Unknown',
        q3_time: q3,
        sector1: typeof bestLap?.duration_sector_1 === 'number' ? bestLap.duration_sector_1 : null,
        sector2: typeof bestLap?.duration_sector_2 === 'number' ? bestLap.duration_sector_2 : null,
        sector3: typeof bestLap?.duration_sector_3 === 'number' ? bestLap.duration_sector_3 : null,
        i1_speed: bestLap?.i1_speed ?? null,
        i2_speed: bestLap?.i2_speed ?? null,
        st_speed: bestLap?.st_speed ?? null,
      }
    }

    const a = enrich(topWithQ3[0])
    const b = enrich(topWithQ3[1])

    const toDelta = (va, vb) => (typeof va === 'number' && typeof vb === 'number') ? (va - vb) : null
    return {
      a,
      b,
      deltas: {
        total: toDelta(a.q3_time, b.q3_time),
        s1: toDelta(a.sector1, b.sector1),
        s2: toDelta(a.sector2, b.sector2),
        s3: toDelta(a.sector3, b.sector3),
      }
    }
  }, [sessionInfo, processedResults, allLaps])

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
    <>
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
                          const segName = ['Q1', 'Q2', 'Q3'][index]
                          if (!segName || !timeValue || isNaN(timeValue)) return null
                          const gap = Array.isArray(result.quali_segment_gaps) ? result.quali_segment_gaps[index] : null
                          const isBest = Array.isArray(result.quali_segment_bests) && result.quali_segment_bests[index] === timeValue
                          return (
                            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <div style={{ fontSize: '12px', color: theme.TEXT_SECONDARY, fontWeight: '500' }}>{segName}</div>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: isBest ? '#10b981' : theme.TEXT }}>
                                {formatLapTime(timeValue)}
                              </div>
                              {gap !== null && gap !== undefined && gap > 0 && (
                                <div style={{ fontSize: '12px', color: theme.TEXT_SECONDARY }}>
                                  +{gap.toFixed(3)}s
                                </div>
                              )}
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

    {/* Q3 Top 2 Comparison Panel */}
    {sessionInfo?.showQualifyingBreakdown && q3Top2Comparison && (
      <div style={{
        backgroundColor: theme.BACKGROUND_SECONDARY,
        padding: '20px',
        borderRadius: '8px',
        boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.3s',
        marginBottom: '25px'
      }}>
        <h3 style={{ fontSize: '20px', margin: '0 0 16px 0', color: theme.TEXT, fontWeight: '700' }}>
          Q3 Top 2 Comparison
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr', gap: '16px', alignItems: 'center' }}>
          {/* Driver A */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '22px', borderRadius: '3px', backgroundColor: getTeamColor(q3Top2Comparison.a.team_name) }} />
              <div style={{ color: theme.TEXT, fontWeight: 700 }}>{q3Top2Comparison.a.name_acronym}</div>
            </div>
            <div style={{ fontFamily: 'monospace', color: theme.TEXT }}>
              {formatLapTime(q3Top2Comparison.a.q3_time)}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {['S1', 'S2', 'S3'].map((label, idx) => {
                const val = [q3Top2Comparison.a.sector1, q3Top2Comparison.a.sector2, q3Top2Comparison.a.sector3][idx]
                const delta = [q3Top2Comparison.deltas.s1, q3Top2Comparison.deltas.s2, q3Top2Comparison.deltas.s3][idx]
                const isPurple = typeof delta === 'number' ? delta < 0 : false
                return (
                  <div key={label} style={{
                    backgroundColor: theme.BACKGROUND_TERTIARY,
                    border: `1px solid ${theme.BORDER}`,
                    borderRadius: '6px',
                    padding: '6px 8px',
                    minWidth: '84px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '11px', color: theme.TEXT_SECONDARY }}>{label}</div>
                    <div style={{ fontWeight: 700, color: isPurple ? '#a855f7' : theme.TEXT }}>{val ? formatLapTime(val) : '-'}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px', color: theme.TEXT_SECONDARY, fontSize: '12px' }}>
              <div>I1: {q3Top2Comparison.a.i1_speed ?? '-'} km/h</div>
              <div>I2: {q3Top2Comparison.a.i2_speed ?? '-' } km/h</div>
              <div>ST: {q3Top2Comparison.a.st_speed ?? '-' } km/h</div>
            </div>
          </div>

          {/* Delta column */}
          <div style={{ textAlign: 'center', color: theme.TEXT }}>
            <div style={{ fontSize: '12px', color: theme.TEXT_SECONDARY }}>Total Δ</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '18px' }}>
              {q3Top2Comparison.deltas.total !== null && q3Top2Comparison.deltas.total !== undefined ?
                `${q3Top2Comparison.deltas.total >= 0 ? '+' : ''}${q3Top2Comparison.deltas.total.toFixed(3)}s` : '-'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {['S1','S2','S3'].map((label, idx) => {
                const d = [q3Top2Comparison.deltas.s1, q3Top2Comparison.deltas.s2, q3Top2Comparison.deltas.s3][idx]
                const color = typeof d === 'number' ? (d < 0 ? '#22c55e' : d > 0 ? '#ef4444' : theme.TEXT_SECONDARY) : theme.TEXT_SECONDARY
                return (
                  <div key={label} style={{ color, fontFamily: 'monospace', fontWeight: 700 }}>
                    {label} {typeof d === 'number' ? `${d >= 0 ? '+' : ''}${d.toFixed(3)}s` : '-'}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Driver B */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: theme.TEXT, fontWeight: 700 }}>{q3Top2Comparison.b.name_acronym}</div>
              <div style={{ width: '6px', height: '22px', borderRadius: '3px', backgroundColor: getTeamColor(q3Top2Comparison.b.team_name) }} />
            </div>
            <div style={{ fontFamily: 'monospace', color: theme.TEXT }}>
              {formatLapTime(q3Top2Comparison.b.q3_time)}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {['S1', 'S2', 'S3'].map((label, idx) => {
                const val = [q3Top2Comparison.b.sector1, q3Top2Comparison.b.sector2, q3Top2Comparison.b.sector3][idx]
                const delta = [q3Top2Comparison.deltas.s1, q3Top2Comparison.deltas.s2, q3Top2Comparison.deltas.s3][idx]
                const isPurple = typeof delta === 'number' ? delta > 0 : false // if B is faster, delta for A is positive
                return (
                  <div key={label} style={{
                    backgroundColor: theme.BACKGROUND_TERTIARY,
                    border: `1px solid ${theme.BORDER}`,
                    borderRadius: '6px',
                    padding: '6px 8px',
                    minWidth: '84px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '11px', color: theme.TEXT_SECONDARY }}>{label}</div>
                    <div style={{ fontWeight: 700, color: isPurple ? '#a855f7' : theme.TEXT }}>{val ? formatLapTime(val) : '-'}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px', color: theme.TEXT_SECONDARY, fontSize: '12px' }}>
              <div>I1: {q3Top2Comparison.b.i1_speed ?? '-'} km/h</div>
              <div>I2: {q3Top2Comparison.b.i2_speed ?? '-' } km/h</div>
              <div>ST: {q3Top2Comparison.b.st_speed ?? '-' } km/h</div>
            </div>
          </div>
        </div>

      </div>
    )}
  </>
  )
}