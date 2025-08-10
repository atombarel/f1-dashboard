export const API_CONFIG = {
  BASE_URL: '/api',
  CACHE_TIME: 10 * 60 * 1000, // 10 minutes
  STALE_TIME: 5 * 60 * 1000,  // 5 minutes
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