import { TIRE_COLORS, TEAM_COLORS } from '../../constants/colors'

export function formatLapTime(seconds) {
  if (!seconds || seconds <= 0) return '--'
  
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  
  if (minutes > 0) {
    return `${minutes}:${secs.toFixed(3).padStart(6, '0')}`
  } else {
    return `${secs.toFixed(3)}s`
  }
}

export function getTeamColor(teamName) {
  if (!teamName) return '#cccccc'
  
  const normalizedTeam = teamName.toLowerCase().replace(/\s+/g, '_')
  return TEAM_COLORS[normalizedTeam] || '#cccccc'
}

export function getTireColor(compound) {
  if (!compound) return '#cccccc'
  
  const normalizedCompound = compound.toUpperCase()
  return TIRE_COLORS[normalizedCompound] || '#cccccc'
}