import React, { useMemo } from 'react'
import { getTireColor, getTeamColor } from '../../../shared/utils/formatters'
import { THEME_COLORS } from '../../../constants/colors'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function RaceStrategyDashboard({ sessions, selectedSession, sessionResults, pitStops, stints, allLaps, drivers, positions, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  // Create driver lookup for names
  const driverLookup = useMemo(() => {
    if (!drivers) return {}
    return drivers.reduce((acc, driver) => {
      acc[driver.driver_number] = driver.name_acronym
      return acc
    }, {})
  }, [drivers])

  // Calculate total race laps from the data
  const totalLaps = useMemo(() => {
    if (!allLaps || allLaps.length === 0) return 0
    return Math.max(...allLaps.map(lap => lap.lap_number))
  }, [allLaps])

  // Process driver strategies with their finishing positions
  const driversWithStrategy = useMemo(() => {
    if (!sessionResults || !stints) return []

    return sessionResults
      .filter(result => result.position !== null && result.position !== undefined)
      .sort((a, b) => a.position - b.position)
      .map(result => {
        const driverStints = stints.filter(s => s.driver_number === result.driver_number)
        const driverPitStops = pitStops?.filter(ps => ps.driver_number === result.driver_number) || []
        
        // Sort stints by lap start
        const sortedStints = [...driverStints].sort((a, b) => a.lap_start - b.lap_start)
        
        // Get driver lap times for calculating race duration
        const driverLaps = allLaps?.filter(lap => lap.driver_number === result.driver_number) || []
        const completedLaps = driverLaps.length
        
        // Get driver info for team name
        const driverInfo = drivers?.find(d => d.driver_number === result.driver_number)
        
        return {
          ...result,
          stints: sortedStints,
          pitStops: driverPitStops,
          completedLaps,
          dnf: result.status && result.status !== 'Finished',
          team_name: driverInfo?.team_name || 'Unknown'
        }
      })
  }, [sessionResults, stints, pitStops, allLaps, drivers])

  // Process position data for bump chart
  const bumpChartData = useMemo(() => {
    if (!positions || positions.length === 0) return []

    // Group positions by lap
    const positionsByLap = {}
    
    positions.forEach(pos => {
      const lap = pos.lap_number || 0
      if (!positionsByLap[lap]) {
        positionsByLap[lap] = {}
      }
      positionsByLap[lap][pos.driver_number] = pos.position
    })

    // Convert to array format for Recharts
    const chartData = Object.entries(positionsByLap)
      .map(([lap, positions]) => ({
        lap: parseInt(lap),
        ...positions
      }))
      .sort((a, b) => a.lap - b.lap)

    // Sample data if there are too many laps (keep every nth lap)
    if (chartData.length > 100) {
      const sampleRate = Math.ceil(chartData.length / 100)
      return chartData.filter((_, index) => index % sampleRate === 0 || index === chartData.length - 1)
    }

    return chartData
  }, [positions])

  // Get unique driver numbers from bump chart data
  const driverNumbers = useMemo(() => {
    if (bumpChartData.length === 0) return []
    const firstLap = bumpChartData[0]
    return Object.keys(firstLap)
      .filter(key => key !== 'lap')
      .map(num => parseInt(num))
  }, [bumpChartData])

  // Scale factor for timeline width (leave small padding on the right)
  const lapWidth = totalLaps > 0 ? 97 / totalLaps : 0

  const containerStyle = {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px'
  }

  const panelStyle = {
    backgroundColor: theme.background,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    padding: '16px',
    flex: 1
  }

  const titleStyle = {
    fontSize: '18px',
    fontWeight: '700',
    marginBottom: '16px',
    color: darkMode ? '#ffffff' : '#000000',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }

  const driverRowStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    padding: '8px 8px 8px 12px',
    backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
    borderRadius: '8px',
    border: darkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
    transition: 'all 0.2s',
    cursor: 'default',
    position: 'relative'
  }

  const getPositionStyle = (position) => {
    const isTop3 = position <= 3
    const colors = {
      1: '#FFD700',
      2: '#C0C0C0', 
      3: '#CD7F32'
    }
    return {
      width: '32px',
      fontSize: '14px',
      fontWeight: '800',
      color: isTop3 ? colors[position] : (darkMode ? '#ffffff' : '#000000'),
      textAlign: 'center',
      textShadow: isTop3 ? `0 1px 2px rgba(0,0,0,${darkMode ? 0.5 : 0.3})` : 'none'
    }
  }

  const getPositionContainerStyle = () => ({
    display: 'flex',
    alignItems: 'center',
    width: '140px',
    gap: '8px'
  })

  const getDriverNameInPositionStyle = (teamName) => ({
    fontSize: '13px',
    fontWeight: '600',
    color: getTeamColor(teamName),
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  })

  const teamIndicatorStyle = (teamName) => ({
    width: '3px',
    height: '36px',
    backgroundColor: getTeamColor(teamName),
    borderRadius: '2px',
    marginRight: '8px',
    alignSelf: 'center'
  })

  const timelineContainerStyle = {
    flex: 1,
    height: '32px',
    position: 'relative',
    backgroundColor: darkMode ? '#0a0a0a' : '#f8f8f8',
    borderRadius: '6px',
    marginLeft: '8px',
    marginRight: '8px',
    border: darkMode ? '1px solid #1a1a1a' : '1px solid #e0e0e0',
    overflow: 'hidden',
    boxShadow: darkMode ? 'inset 0 1px 3px rgba(0, 0, 0, 0.5)' : 'inset 0 1px 3px rgba(0, 0, 0, 0.08)'
  }

  const stintStyle = (stint) => ({
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    height: '20px',
    backgroundColor: getTireColor(stint.compound),
    opacity: darkMode ? 0.9 : 1,
    borderRadius: '8px',
    left: `${stint.lap_start * lapWidth}%`,
    width: `${(stint.lap_end - stint.lap_start + 1) * lapWidth}%`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    color: '#fff',
    fontWeight: '700',
    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
    border: darkMode ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)',
    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.1)',
    zIndex: 1,
    cursor: 'default'
  })

  const lapScaleStyle = {
    display: 'flex',
    alignItems: 'center',
    marginTop: '12px',
    paddingLeft: '188px',
    paddingRight: '10px',
    borderTop: darkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
    paddingTop: '8px'
  }

  const lapMarkersStyle = {
    flex: 1,
    position: 'relative',
    height: '20px',
    marginLeft: '10px',
    marginRight: '10px'
  }

  const lapMarkerStyle = (lap) => ({
    position: 'absolute',
    left: `${lap * lapWidth}%`,
    fontSize: '10px',
    color: theme.textSecondary,
    fontWeight: '500',
    transform: 'translateX(-50%)'
  })

  const legendStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginTop: '16px',
    padding: '10px 14px',
    backgroundColor: darkMode ? '#1a1a1a' : '#f8f8f8',
    borderRadius: '6px',
    border: darkMode ? '1px solid #2a2a2a' : '1px solid #e0e0e0'
  }

  const legendItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: (darkMode ? '#ffffff' : '#000000')
  }

  const legendColorStyle = (color) => ({
    width: '16px',
    height: '10px',
    backgroundColor: color,
    opacity: darkMode ? 0.9 : 1,
    borderRadius: '2px',
    border: darkMode ? '1px solid #3a3a3a' : '1px solid rgba(0,0,0,0.2)'
  })

  const statusStyle = {
    fontSize: '11px',
    color: '#dc2626',
    fontWeight: '600',
    marginLeft: '8px'
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null

    return (
      <div style={{
        backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
        border: `1px solid ${darkMode ? '#3a3a3a' : '#e0e0e0'}`,
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '12px',
        boxShadow: darkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '4px', color: theme.text }}>
          Lap {label}
        </div>
        {payload
          .sort((a, b) => a.value - b.value)
          .map((entry) => {
            const driverNum = entry.dataKey
            const driver = drivers?.find(d => d.driver_number === parseInt(driverNum))
            return (
              <div key={driverNum} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '2px'
              }}>
                <span style={{ 
                  color: getTeamColor(driver?.team_name || 'Unknown'),
                  fontWeight: '600'
                }}>
                  P{entry.value}
                </span>
                <span style={{ color: theme.textSecondary }}>
                  {driverLookup[driverNum] || `#${driverNum}`}
                </span>
              </div>
            )
          })}
      </div>
    )
  }

  // Show empty state if no data available
  const hasStrategyData = driversWithStrategy && driversWithStrategy.length > 0

  // Generate lap markers (every 10 laps)
  const lapMarkers = []
  for (let i = 0; i <= totalLaps; i += 10) {
    lapMarkers.push(i)
  }

  return (
    <div style={containerStyle}>
      {/* Left Panel - Strategy Timeline */}
      <div style={panelStyle}>
        <div style={titleStyle}>
          <span style={{ color: '#e10600' }}>🏁</span>
          Race Strategy Timeline
        </div>
        
        {hasStrategyData ? driversWithStrategy.map(driver => (
          <div key={driver.driver_number} style={driverRowStyle}>
            <div style={getPositionContainerStyle()}>
              <div style={getPositionStyle(driver.position)}>
                P{driver.position}
              </div>
              <div style={{
                ...getDriverNameInPositionStyle(driver.team_name),
                color: getTeamColor(driver.team_name),
                fontWeight: '700'
              }}>
                {driverLookup[driver.driver_number] || `#${driver.driver_number}`}
                {driver.dnf && <span style={statusStyle}>DNF</span>}
              </div>
            </div>
            
            <div style={teamIndicatorStyle(driver.team_name)} />
            
            <div style={timelineContainerStyle}>
              {driver.stints.map((stint, index) => {
                const isFirstStint = index === 0
                const isLastStint = index === driver.stints.length - 1
                let borderRadius = '8px'
                if (isFirstStint && isLastStint) {
                  borderRadius = '8px'
                } else if (isFirstStint) {
                  borderRadius = '8px 0 0 8px'
                } else if (isLastStint) {
                  borderRadius = '0 8px 8px 0'
                } else {
                  borderRadius = '0'
                }
                
                const stintStyleWithRounding = {
                  ...stintStyle(stint),
                  borderRadius: borderRadius
                }

                // Calculate stint width in pixels to determine if text should be shown
                const stintLaps = stint.lap_end - stint.lap_start + 1
                const stintWidthPercent = stintLaps * lapWidth
                // Only show text if stint is wide enough
                const showText = stintWidthPercent > 8
                
                return (
                  <div 
                    key={`${driver.driver_number}-stint-${index}`} 
                    style={stintStyleWithRounding}
                  >
                    {showText && `${stint.compound} (${stint.lap_end - stint.lap_start + 1})`}
                  </div>
                )
              })}
              {/* Checkered flag finish line */}
              {driver.completedLaps >= totalLaps && (
                <div style={{
                  position: 'absolute',
                  right: '0',
                  top: '0',
                  bottom: '0',
                  width: '12px',
                  background: `repeating-linear-gradient(
                    45deg,
                    ${darkMode ? '#ffffff' : '#000000'},
                    ${darkMode ? '#ffffff' : '#000000'} 3px,
                    ${darkMode ? '#666666' : '#cccccc'} 3px,
                    ${darkMode ? '#666666' : '#cccccc'} 6px
                  )`,
                  borderRadius: '0 6px 6px 0',
                  opacity: 0.8
                }} title="Finished" />
              )}
              {/* DNF indicator */}
              {driver.dnf && (
                <div style={{
                  position: 'absolute',
                  right: '0',
                  top: '0',
                  bottom: '0',
                  width: '12px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
                  borderRadius: '0 6px 6px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#ffffff',
                  fontWeight: '700'
                }} title="Did Not Finish">
                  ✕
                </div>
              )}
            </div>
            
            <div style={{
              width: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: (darkMode ? '#a0a0a0' : '#666666'),
              fontWeight: '500',
              backgroundColor: darkMode ? 'rgba(26, 26, 26, 0.5)' : 'rgba(248, 248, 248, 0.5)',
              borderRadius: '0 8px 8px 0',
              borderLeft: darkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
              marginRight: '12px'
            }}>
              {driver.pitStops.length} stop{driver.pitStops.length !== 1 ? 's' : ''}
            </div>
          </div>
        )) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: theme.textSecondary,
            fontSize: '14px'
          }}>
            Loading strategy data...
          </div>
        )}
        
        {hasStrategyData && (
          <div style={lapScaleStyle}>
            <div style={lapMarkersStyle}>
              {lapMarkers.map(lap => (
                <div key={lap} style={lapMarkerStyle(lap)}>
                  {lap}
                </div>
              ))}
            </div>
            <div style={{ width: '92px' }} />
          </div>
        )}
        
        {hasStrategyData && (
          <div style={legendStyle}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: (darkMode ? '#ffffff' : '#000000') }}>Legend:</div>
            <div style={legendItemStyle}>
              <div style={legendColorStyle(getTireColor('SOFT'))} />
              <span>Soft</span>
            </div>
            <div style={legendItemStyle}>
              <div style={legendColorStyle(getTireColor('MEDIUM'))} />
              <span>Medium</span>
            </div>
            <div style={legendItemStyle}>
              <div style={legendColorStyle(getTireColor('HARD'))} />
              <span>Hard</span>
            </div>
            <div style={legendItemStyle}>
              <div style={legendColorStyle(getTireColor('INTERMEDIATE'))} />
              <span>Inter</span>
            </div>
            <div style={legendItemStyle}>
              <div style={legendColorStyle(getTireColor('WET'))} />
              <span>Wet</span>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Position Bump Chart */}
      <div style={panelStyle}>
        <div style={titleStyle}>
          <span style={{ color: '#e10600' }}>📈</span>
          Position Changes
        </div>
        
        {bumpChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={600}>
            <LineChart 
              data={bumpChartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={darkMode ? '#2a2a2a' : '#e0e0e0'}
              />
              <XAxis 
                dataKey="lap" 
                stroke={theme.textSecondary}
                tick={{ fill: theme.textSecondary, fontSize: 11 }}
                label={{ value: 'Lap', position: 'insideBottom', offset: -5, style: { fill: theme.textSecondary } }}
              />
              <YAxis 
                reversed
                domain={[1, 20]}
                ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]}
                stroke={theme.textSecondary}
                tick={{ fill: theme.textSecondary, fontSize: 11 }}
                label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { fill: theme.textSecondary } }}
              />
              <Tooltip content={<CustomTooltip />} />
              {driverNumbers.map(driverNum => {
                const driver = drivers?.find(d => d.driver_number === driverNum)
                const teamColor = getTeamColor(driver?.team_name || 'Unknown')
                
                return (
                  <Line
                    key={driverNum}
                    type="monotone"
                    dataKey={driverNum.toString()}
                    stroke={teamColor}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    name={driverLookup[driverNum] || `#${driverNum}`}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '400px',
            color: theme.textSecondary,
            fontSize: '14px'
          }}>
            No position data available
          </div>
        )}
      </div>
    </div>
  )
}