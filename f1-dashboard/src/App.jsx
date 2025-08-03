import React, { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { f1Api, formatLapTime, getTeamColor, getTireColor } from './services/f1Api'

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 10,
    },
  },
})

function Dashboard() {
  const [selectedYear, setSelectedYear] = useState('2025')
  const [selectedMeeting, setSelectedMeeting] = useState('')
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedDrivers, setSelectedDrivers] = useState([])
  const [darkMode, setDarkMode] = useState(false)

  // Get meetings for selected year
  const { data: meetings } = useQuery({
    queryKey: ['meetings', selectedYear],
    queryFn: () => f1Api.getMeetings(parseInt(selectedYear)),
    enabled: !!selectedYear
  })

  // Get sessions when meeting is selected
  const { data: sessions } = useQuery({
    queryKey: ['sessions', selectedMeeting],
    queryFn: () => f1Api.getSessions(selectedMeeting),
    enabled: !!selectedMeeting
  })

  // Get drivers when session is selected
  const { data: drivers } = useQuery({
    queryKey: ['drivers', selectedSession],
    queryFn: () => f1Api.getDrivers(selectedSession),
    enabled: !!selectedSession
  })

  // Get lap data for all drivers
  const { data: allLaps, isLoading: lapsLoading } = useQuery({
    queryKey: ['laps', selectedSession],
    queryFn: () => f1Api.getLaps(selectedSession),
    enabled: !!selectedSession
  })

  // Get stint data for tire strategy
  const { data: stints } = useQuery({
    queryKey: ['stints', selectedSession],
    queryFn: () => f1Api.getStints(selectedSession),
    enabled: !!selectedSession
  })

  // Process lap data for chart
  const chartData = React.useMemo(() => {
    if (!allLaps || allLaps.length === 0) return []
    
    // Group laps by lap number
    const lapGroups = {}
    allLaps.forEach(lap => {
      if (!lapGroups[lap.lap_number]) {
        lapGroups[lap.lap_number] = { lap_number: lap.lap_number }
      }
      const driver = drivers?.find(d => d.driver_number === lap.driver_number)
      const driverKey = `driver_${lap.driver_number}`
      lapGroups[lap.lap_number][driverKey] = lap.lap_time_seconds
      lapGroups[lap.lap_number][`${driverKey}_name`] = driver?.name_acronym || `#${lap.driver_number}`
    })
    
    return Object.values(lapGroups).sort((a, b) => a.lap_number - b.lap_number)
  }, [allLaps, drivers])

  // Get unique drivers from laps
  const driversInSession = React.useMemo(() => {
    if (!allLaps) return []
    const uniqueDrivers = [...new Set(allLaps.map(lap => lap.driver_number))]
    return uniqueDrivers.map(num => {
      const driver = drivers?.find(d => d.driver_number === num)
      return {
        driver_number: num,
        name_acronym: driver?.name_acronym || `#${num}`,
        team_name: driver?.team_name || 'Unknown',
        color: getTeamColor(driver?.team_name)
      }
    }).sort((a, b) => a.driver_number - b.driver_number)
  }, [allLaps, drivers])

  // Filter drivers to show
  const driversToShow = selectedDrivers.length > 0 
    ? driversInSession.filter(d => selectedDrivers.includes(d.driver_number))
    : driversInSession

  return (
    <div style={{ padding: '20px', backgroundColor: darkMode ? '#0a0a0a' : '#f5f5f5', minHeight: '100vh', transition: 'background-color 0.3s' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: darkMode ? '#fff' : '#333' }}>
            F1 Lap Time Analysis
          </h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: '10px 20px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: darkMode ? '#333' : '#fff',
              color: darkMode ? '#fff' : '#333',
              cursor: 'pointer',
              fontWeight: '600',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s'
            }}
          >
            {darkMode ? '☀️' : '🌙'} {darkMode ? 'Light' : 'Dark'} Mode
          </button>
        </div>

        {/* Controls */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '15px', 
          marginBottom: '30px',
          backgroundColor: darkMode ? '#1a1a1a' : 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.3s'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: darkMode ? '#aaa' : '#666' }}>
              Year:
            </label>
            <select 
              value={selectedYear} 
              onChange={(e) => {
                setSelectedYear(e.target.value)
                setSelectedMeeting('')
                setSelectedSession('')
                setSelectedDrivers([])
              }}
              style={{
                width: '100%',
                padding: '8px',
                border: darkMode ? '2px solid #444' : '2px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: darkMode ? '#2a2a2a' : '#fff',
                color: darkMode ? '#fff' : '#333'
              }}
            >
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: darkMode ? '#aaa' : '#666' }}>
              Race Weekend:
            </label>
            <select 
              value={selectedMeeting} 
              onChange={(e) => {
                setSelectedMeeting(e.target.value)
                setSelectedSession('')
                setSelectedDrivers([])
              }}
              style={{
                width: '100%',
                padding: '8px',
                border: darkMode ? '2px solid #444' : '2px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: darkMode ? '#2a2a2a' : '#fff',
                color: darkMode ? '#fff' : '#333',
                opacity: meetings ? 1 : 0.5
              }}
              disabled={!meetings || meetings.length === 0}
            >
              <option value="">Select a race...</option>
              {meetings?.map(meeting => (
                <option key={meeting.meeting_key} value={meeting.meeting_key}>
                  {meeting.meeting_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: darkMode ? '#aaa' : '#666' }}>
              Session:
            </label>
            <select 
              value={selectedSession} 
              onChange={(e) => {
                setSelectedSession(e.target.value)
                setSelectedDrivers([])
              }}
              disabled={!selectedMeeting}
              style={{
                width: '100%',
                padding: '8px',
                border: darkMode ? '2px solid #444' : '2px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: darkMode ? '#2a2a2a' : '#fff',
                color: darkMode ? '#fff' : '#333',
                opacity: selectedMeeting ? 1 : 0.5
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
        </div>

        {/* Driver Selection */}
        {driversInSession.length > 0 && (
          <div style={{
            backgroundColor: darkMode ? '#1a1a1a' : 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '30px',
            boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.3s'
          }}>
            <h3 style={{ marginBottom: '15px', color: darkMode ? '#fff' : '#333' }}>Select Drivers to Compare:</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {driversInSession.map(driver => (
                <button
                  key={driver.driver_number}
                  onClick={() => {
                    if (selectedDrivers.includes(driver.driver_number)) {
                      setSelectedDrivers(selectedDrivers.filter(d => d !== driver.driver_number))
                    } else {
                      setSelectedDrivers([...selectedDrivers, driver.driver_number])
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '2px solid',
                    borderColor: selectedDrivers.includes(driver.driver_number) || selectedDrivers.length === 0 
                      ? driver.color 
                      : '#ddd',
                    backgroundColor: selectedDrivers.includes(driver.driver_number) || selectedDrivers.length === 0
                      ? driver.color + '20'
                      : darkMode ? '#2a2a2a' : 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    color: darkMode ? '#fff' : '#333',
                    transition: 'all 0.2s'
                  }}
                >
                  {driver.name_acronym}
                </button>
              ))}
              {selectedDrivers.length > 0 && (
                <button
                  onClick={() => setSelectedDrivers([])}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '2px solid #666',
                    backgroundColor: '#666',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Show All
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chart */}
        <div style={{
          backgroundColor: darkMode ? '#1a1a1a' : 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.3s'
        }}>
          {lapsLoading && (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '4px solid #e10600',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                margin: '0 auto 20px',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ color: '#666', fontSize: '18px' }}>Loading lap data...</p>
            </div>
          )}

          {!selectedSession && !lapsLoading && (
            <div style={{ textAlign: 'center', padding: '60px', color: darkMode ? '#aaa' : '#666' }}>
              <h3 style={{ fontSize: '24px', marginBottom: '10px' }}>Select a session to view lap times</h3>
              <p>Choose a race weekend and session from the dropdowns above</p>
            </div>
          )}

          {selectedSession && chartData.length > 0 && !lapsLoading && (
            <>
              <h2 style={{ fontSize: '24px', marginBottom: '20px', color: darkMode ? '#fff' : '#333' }}>
                Lap Times Chart
              </h2>
              <div style={{ width: '100%', height: '500px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={chartData} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#333" : "#e0e0e0"} />
                    <XAxis 
                      dataKey="lap_number" 
                      stroke={darkMode ? "#aaa" : "#666"}
                      label={{ value: 'Lap Number', position: 'insideBottom', offset: -10, style: { fontSize: 14 } }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      stroke={darkMode ? "#aaa" : "#666"}
                      tickFormatter={(value) => formatLapTime(value)}
                      domain={['dataMin - 2', 'dataMax + 5']}
                      label={{ value: 'Lap Time', angle: -90, position: 'insideLeft', style: { fontSize: 14 } }}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value) => formatLapTime(value)}
                      labelFormatter={(label) => `Lap ${label}`}
                      contentStyle={{ 
                        backgroundColor: darkMode ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                        border: darkMode ? '1px solid #444' : '1px solid #ddd',
                        borderRadius: '4px',
                        color: darkMode ? '#fff' : '#333'
                      }}
                      itemStyle={{ color: darkMode ? '#fff' : '#333' }}
                      labelStyle={{ color: darkMode ? '#aaa' : '#666' }}
                    />
                    <Legend />
                    {driversToShow.map(driver => (
                      <Line
                        key={driver.driver_number}
                        type="monotone"
                        dataKey={`driver_${driver.driver_number}`}
                        name={driver.name_acronym}
                        stroke={driver.color}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                        activeDot={{ r: 6, strokeWidth: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Stats */}
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-around',
                flexWrap: 'wrap'
              }}>
                <div style={{ textAlign: 'center', margin: '10px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e10600' }}>
                    {chartData.length}
                  </div>
                  <div style={{ color: darkMode ? '#aaa' : '#666', fontSize: '14px' }}>Total Laps</div>
                </div>
                <div style={{ textAlign: 'center', margin: '10px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e10600' }}>
                    {driversInSession.length}
                  </div>
                  <div style={{ color: darkMode ? '#aaa' : '#666', fontSize: '14px' }}>Drivers</div>
                </div>
                <div style={{ textAlign: 'center', margin: '10px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e10600' }}>
                    {allLaps && formatLapTime(Math.min(...allLaps.map(l => l.lap_time_seconds)))}
                  </div>
                  <div style={{ color: darkMode ? '#aaa' : '#666', fontSize: '14px' }}>Fastest Lap</div>
                </div>
              </div>
            </>
          )}

          {selectedSession && chartData.length === 0 && !lapsLoading && (
            <div style={{ textAlign: 'center', padding: '60px', color: darkMode ? '#aaa' : '#666' }}>
              <h3 style={{ fontSize: '24px', marginBottom: '10px' }}>No lap data available</h3>
              <p>This session may not have lap time data or hasn't started yet</p>
            </div>
          )}
        </div>

        {/* Driver Details Card */}
        {selectedDrivers.length > 0 && allLaps && (
          <div style={{
            backgroundColor: darkMode ? '#1a1a1a' : 'white',
            padding: '20px',
            borderRadius: '8px',
            marginTop: '20px',
            boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.3s'
          }}>
            <h2 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>
              Driver Details
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {selectedDrivers.map(driverNumber => {
                const driver = drivers?.find(d => d.driver_number === driverNumber)
                const driverLaps = allLaps.filter(lap => lap.driver_number === driverNumber)
                
                if (driverLaps.length === 0) return null
                
                const fastestLap = Math.min(...driverLaps.map(l => l.lap_time_seconds))
                const slowestLap = Math.max(...driverLaps.map(l => l.lap_time_seconds))
                const avgLapTime = driverLaps.reduce((sum, lap) => sum + lap.lap_time_seconds, 0) / driverLaps.length
                
                // Calculate consistency (standard deviation)
                const variance = driverLaps.reduce((sum, lap) => 
                  sum + Math.pow(lap.lap_time_seconds - avgLapTime, 2), 0) / driverLaps.length
                const stdDev = Math.sqrt(variance)
                
                // Find fastest lap number
                const fastestLapData = driverLaps.find(l => l.lap_time_seconds === fastestLap)
                
                // Get tire stints info
                const driverStints = stints?.filter(s => s.driver_number === driverNumber) || []
                
                return (
                  <div 
                    key={driverNumber}
                    style={{
                      border: `3px solid ${getTeamColor(driver?.team_name)}`,
                      borderRadius: '8px',
                      padding: '15px',
                      backgroundColor: darkMode ? '#2a2a2a' : '#f9f9f9'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '15px',
                      paddingBottom: '15px',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        backgroundColor: getTeamColor(driver?.team_name),
                        color: 'white',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '18px',
                        marginRight: '15px'
                      }}>
                        {driver?.name_acronym || `#${driverNumber}`}
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 5px 0', color: darkMode ? '#fff' : '#333' }}>
                          {driver?.full_name || `Driver #${driverNumber}`}
                        </h3>
                        <p style={{ margin: 0, color: darkMode ? '#aaa' : '#666', fontSize: '14px' }}>
                          {driver?.team_name || 'Unknown Team'} • #{driverNumber}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                      <div>
                        <strong style={{ color: darkMode ? '#aaa' : '#666' }}>Total Laps:</strong>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: darkMode ? '#fff' : '#333' }}>
                          {driverLaps.length}
                        </div>
                      </div>
                      
                      <div>
                        <strong style={{ color: darkMode ? '#aaa' : '#666' }}>Fastest Lap:</strong>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>
                          {formatLapTime(fastestLap)}
                        </div>
                        <div style={{ fontSize: '12px', color: darkMode ? '#999' : '#888' }}>
                          Lap {fastestLapData?.lap_number}
                        </div>
                      </div>
                      
                      <div>
                        <strong style={{ color: darkMode ? '#aaa' : '#666' }}>Average Lap:</strong>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
                          {formatLapTime(avgLapTime)}
                        </div>
                      </div>
                      
                      <div>
                        <strong style={{ color: darkMode ? '#aaa' : '#666' }}>Slowest Lap:</strong>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>
                          {formatLapTime(slowestLap)}
                        </div>
                      </div>
                      
                      <div>
                        <strong style={{ color: darkMode ? '#aaa' : '#666' }}>Consistency:</strong>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8b5cf6' }}>
                          ±{stdDev.toFixed(3)}s
                        </div>
                        <div style={{ fontSize: '12px', color: darkMode ? '#999' : '#888' }}>
                          {stdDev < 1 ? 'Very Consistent' : stdDev < 2 ? 'Consistent' : 'Variable'}
                        </div>
                      </div>
                      
                      <div>
                        <strong style={{ color: darkMode ? '#aaa' : '#666' }}>Pit Stops:</strong>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
                          {driverStints.length > 0 ? driverStints.length - 1 : 'N/A'}
                        </div>
                      </div>
                    </div>
                    
                    {driverStints.length > 0 && (
                      <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: darkMode ? '1px solid #444' : '1px solid #e0e0e0' }}>
                        <strong style={{ color: '#666', fontSize: '14px' }}>Tire Strategy:</strong>
                        <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
                          {driverStints.map((stint, idx) => (
                            <div 
                              key={idx}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: '#fff',
                                backgroundColor: getTireColor(stint.compound) || '#888',
                                border: darkMode ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)',
                                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                              }}
                            >
                              {stint.compound} ({stint.lap_end - stint.lap_start + 1} laps)
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Sector times if available */}
                    {driverLaps.some(l => l.sector1_seconds > 0) && (
                      <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: darkMode ? '1px solid #444' : '1px solid #e0e0e0' }}>
                        <strong style={{ color: '#666', fontSize: '14px' }}>Best Sectors:</strong>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '8px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}>S1</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: darkMode ? '#fff' : '#333' }}>
                              {formatLapTime(Math.min(...driverLaps.filter(l => l.sector1_seconds > 0).map(l => l.sector1_seconds)))}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#22c55e', fontSize: '12px', fontWeight: 'bold' }}>S2</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: darkMode ? '#fff' : '#333' }}>
                              {formatLapTime(Math.min(...driverLaps.filter(l => l.sector2_seconds > 0).map(l => l.sector2_seconds)))}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#8b5cf6', fontSize: '12px', fontWeight: 'bold' }}>S3</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: darkMode ? '#fff' : '#333' }}>
                              {formatLapTime(Math.min(...driverLaps.filter(l => l.sector3_seconds > 0).map(l => l.sector3_seconds)))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}

export default App