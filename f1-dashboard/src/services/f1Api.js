import axios from 'axios'

const api = axios.create({
  baseURL: 'https://api.openf1.org/v1',
  timeout: 15000,
})

export const f1Api = {
  // Get meetings (races) for a specific year
  getMeetings: async (year = 2025) => {
    const response = await api.get('/meetings', { params: { year } })
    return response.data.filter(meeting => 
      !meeting.meeting_name.includes('Testing') && 
      !meeting.meeting_name.includes('Pre-Season')
    )
  },

  // Get sessions for a meeting
  getSessions: async (meetingKey) => {
    const response = await api.get('/sessions', { params: { meeting_key: meetingKey } })
    return response.data.sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
  },

  // Get drivers for a session
  getDrivers: async (sessionKey) => {
    const response = await api.get('/drivers', { params: { session_key: sessionKey } })
    return response.data.sort((a, b) => a.driver_number - b.driver_number)
  },

  // Get lap data for analysis
  getLaps: async (sessionKey, driverNumber = null) => {
    const params = { session_key: sessionKey }
    if (driverNumber) params.driver_number = driverNumber
    
    const response = await api.get('/laps', { params })
    const laps = response.data.filter(lap => lap.lap_duration).map(lap => ({
      ...lap,
      lap_time_seconds: parseFloat(lap.lap_duration),
      sector1_seconds: parseFloat(lap.duration_sector_1) || 0,
      sector2_seconds: parseFloat(lap.duration_sector_2) || 0,
      sector3_seconds: parseFloat(lap.duration_sector_3) || 0,
    }))

    // Filter out outlier lap times (pit stops, safety cars, etc.)
    return filterOutlierLapTimes(laps)
  },

  // Get stint data
  getStints: async (sessionKey, driverNumber = null) => {
    const params = { session_key: sessionKey }
    if (driverNumber) params.driver_number = driverNumber
    
    const response = await api.get('/stints', { params })
    return response.data
  },

  // Get weather data
  getWeather: async (sessionKey) => {
    const response = await api.get('/weather', { params: { session_key: sessionKey } })
    return response.data[0] || null
  },

  // Get pit stops
  getPitStops: async (sessionKey, driverNumber = null) => {
    const params = { session_key: sessionKey }
    if (driverNumber) params.driver_number = driverNumber
    
    const response = await api.get('/pit', { params })
    return response.data
  },

  // Get race control messages (flags, safety car, penalties, etc)
  getRaceControl: async (sessionKey) => {
    const response = await api.get('/race_control', { params: { session_key: sessionKey } })
    return response.data.sort((a, b) => new Date(a.date) - new Date(b.date))
  },

  // Get position data for race
  getPositions: async (sessionKey) => {
    const response = await api.get('/position', { params: { session_key: sessionKey } })
    return response.data
  },

  // Get intervals data (gaps between drivers)
  getIntervals: async (sessionKey) => {
    const response = await api.get('/intervals', { params: { session_key: sessionKey } })
    return response.data
  }
}

// Filter out outlier lap times (pit stops, safety cars, etc.)
const filterOutlierLapTimes = (laps) => {
  if (laps.length === 0) return laps
  
  // First, remove extremely unrealistic lap times (>3 minutes = 180 seconds)
  let filteredLaps = laps.filter(lap => lap.lap_time_seconds < 180)
  
  if (filteredLaps.length === 0) return laps // Fallback if all laps are filtered
  
  // Calculate median lap time for reference
  const sortedTimes = filteredLaps.map(lap => lap.lap_time_seconds).sort((a, b) => a - b)
  const median = sortedTimes[Math.floor(sortedTimes.length / 2)]
  
  // Calculate Q1 and Q3 for IQR method
  const q1Index = Math.floor(sortedTimes.length * 0.25)
  const q3Index = Math.floor(sortedTimes.length * 0.75)
  const q1 = sortedTimes[q1Index]
  const q3 = sortedTimes[q3Index]
  const iqr = q3 - q1
  
  // More aggressive filtering for outliers
  // Upper threshold: Q3 + 1.0 * IQR (more aggressive than 1.5)
  // Lower threshold: Q1 - 1.0 * IQR 
  const upperThreshold = Math.min(q3 + (1.0 * iqr), median * 1.3) // Cap at 130% of median
  const lowerThreshold = Math.max(q1 - (1.0 * iqr), median * 0.7) // Don't go below 70% of median
  
  const finalFiltered = filteredLaps.filter(lap => 
    lap.lap_time_seconds >= lowerThreshold && 
    lap.lap_time_seconds <= upperThreshold
  )
  
  // Debug logging
  console.log(`Filtering lap times: ${laps.length} -> ${finalFiltered.length}`)
  console.log(`Extreme filter removed: ${laps.length - filteredLaps.length} laps`)
  console.log(`Thresholds: ${lowerThreshold.toFixed(3)}s - ${upperThreshold.toFixed(3)}s`)
  console.log(`Median: ${median.toFixed(3)}s, Q1: ${q1.toFixed(3)}s, Q3: ${q3.toFixed(3)}s`)
  
  return finalFiltered
}

// Utility functions
export const formatLapTime = (seconds) => {
  if (!seconds || seconds <= 0) return '--:--.---'
  const minutes = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3)
  return `${minutes}:${secs.padStart(6, '0')}`
}

export const getTeamColor = (teamName) => {
  const teamColors = {
    'Red Bull Racing': '#0600ef',
    'Mercedes': '#00d2be',
    'Ferrari': '#dc143c',
    'McLaren': '#ff8700',
    'Alpine': '#0090ff',
    'Aston Martin': '#006f62',
    'Williams': '#005aff',
    'Haas F1 Team': '#787878',
    'AlphaTauri': '#2b4562',
    'Alfa Romeo': '#900000'
  }
  return teamColors[teamName] || '#888888'
}

export const getTireColor = (compound) => {
  const tireColors = {
    'SOFT': '#dc2626',     // Red with better contrast
    'MEDIUM': '#f59e0b',    // Amber/Orange for better visibility than yellow
    'HARD': '#6b7280',      // Gray instead of white for better contrast
    'INTERMEDIATE': '#10b981',  // Green
    'WET': '#3b82f6'        // Blue
  }
  return tireColors[compound] || '#888888'
}