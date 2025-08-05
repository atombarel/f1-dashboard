import axios from 'axios'
import { API_CONFIG } from '../constants/config'

/**
 * Axios instance configured for OpenF1 API
 */
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 15000,
})

/**
 * F1 API service containing all endpoints for fetching Formula 1 data
 */
export const f1Api = {
  /**
   * Get meetings (races) for a specific year, excluding testing sessions
   * @param {number} year - The year to fetch meetings for (default: 2025)
   * @returns {Promise<Array>} Array of meeting objects
   */
  getMeetings: async (year = 2025) => {
    try {
      const response = await api.get('/meetings', { params: { year } })
      return response.data.filter(meeting => 
        !meeting.meeting_name.includes('Testing') && 
        !meeting.meeting_name.includes('Pre-Season')
      )
    } catch (error) {
      console.error('Error fetching meetings:', error)
      throw error
    }
  },

  // Get sessions for a meeting
  getSessions: async (meetingKey) => {
    try {
      const response = await api.get('/sessions', { params: { meeting_key: meetingKey } })
      return response.data.sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
    } catch (error) {
      console.error('Error fetching sessions:', error)
      throw error
    }
  },

  // Get drivers for a session
  getDrivers: async (sessionKey) => {
    try {
      const response = await api.get('/drivers', { params: { session_key: sessionKey } })
      return response.data.sort((a, b) => a.driver_number - b.driver_number)
    } catch (error) {
      console.error('Error fetching drivers:', error)
      throw error
    }
  },

  // Get lap data for analysis
  getLaps: async (sessionKey, driverNumber = null) => {
    try {
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
    } catch (error) {
      console.error('Error fetching laps:', error)
      throw error
    }
  },

  // Get stint data
  getStints: async (sessionKey, driverNumber = null) => {
    try {
      const params = { session_key: sessionKey }
      if (driverNumber) params.driver_number = driverNumber
      
      const response = await api.get('/stints', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching stints:', error)
      throw error
    }
  },

  // Get weather data
  getWeather: async (sessionKey) => {
    try {
      const response = await api.get('/weather', { params: { session_key: sessionKey } })
      return response.data[0] || null
    } catch (error) {
      console.error('Error fetching weather:', error)
      return null
    }
  },

  // Get pit stops
  getPitStops: async (sessionKey, driverNumber = null) => {
    try {
      const params = { session_key: sessionKey }
      if (driverNumber) params.driver_number = driverNumber
      
      const response = await api.get('/pit', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching pit stops:', error)
      throw error
    }
  },

  // Get race control messages (flags, safety car, penalties, etc)
  getRaceControl: async (sessionKey) => {
    try {
      const response = await api.get('/race_control', { params: { session_key: sessionKey } })
      return response.data.sort((a, b) => new Date(a.date) - new Date(b.date))
    } catch (error) {
      console.error('Error fetching race control:', error)
      throw error
    }
  },

  // Get position data for race
  getPositions: async (sessionKey) => {
    try {
      const response = await api.get('/position', { params: { session_key: sessionKey } })
      return response.data
    } catch (error) {
      console.error('Error fetching positions:', error)
      throw error
    }
  },

  // Get intervals data (gaps between drivers)
  getIntervals: async (sessionKey) => {
    try {
      const response = await api.get('/intervals', { params: { session_key: sessionKey } })
      return response.data
    } catch (error) {
      console.error('Error fetching intervals:', error)
      throw error
    }
  },

  // Get session results (final standings)
  getSessionResults: async (sessionKey) => {
    try {
      const response = await api.get('/session_result', { params: { session_key: sessionKey } })
      return response.data.sort((a, b) => a.position - b.position)
    } catch (error) {
      console.error('Error fetching session results:', error)
      throw error
    }
  },

  // Get starting grid
  getStartingGrid: async (sessionKey) => {
    try {
      const response = await api.get('/starting_grid', { params: { session_key: sessionKey } })
      return response.data.sort((a, b) => a.position - b.position)
    } catch (error) {
      console.error('Error fetching starting grid:', error)
      throw error
    }
  }
}

/**
 * Filter out outlier lap times using statistical methods (IQR)
 * Removes pit stops, safety car laps, and other anomalous times
 * @param {Array} laps - Array of lap objects with lap_time_seconds property
 * @returns {Array} Filtered array of laps with outliers removed
 */
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
  
  
  return finalFiltered
}

