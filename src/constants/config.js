// Check if we have a cache API URL configured, otherwise use direct API
const CACHE_API_URL = import.meta.env.VITE_CACHE_API_URL;
const USE_CACHE_API = Boolean(CACHE_API_URL);

export const API_CONFIG = {
  // Use cached API if configured, otherwise direct OpenF1 API
  BASE_URL: CACHE_API_URL || 'https://api.openf1.org/v1',
  // Store direct API URL for reference
  DIRECT_API_URL: 'https://api.openf1.org/v1',
  // Cache API URL (if configured)
  CACHE_API_URL: CACHE_API_URL,
  // Whether we're using the cache API
  USE_CACHE_API,
  // Cache times - shorter when using cache API, longer for direct API
  CACHE_TIME: USE_CACHE_API ? 2 * 60 * 1000 : 10 * 60 * 1000, // 2min with cache, 10min direct
  STALE_TIME: USE_CACHE_API ? 1 * 60 * 1000 : 5 * 60 * 1000,   // 1min with cache, 5min direct
  // Enable cache headers inspection in development
  SHOW_CACHE_HEADERS: import.meta.env.DEV === true
}

// Log configuration on startup (development only)
if (import.meta.env.DEV) {
  console.log('🏁 F1 Dashboard API Configuration:', {
    baseUrl: API_CONFIG.BASE_URL,
    usingCacheApi: USE_CACHE_API,
    cacheApiUrl: CACHE_API_URL || 'Not configured',
    cacheTime: API_CONFIG.CACHE_TIME / 1000 + 's',
    staleTime: API_CONFIG.STALE_TIME / 1000 + 's'
  });
}

export const CHART_CONFIG = {
  TOOLTIP_ANIMATION_DURATION: 0,
  LINE_STROKE_WIDTH: 2,
  GRID_STROKE_DASH: '3 3',
}

export const LONG_RUN_CONFIG = {
  MIN_LAPS: 4, // Minimum laps for a stint to be considered a long run
}

export const EVENT_TYPES = [
  { value: 'Flag', label: 'Flags', icon: '🏁', color: '#fbbf24' },
  { value: 'SafetyCar', label: 'Safety Car', icon: '🚗', color: '#f97316' },
  { value: 'DRS', label: 'DRS', icon: '⚡', color: '#3b82f6' },
  { value: 'Penalty', label: 'Penalties', icon: '⚠️', color: '#ef4444' },
  { value: 'CarEvent', label: 'Car Events', icon: '🔧', color: '#8b5cf6' },
  { value: 'Other', label: 'Other', icon: '📢', color: '#6b7280' },
]