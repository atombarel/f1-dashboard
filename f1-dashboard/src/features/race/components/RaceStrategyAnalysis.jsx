import React, { useMemo } from 'react'
import { getTeamColor, formatLapTime, getTireColor } from '../../../shared/utils/formatters'
import { THEME_COLORS } from '../../../constants/colors'

export function RaceStrategyAnalysis({ sessions, selectedSession, pitStops, stints, allLaps, drivers, positions, darkMode }) {
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

  // Analyze race strategies
  const strategyAnalysis = useMemo(() => {
    if (!pitStops || !stints || !allLaps || !drivers) {
      return { strategies: [], bestStrategies: [] }
    }

    // Analyze each driver's strategy
    const driverStrategies = drivers.map(driver => {
      const driverPitStops = pitStops.filter(ps => ps.driver_number === driver.driver_number)
      const driverStints = stints.filter(s => s.driver_number === driver.driver_number)
      const driverLaps = allLaps.filter(lap => lap.driver_number === driver.driver_number)
      
      // Calculate pit stop count
      const pitStopCount = driverPitStops.length
      
      // Get tire compounds used
      const tireCompounds = driverStints.map(stint => stint.compound).filter(Boolean)
      
      // Calculate average pace per stint
      const stintPaces = driverStints.map(stint => {
        const stintLaps = driverLaps.filter(lap => 
          lap.lap_number >= stint.lap_start && 
          lap.lap_number <= stint.lap_end
        )
        
        if (stintLaps.length === 0) return null
        
        const avgLapTime = stintLaps.reduce((sum, lap) => sum + lap.lap_time_seconds, 0) / stintLaps.length
        return {
          compound: stint.compound,
          avgLapTime,
          lapCount: stintLaps.length
        }
      }).filter(Boolean)
      
      // Find starting and finishing positions if position data is available
      let startPosition = null
      let finishPosition = null
      let positionChange = 0
      
      if (positions && positions.length > 0) {
        const driverPositions = positions
          .filter(pos => pos.driver_number === driver.driver_number)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        
        if (driverPositions.length > 0) {
          startPosition = driverPositions[0].position
          finishPosition = driverPositions[driverPositions.length - 1].position
          positionChange = startPosition - finishPosition // Positive = positions gained
        }
      }
      
      // Calculate overall average lap time
      const avgLapTime = driverLaps.length > 0 
        ? driverLaps.reduce((sum, lap) => sum + lap.lap_time_seconds, 0) / driverLaps.length
        : null

      return {
        driver_number: driver.driver_number,
        name_acronym: driver.name_acronym,
        team_name: driver.team_name,
        pitStopCount,
        tireCompounds,
        stintPaces,
        startPosition,
        finishPosition,
        positionChange,
        avgLapTime,
        totalLaps: driverLaps.length
      }
    })

    // Group strategies by pit stop count
    const strategyGroups = {}
    
    driverStrategies.forEach(strategy => {
      const strategyKey = `${strategy.pitStopCount}-stop`
      
      if (!strategyGroups[strategyKey]) {
        strategyGroups[strategyKey] = {
          name: `${strategy.pitStopCount}-Stop Strategy`,
          pitStops: strategy.pitStopCount,
          compounds: [],
          drivers: [],
          avgPositionChange: 0,
          avgLapTime: 0,
          successRate: 0
        }
      }
      
      strategyGroups[strategyKey].drivers.push(strategy)
      
      // Collect all tire compounds used by this strategy
      strategy.tireCompounds.forEach(compound => {
        if (compound && !strategyGroups[strategyKey].compounds.includes(compound)) {
          strategyGroups[strategyKey].compounds.push(compound)
        }
      })
    })

    // Calculate strategy effectiveness
    Object.values(strategyGroups).forEach(group => {
      const validPositionChanges = group.drivers
        .filter(d => d.positionChange !== 0)
        .map(d => d.positionChange)
      
      group.avgPositionChange = validPositionChanges.length > 0
        ? validPositionChanges.reduce((sum, change) => sum + change, 0) / validPositionChanges.length
        : 0

      const validLapTimes = group.drivers
        .filter(d => d.avgLapTime !== null)
        .map(d => d.avgLapTime)
      
      group.avgLapTime = validLapTimes.length > 0
        ? validLapTimes.reduce((sum, time) => sum + time, 0) / validLapTimes.length
        : 0

      // Success rate: percentage of drivers who gained positions or finished well
      const successfulDrivers = group.drivers.filter(d => 
        d.positionChange > 0 || (d.finishPosition && d.finishPosition <= 10)
      )
      group.successRate = group.drivers.length > 0 
        ? (successfulDrivers.length / group.drivers.length) * 100
        : 0
    })

    const strategies = Object.values(strategyGroups)
      .filter(group => group.drivers.length > 0)
      .sort((a, b) => {
        // Sort by success rate first, then by average position change
        if (Math.abs(b.successRate - a.successRate) > 5) {
          return b.successRate - a.successRate
        }
        return b.avgPositionChange - a.avgPositionChange
      })

    // Identify best 1-2 strategies
    const bestStrategies = strategies.slice(0, 2)

    return {
      strategies,
      bestStrategies
    }
  }, [pitStops, stints, allLaps, drivers, positions])

  if (!selectedSession || !isRace) {
    return null
  }

  if (!pitStops || pitStops.length === 0 || !stints || stints.length === 0) {
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
          🏁 Race Strategy Analysis
        </h2>
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: theme.TEXT_SECONDARY,
          fontStyle: 'italic'
        }}>
          No strategy data available for this session
        </div>
      </div>
    )
  }

  const { strategies, bestStrategies } = strategyAnalysis

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
        🏁 Race Strategy Analysis
      </h2>
      
      {/* Best Strategies */}
      {bestStrategies.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '15px', color: theme.TEXT }}>
            🥇 Most Effective Strategies
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: bestStrategies.length === 1 ? '1fr' : '1fr 1fr',
            gap: '15px'
          }}>
            {bestStrategies.map((strategy, index) => (
              <div
                key={strategy.name}
                style={{
                  padding: '15px',
                  backgroundColor: theme.BACKGROUND_TERTIARY,
                  borderRadius: '8px',
                  border: index === 0 ? '2px solid #10b981' : '2px solid #3b82f6'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '10px',
                  gap: '8px'
                }}>
                  <div style={{
                    fontSize: '18px'
                  }}>
                    {index === 0 ? '🥇' : '🥈'}
                  </div>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: theme.TEXT
                  }}>
                    {strategy.name}
                  </div>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  fontSize: '14px',
                  marginBottom: '10px'
                }}>
                  <div>
                    <div style={{ color: theme.TEXT_SECONDARY }}>Success Rate:</div>
                    <div style={{ 
                      fontWeight: '600', 
                      color: strategy.successRate > 50 ? '#10b981' : theme.TEXT 
                    }}>
                      {strategy.successRate.toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: theme.TEXT_SECONDARY }}>Avg Position Change:</div>
                    <div style={{ 
                      fontWeight: '600', 
                      color: strategy.avgPositionChange > 0 ? '#10b981' : strategy.avgPositionChange < 0 ? '#dc2626' : theme.TEXT
                    }}>
                      {strategy.avgPositionChange > 0 ? '+' : ''}{strategy.avgPositionChange.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <div style={{ color: theme.TEXT_SECONDARY, fontSize: '12px', marginBottom: '5px' }}>
                    Tire Compounds:
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {strategy.compounds.map(compound => (
                      <div
                        key={compound}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: getTireColor(compound),
                          color: 'white',
                          borderRadius: '3px',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                      >
                        {compound}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: theme.TEXT_SECONDARY }}>
                  Used by {strategy.drivers.length} driver{strategy.drivers.length !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Strategies */}
      <div>
        <h3 style={{ fontSize: '18px', marginBottom: '15px', color: theme.TEXT }}>
          📊 All Race Strategies
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '15px'
        }}>
          {strategies.map((strategy) => (
            <div
              key={strategy.name}
              style={{
                border: `1px solid ${theme.BORDER}`,
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: theme.BACKGROUND_TERTIARY
              }}
            >
              <div style={{
                fontWeight: 'bold',
                fontSize: '16px',
                marginBottom: '12px',
                color: theme.TEXT
              }}>
                {strategy.name}
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '12px',
                marginBottom: '12px'
              }}>
                <div>
                  <div style={{ color: theme.TEXT_SECONDARY }}>Drivers:</div>
                  <div style={{ fontWeight: '600', color: theme.TEXT }}>
                    {strategy.drivers.length}
                  </div>
                </div>
                <div>
                  <div style={{ color: theme.TEXT_SECONDARY }}>Success Rate:</div>
                  <div style={{ 
                    fontWeight: '600', 
                    color: strategy.successRate > 50 ? '#10b981' : theme.TEXT 
                  }}>
                    {strategy.successRate.toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div style={{ color: theme.TEXT_SECONDARY }}>Avg Lap Time:</div>
                  <div style={{ 
                    fontWeight: '600', 
                    color: theme.TEXT,
                    fontFamily: 'monospace'
                  }}>
                    {strategy.avgLapTime > 0 ? formatLapTime(strategy.avgLapTime) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ color: theme.TEXT_SECONDARY }}>Position Change:</div>
                  <div style={{ 
                    fontWeight: '600', 
                    color: strategy.avgPositionChange > 0 ? '#10b981' : strategy.avgPositionChange < 0 ? '#dc2626' : theme.TEXT
                  }}>
                    {strategy.avgPositionChange > 0 ? '+' : ''}{strategy.avgPositionChange.toFixed(1)}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: theme.TEXT_SECONDARY, fontSize: '11px', marginBottom: '5px' }}>
                  Tire Compounds Used:
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {strategy.compounds.map(compound => (
                    <div
                      key={compound}
                      style={{
                        padding: '2px 5px',
                        backgroundColor: getTireColor(compound),
                        color: 'white',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 'bold'
                      }}
                    >
                      {compound}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: '11px' }}>
                <div style={{ color: theme.TEXT_SECONDARY, marginBottom: '5px' }}>
                  Drivers:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {strategy.drivers.map(driver => (
                    <div
                      key={driver.driver_number}
                      style={{
                        padding: '2px 5px',
                        backgroundColor: getTeamColor(driver.team_name),
                        color: 'white',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 'bold'
                      }}
                    >
                      {driver.name_acronym}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}