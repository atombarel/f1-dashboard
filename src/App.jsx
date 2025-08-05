import React, { useState, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Hooks
import { useMeetings, useSessions, useDrivers } from './features/dashboard/hooks/useMeetings'
import { useLaps, useStints } from './features/laps/hooks/useLaps'
import { useRaceControl, usePitStops, usePositions } from './features/race/hooks/useRaceData'
import { useSessionResults, useStartingGrid } from './features/results/hooks/useSessionResults'
import { useSystemTheme } from './shared/hooks/useSystemTheme'

// Components
import { YearSelector } from './features/dashboard/components/YearSelector'
import { MeetingSelector } from './features/dashboard/components/MeetingSelector'
import { SessionSelector } from './features/dashboard/components/SessionSelector'
import { DriverSelector } from './features/drivers/components/DriverSelector'
import { LapTimeChart } from './features/laps/components/LapTimeChart'
import { SessionStats } from './features/laps/components/SessionStats'
import { LongRunAnalysis } from './features/analysis/components/LongRunAnalysis'
import { RaceEventsTimeline } from './features/race/components/RaceEventsTimeline'
import { RaceStrategyAnalysis } from './features/race/components/RaceStrategyAnalysis'
import { RaceStrategyDashboard } from './features/race/components/RaceStrategyDashboard'
import { PitStopAnalysis } from './features/race/components/PitStopAnalysis'
import { SessionResults } from './features/results/components/SessionResults'
import { ThemeToggle } from './shared/components/DarkModeToggle'

// Utils
import { getTeamColor } from './shared/utils/formatters'

// Constants
import { THEME_COLORS } from './constants/colors'
import { API_CONFIG, EVENT_TYPES } from './constants/config'

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: API_CONFIG.STALE_TIME,
      cacheTime: API_CONFIG.CACHE_TIME,
    },
  },
})

function Dashboard() {
  const [selectedYear, setSelectedYear] = useState('2025')
  const [selectedMeeting, setSelectedMeeting] = useState('')
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedDrivers, setSelectedDrivers] = useState([])
  const [eventFilters, setEventFilters] = useState(() => 
    Object.fromEntries(EVENT_TYPES.map(e => [e.value, true]))
  )

  const { isDarkMode, themeSource, setTheme } = useSystemTheme()
  const theme = isDarkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  // Data fetching hooks
  const { data: meetings } = useMeetings(selectedYear)
  const { data: sessions } = useSessions(selectedMeeting)
  const { data: drivers } = useDrivers(selectedSession)
  const { data: allLaps, isLoading: lapsLoading } = useLaps(selectedSession)
  const { data: stints } = useStints(selectedSession)
  const { data: raceControl } = useRaceControl(selectedSession)
  const { data: pitStops } = usePitStops(selectedSession)
  const { data: positions } = usePositions(selectedSession)
  const { data: sessionResults } = useSessionResults(selectedSession)
  const { data: startingGrid } = useStartingGrid(selectedSession)


  // Process chart data
  const chartData = useMemo(() => {
    if (!allLaps || allLaps.length === 0) return []
    
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

  // Process drivers with team colors
  const driversInSession = useMemo(() => {
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

  // Reset handlers
  const handleYearChange = (year) => {
    setSelectedYear(year)
    setSelectedMeeting('')
    setSelectedSession('')
    setSelectedDrivers([])
  }

  const handleMeetingChange = (meeting) => {
    setSelectedMeeting(meeting)
    setSelectedSession('')
    setSelectedDrivers([])
  }

  const handleSessionChange = (session) => {
    setSelectedSession(session)
    setSelectedDrivers([])
  }

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: theme.BACKGROUND, 
      minHeight: '100vh', 
      transition: 'background-color 0.3s' 
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            margin: 0, 
            color: theme.TEXT 
          }}>
            F1 Lap Time Analysis
          </h1>
          <ThemeToggle darkMode={isDarkMode} themeSource={themeSource} onThemeChange={setTheme} />
        </div>

        {/* Controls */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '15px', 
          marginBottom: '30px',
          backgroundColor: theme.BACKGROUND_SECONDARY,
          padding: '20px',
          borderRadius: '8px',
          boxShadow: isDarkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.3s'
        }}>
          <YearSelector 
            selectedYear={selectedYear} 
            onYearChange={handleYearChange} 
            darkMode={isDarkMode} 
          />
          <MeetingSelector 
            meetings={meetings} 
            selectedMeeting={selectedMeeting} 
            onMeetingChange={handleMeetingChange} 
            darkMode={isDarkMode} 
          />
          <SessionSelector 
            sessions={sessions} 
            selectedSession={selectedSession} 
            onSessionChange={handleSessionChange} 
            darkMode={isDarkMode} 
          />
        </div>

        {/* Session Results */}
        <SessionResults
          sessions={sessions}
          selectedSession={selectedSession}
          sessionResults={sessionResults}
          startingGrid={startingGrid}
          drivers={driversInSession}
          allLaps={allLaps}
          darkMode={isDarkMode}
          meetings={meetings}
          selectedMeeting={selectedMeeting}
        />

        {/* Driver Selection */}
        <DriverSelector
          drivers={driversInSession}
          selectedDrivers={selectedDrivers}
          onDriverSelect={setSelectedDrivers}
          darkMode={isDarkMode}
        />

        {/* Chart */}
        <div style={{
          backgroundColor: theme.BACKGROUND_SECONDARY,
          padding: '20px',
          borderRadius: '8px',
          boxShadow: isDarkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.3s',
          marginBottom: '30px'
        }}>
          <LapTimeChart
            chartData={chartData}
            drivers={driversToShow}
            isLoading={lapsLoading}
            selectedSession={selectedSession}
            darkMode={isDarkMode}
          />
          <SessionStats
            chartData={chartData}
            drivers={driversInSession}
            allLaps={allLaps}
            darkMode={isDarkMode}
          />
        </div>

        {/* Long Run Analysis for Practice Sessions */}
        <LongRunAnalysis
          sessions={sessions}
          selectedSession={selectedSession}
          stints={stints}
          allLaps={allLaps}
          drivers={driversInSession}
          selectedDrivers={selectedDrivers}
          darkMode={isDarkMode}
        />

        {/* Race Strategy Analysis for Race Sessions */}
        <RaceStrategyAnalysis
          sessions={sessions}
          selectedSession={selectedSession}
          pitStops={pitStops}
          stints={stints}
          allLaps={allLaps}
          drivers={driversInSession}
          positions={positions}
          darkMode={isDarkMode}
        />

        {/* Race Strategy Dashboard with Timeline and Position Chart */}
        <RaceStrategyDashboard
          sessions={sessions}
          selectedSession={selectedSession}
          sessionResults={sessionResults}
          pitStops={pitStops}
          stints={stints}
          allLaps={allLaps}
          drivers={driversInSession}
          positions={positions}
          darkMode={isDarkMode}
        />

        {/* Race Events and Pit Stop Analysis Side by Side */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '30px'
        }}>
          {/* Race Events Timeline for Race Sessions */}
          <RaceEventsTimeline
            sessions={sessions}
            selectedSession={selectedSession}
            raceControl={raceControl}
            eventFilters={eventFilters}
            setEventFilters={setEventFilters}
            darkMode={isDarkMode}
          />

          {/* Pit Stop Analysis for Race Sessions */}
          <PitStopAnalysis
            sessions={sessions}
            selectedSession={selectedSession}
            pitStops={pitStops}
            drivers={driversInSession}
            darkMode={isDarkMode}
          />
        </div>
      </div>
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