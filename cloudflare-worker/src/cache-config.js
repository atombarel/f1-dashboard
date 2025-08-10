/**
 * Cache configuration for F1 API endpoints based on data immutability
 * TTL values are in seconds
 * 
 * F1 Data Lifecycle:
 * - Past seasons: NEVER change (permanent cache)
 * - Current season meetings: May change until season ends
 * - Completed sessions: NEVER change (permanent cache) 
 * - Ongoing sessions: Change frequently (short cache)
 */
export const CACHE_CONFIG = {
  // Year-based data - permanent for past seasons, daily refresh for current
  meetings: {
    pastSeason: 365 * 24 * 60 * 60, // 1 year for completed seasons
    currentSeason: 24 * 60 * 60, // 1 day for current season
    cacheLevel: 'seasonal',
    description: 'Race meetings for a year'
  },
  
  // Session-based data - permanent for past sessions, hourly for current session
  sessions: {
    completed: 365 * 24 * 60 * 60, // 1 year for completed meetings
    current: 60 * 60, // 1 hour for current meeting
    cacheLevel: 'meeting',
    description: 'Sessions for a meeting'
  },
  
  drivers: {
    completed: 365 * 24 * 60 * 60, // 1 year for completed sessions
    current: 60 * 60, // 1 hour for current session
    cacheLevel: 'session',
    description: 'Driver data for session'
  },
  
  // Session results - NEVER change once session is complete
  laps: {
    completed: 365 * 24 * 60 * 60, // 1 year - permanent for completed sessions
    ongoing: 2 * 60, // 2 minutes for ongoing sessions
    cacheLevel: 'immutable',
    description: 'Lap times and data'
  },
  
  stints: {
    completed: 365 * 24 * 60 * 60, // 1 year - permanent for completed sessions
    ongoing: 2 * 60, // 2 minutes for ongoing sessions
    cacheLevel: 'immutable',
    description: 'Tire stint data'
  },
  
  session_result: {
    completed: 365 * 24 * 60 * 60, // 1 year - permanent once session complete
    ongoing: 5 * 60, // 5 minutes for ongoing sessions
    cacheLevel: 'immutable',
    description: 'Final session results'
  },
  
  starting_grid: {
    completed: 365 * 24 * 60 * 60, // 1 year - permanent once qualifying complete
    ongoing: 5 * 60, // 5 minutes for ongoing qualifying
    cacheLevel: 'immutable',
    description: 'Starting grid positions'
  },
  
  race_control: {
    completed: 365 * 24 * 60 * 60, // 1 year - permanent once session complete
    ongoing: 30, // 30 seconds for ongoing sessions
    cacheLevel: 'immutable',
    description: 'Race control messages'
  },
  
  pit: {
    completed: 365 * 24 * 60 * 60, // 1 year - permanent once session complete
    ongoing: 60, // 1 minute for ongoing sessions
    cacheLevel: 'immutable',
    description: 'Pit stop data'
  },
  
  position: {
    completed: 365 * 24 * 60 * 60, // 1 year - permanent once session complete
    ongoing: 30, // 30 seconds for ongoing sessions
    cacheLevel: 'immutable',
    description: 'Position data during race'
  },
  
  intervals: {
    completed: 365 * 24 * 60 * 60, // 1 year - permanent once session complete
    ongoing: 30, // 30 seconds for ongoing sessions
    cacheLevel: 'immutable',
    description: 'Time intervals between drivers'
  },
  
  weather: {
    completed: 365 * 24 * 60 * 60, // 1 year - permanent once session complete
    ongoing: 5 * 60, // 5 minutes for ongoing sessions
    cacheLevel: 'immutable',
    description: 'Weather conditions'
  }
};

/**
 * Cache levels determine which caching strategies to use
 */
export const CACHE_LEVELS = {
  // For data that changes based on season (meetings)
  seasonal: {
    useLocal: true,
    localTtl: 4 * 60 * 60, // 4 hours local cache
    useD1: true,
    backgroundRefresh: true,
    permanent: false
  },
  
  // For data that changes based on meeting (sessions)
  meeting: {
    useLocal: true,
    localTtl: 2 * 60 * 60, // 2 hours local cache
    useD1: true,
    backgroundRefresh: false,
    permanent: false
  },
  
  // For data that changes based on session (drivers)
  session: {
    useLocal: true,
    localTtl: 60 * 60, // 1 hour local cache
    useD1: true,
    backgroundRefresh: false,
    permanent: false
  },
  
  // For data that NEVER changes once finalized (most session data)
  immutable: {
    useLocal: true,
    localTtl: 24 * 60 * 60, // 24 hours local cache (can be aggressive)
    useD1: true,
    backgroundRefresh: false,
    permanent: true // This data never expires once cached as completed
  }
};

/**
 * Determine if a year/season is completed (not current year)
 */
export function isSeasonCompleted(year) {
  const currentYear = new Date().getFullYear();
  return parseInt(year) < currentYear;
}

/**
 * Determine if a meeting is completed based on current time
 * A meeting is considered completed if the last session ended more than 6 hours ago
 */
export function isMeetingCompleted(meetingData, sessionsData = null) {
  if (!meetingData || !meetingData.date_end) return false;
  
  // If we have sessions data, use the latest session end time
  if (sessionsData && sessionsData.length > 0) {
    const latestSession = sessionsData
      .filter(s => s.date_end)
      .sort((a, b) => new Date(b.date_end) - new Date(a.date_end))[0];
    
    if (latestSession) {
      const sessionEnd = new Date(latestSession.date_end);
      const now = new Date();
      return (now - sessionEnd) > (6 * 60 * 60 * 1000); // 6 hours
    }
  }
  
  // Fallback to meeting end date
  const meetingEnd = new Date(meetingData.date_end);
  const now = new Date();
  return (now - meetingEnd) > (6 * 60 * 60 * 1000); // 6 hours
}

/**
 * Determine if a session is completed based on current time
 * A session is considered completed if it ended more than 3 hours ago
 */
export function isSessionCompleted(sessionData) {
  if (!sessionData || !sessionData.date_end) return false;
  
  const sessionEnd = new Date(sessionData.date_end);
  const now = new Date();
  
  // Consider session completed if it ended more than 3 hours ago
  return (now - sessionEnd) > (3 * 60 * 60 * 1000);
}

/**
 * Get cache TTL for an endpoint based on F1 data immutability rules
 */
export function getCacheTtl(endpoint, params = {}, contextData = {}) {
  const config = CACHE_CONFIG[endpoint];
  if (!config) return 5 * 60; // Default 5 minutes
  
  const { sessionData, meetingData, sessionsData } = contextData;
  
  switch (config.cacheLevel) {
    case 'seasonal':
      // Meetings: permanent for past seasons, daily for current
      const year = params.year || new Date().getFullYear();
      return isSeasonCompleted(year) ? config.pastSeason : config.currentSeason;
      
    case 'meeting':
      // Sessions: permanent for completed meetings, hourly for current
      const meetingCompleted = meetingData ? isMeetingCompleted(meetingData, sessionsData) : false;
      return meetingCompleted ? config.completed : config.current;
      
    case 'session':
      // Drivers: permanent for completed sessions, hourly for current
      const sessionCompleted = sessionData ? isSessionCompleted(sessionData) : false;
      return sessionCompleted ? config.completed : config.current;
      
    case 'immutable':
      // Most session data: permanent once completed, short-lived while ongoing
      const completed = sessionData ? isSessionCompleted(sessionData) : false;
      return completed ? config.completed : config.ongoing;
      
    default:
      return config.ttl || (5 * 60);
  }
}

/**
 * Check if data should be cached permanently (never expires)
 * This applies to completed F1 data that never changes
 */
export function isPermanentCache(endpoint, params = {}, contextData = {}) {
  const config = CACHE_CONFIG[endpoint];
  if (!config) return false;
  
  const level = CACHE_LEVELS[config.cacheLevel];
  if (!level || !level.permanent) return false;
  
  const { sessionData, meetingData, sessionsData } = contextData;
  
  switch (config.cacheLevel) {
    case 'seasonal':
      const year = params.year || new Date().getFullYear();
      return isSeasonCompleted(year);
      
    case 'meeting':
      return meetingData ? isMeetingCompleted(meetingData, sessionsData) : false;
      
    case 'session':
    case 'immutable':
      return sessionData ? isSessionCompleted(sessionData) : false;
      
    default:
      return false;
  }
}

/**
 * Generate cache key from endpoint and parameters
 */
export function generateCacheKey(endpoint, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  return `${endpoint}${sortedParams ? '?' + sortedParams : ''}`;
}

/**
 * Check if cache entry is expired
 */
export function isCacheExpired(cachedAt, ttl) {
  const expiresAt = new Date(cachedAt);
  expiresAt.setSeconds(expiresAt.getSeconds() + ttl);
  return new Date() > expiresAt;
}