import axios from 'axios';

const BASE_URL = 'https://api.openf1.org/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// Helper function to format dates for API
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Get team color mapping
const getTeamColor = (teamName) => {
  const colors = {
    'Red Bull Racing': '#0600EF',
    'Mercedes': '#00D2BE',
    'Ferrari': '#DC143C',
    'McLaren': '#FF8700',
    'Alpine': '#0090FF',
    'Alfa Romeo': '#900000',
    'Haas F1 Team': '#FFFFFF',
    'AlphaTauri': '#2B4562',
    'Williams': '#005AFF',
    'Aston Martin': '#006F62',
  };
  return colors[teamName] || '#888888';
};

export const openf1Api = {
  // Get meetings (races)
  getMeetings: async (year = null) => {
    try {
      const params = {};
      if (year) params.year = year;
      
      const response = await api.get('/meetings', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching meetings:', error);
      throw error;
    }
  },

  // Get sessions for a meeting
  getSessions: async (meetingKey = null, year = null) => {
    try {
      const params = {};
      if (meetingKey) params.meeting_key = meetingKey;
      if (year) params.year = year;
      
      const response = await api.get('/sessions', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }
  },

  // Get drivers for a session
  getDrivers: async (sessionKey = null) => {
    try {
      const params = {};
      if (sessionKey) params.session_key = sessionKey;
      
      const response = await api.get('/drivers', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching drivers:', error);
      throw error;
    }
  },

  // Get car data
  getCarData: async (sessionKey, driverNumber = null) => {
    try {
      const params = { session_key: sessionKey };
      if (driverNumber) params.driver_number = driverNumber;
      
      const response = await api.get('/car_data', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching car data:', error);
      throw error;
    }
  },

  // Get lap data
  getLaps: async (sessionKey, driverNumber = null) => {
    try {
      const params = { session_key: sessionKey };
      if (driverNumber) params.driver_number = driverNumber;
      
      const response = await api.get('/laps', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching laps:', error);
      throw error;
    }
  },

  // Get position data
  getPositions: async (sessionKey, driverNumber = null) => {
    try {
      const params = { session_key: sessionKey };
      if (driverNumber) params.driver_number = driverNumber;
      
      const response = await api.get('/position', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  },

  // Get intervals
  getIntervals: async (sessionKey) => {
    try {
      const params = { session_key: sessionKey };
      
      const response = await api.get('/intervals', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching intervals:', error);
      throw error;
    }
  },

  // Get location data
  getLocation: async (sessionKey, driverNumber = null) => {
    try {
      const params = { session_key: sessionKey };
      if (driverNumber) params.driver_number = driverNumber;
      
      const response = await api.get('/location', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching location:', error);
      throw error;
    }
  },

  // Get pit stops
  getPitStops: async (sessionKey, driverNumber = null) => {
    try {
      const params = { session_key: sessionKey };
      if (driverNumber) params.driver_number = driverNumber;
      
      const response = await api.get('/pit', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching pit stops:', error);
      throw error;
    }
  },

  // Get stints
  getStints: async (sessionKey, driverNumber = null) => {
    try {
      const params = { session_key: sessionKey };
      if (driverNumber) params.driver_number = driverNumber;
      
      const response = await api.get('/stints', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching stints:', error);
      throw error;
    }
  },

  // Get team radio
  getTeamRadio: async (sessionKey, driverNumber = null) => {
    try {
      const params = { session_key: sessionKey };
      if (driverNumber) params.driver_number = driverNumber;
      
      const response = await api.get('/team_radio', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching team radio:', error);
      throw error;
    }
  },

  // Get weather
  getWeather: async (sessionKey) => {
    try {
      const params = { session_key: sessionKey };
      
      const response = await api.get('/weather', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching weather:', error);
      throw error;
    }
  },

  // Get race control messages
  getRaceControl: async (sessionKey) => {
    try {
      const params = { session_key: sessionKey };
      
      const response = await api.get('/race_control', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching race control:', error);
      throw error;
    }
  },

  // Utility functions
  getTeamColor,
  formatDate,
}; 