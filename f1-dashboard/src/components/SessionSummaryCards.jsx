import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Clock, Target, TrendingUp, Gauge, Wind, Users, Zap } from 'lucide-react'
import { formatLapTime, getTeamColor, getTireColor } from '../services/f1Api'

export function SessionSummaryCards({ laps, stints, drivers, weather }) {
  // Calculate session statistics
  const sessionStats = useMemo(() => {
    if (!laps || !laps.length) return null

    const fastestLap = Math.min(...laps.map(l => l.lap_time_seconds))
    const fastestLapData = laps.find(l => l.lap_time_seconds === fastestLap)
    const fastestDriver = drivers?.find(d => d.driver_number === fastestLapData?.driver_number)

    // Sector statistics
    const sectorsWithData = laps.filter(l => l.sector1_seconds > 0 && l.sector2_seconds > 0 && l.sector3_seconds > 0)
    const bestSectors = sectorsWithData.length > 0 ? {
      sector1: Math.min(...sectorsWithData.map(l => l.sector1_seconds)),
      sector2: Math.min(...sectorsWithData.map(l => l.sector2_seconds)),
      sector3: Math.min(...sectorsWithData.map(l => l.sector3_seconds)),
    } : null

    // Tire usage statistics
    const tireUsage = stints?.reduce((acc, stint) => {
      acc[stint.compound] = (acc[stint.compound] || 0) + (stint.lap_end - stint.lap_start + 1)
      return acc
    }, {}) || {}

    const totalStintLaps = Object.values(tireUsage).reduce((sum, laps) => sum + laps, 0)
    const tirePercentages = Object.entries(tireUsage).map(([compound, laps]) => ({
      compound,
      laps,
      percentage: (laps / totalStintLaps) * 100,
      color: getTireColor(compound)
    }))

    // Lap time distribution
    const lapTimes = laps.map(l => l.lap_time_seconds).sort((a, b) => a - b)
    const median = lapTimes[Math.floor(lapTimes.length / 2)]
    const q1 = lapTimes[Math.floor(lapTimes.length * 0.25)]
    const q3 = lapTimes[Math.floor(lapTimes.length * 0.75)]

    return {
      fastestLap,
      fastestDriver,
      bestSectors,
      tireUsage: tirePercentages,
      lapDistribution: { median, q1, q3 },
      totalLaps: laps.length,
      uniqueDrivers: new Set(laps.map(l => l.driver_number)).size
    }
  }, [laps, stints, drivers])

  if (!sessionStats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card h-64 flex items-center justify-center">
            <div className="text-white/40">No data available</div>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      id: 'fastest-lap',
      title: 'Fastest Lap',
      icon: Trophy,
      gradient: 'from-yellow-400 to-orange-600',
      bgGradient: 'from-yellow-500/10 to-orange-600/10',
      component: (
        <div className="text-center">
          {/* Driver avatar background */}
          <div className="relative mb-6">
            <div 
              className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-white font-black text-2xl shadow-2xl border-4 border-white/30"
              style={{ backgroundColor: getTeamColor(sessionStats.fastestDriver?.team_name) }}
            >
              {sessionStats.fastestDriver?.name_acronym || 'N/A'}
            </div>
            <div className="absolute -inset-2 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full blur-2xl opacity-30 animate-pulse" />
          </div>

          <div className="space-y-3">
            <div className="text-4xl font-mono font-black text-white">
              {formatLapTime(sessionStats.fastestLap)}
            </div>
            <div className="text-yellow-400 font-bold text-lg">
              {sessionStats.fastestDriver?.name_acronym || 'Unknown'}
            </div>
            <div className="text-white/70 text-sm">
              {sessionStats.fastestDriver?.team_name || 'Unknown Team'}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'best-sectors',
      title: 'Best Sectors',
      icon: Target,
      gradient: 'from-emerald-400 to-cyan-600',
      bgGradient: 'from-emerald-500/10 to-cyan-600/10',
      component: sessionStats.bestSectors ? (
        <div className="space-y-4">
          {['sector1', 'sector2', 'sector3'].map((sector, index) => {
            const colors = ['text-yellow-400', 'text-green-400', 'text-purple-400']
            const time = sessionStats.bestSectors[sector]
            
            return (
              <div key={sector} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${colors[index].replace('text-', 'bg-')}`} />
                  <span className="text-white/80 font-medium">S{index + 1}</span>
                </div>
                <div className={`font-mono font-bold ${colors[index]}`}>
                  {formatLapTime(time)}
                </div>
              </div>
            )
          })}
          
          <div className="pt-4 border-t border-white/20">
            <div className="text-center">
              <div className="text-white/60 text-sm mb-1">Theoretical Best</div>
              <div className="text-white font-mono font-bold text-lg">
                {formatLapTime(
                  sessionStats.bestSectors.sector1 + 
                  sessionStats.bestSectors.sector2 + 
                  sessionStats.bestSectors.sector3
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-white/60 text-center">
            <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <div>No sector data available</div>
          </div>
        </div>
      )
    },
    {
      id: 'tire-usage',
      title: 'Tire Strategy',
      icon: Gauge,
      gradient: 'from-purple-400 to-pink-600',
      bgGradient: 'from-purple-500/10 to-pink-600/10',
      component: (
        <div className="space-y-4">
          {sessionStats.tireUsage.map((tire, index) => (
            <motion.div 
              key={tire.compound}
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full shadow-lg border border-white/30"
                    style={{ backgroundColor: tire.color }}
                  />
                  <span className="text-white/80 font-medium text-sm">{tire.compound}</span>
                </div>
                <div className="text-white font-bold text-sm">{tire.laps} laps</div>
              </div>
              
              {/* Progress ring */}
              <div className="relative w-full h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full rounded-full"
                  style={{ backgroundColor: tire.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${tire.percentage}%` }}
                  transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                />
              </div>
              
              <div className="text-right">
                <span className="text-white/60 text-xs">{tire.percentage.toFixed(1)}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      )
    },
    {
      id: 'session-overview',
      title: 'Session Overview',
      icon: Users,
      gradient: 'from-blue-400 to-indigo-600',
      bgGradient: 'from-blue-500/10 to-indigo-600/10',
      component: (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-black text-white mb-1">
                {sessionStats.totalLaps}
              </div>
              <div className="text-white/60 text-xs font-semibold tracking-wider">
                TOTAL LAPS
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white mb-1">
                {sessionStats.uniqueDrivers}
              </div>
              <div className="text-white/60 text-xs font-semibold tracking-wider">
                DRIVERS
              </div>
            </div>
          </div>

          {/* Lap time distribution */}
          <div className="space-y-3">
            <div className="text-white/80 font-semibold text-sm">Lap Time Distribution</div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-xs">Q1</span>
                <span className="text-white font-mono text-sm">{formatLapTime(sessionStats.lapDistribution.q1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-xs">Median</span>
                <span className="text-white font-mono text-sm font-bold">{formatLapTime(sessionStats.lapDistribution.median)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-xs">Q3</span>
                <span className="text-white font-mono text-sm">{formatLapTime(sessionStats.lapDistribution.q3)}</span>
              </div>
            </div>
          </div>

          {/* Weather info if available */}
          {weather && (
            <div className="pt-4 border-t border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="w-4 h-4 text-blue-400" />
                <span className="text-white/80 text-sm font-semibold">Weather</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-white/60">Air: </span>
                  <span className="text-white font-bold">{weather.air_temperature}°C</span>
                </div>
                <div>
                  <span className="text-white/60">Track: </span>
                  <span className="text-white font-bold">{weather.track_temperature}°C</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="session-summary-cards">
      <motion.div 
        className="flex items-center gap-6 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -inset-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl blur-2xl opacity-50 animate-pulse" />
        </div>
        <div>
          <h2 className="text-4xl font-black text-white mb-2">
            SESSION INSIGHTS
          </h2>
          <p className="text-white/70 text-xl font-medium">
            Key performance metrics and race analytics
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            className="group relative"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              delay: index * 0.15, 
              duration: 0.6,
              type: "spring",
              stiffness: 100 
            }}
          >
            {/* Glass morphism card */}
            <div className="relative overflow-hidden rounded-3xl backdrop-blur-2xl bg-black/40 border border-white/10 p-8 h-80 hover:border-white/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/50">
              
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-50 group-hover:opacity-75 transition-opacity duration-500`} />
              
              {/* Animated border */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
                   style={{ animation: 'shimmer 2s infinite' }} />
              
              {/* Content */}
              <div className="relative z-10 h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-2xl`}>
                    <card.icon className="w-7 h-7 text-white drop-shadow-lg" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg tracking-tight">
                      {card.title}
                    </h3>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  {card.component}
                </div>
              </div>

              {/* Corner accent */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/10 to-transparent rounded-bl-full" />
              
              {/* Bottom glow */}
              <div className={`absolute -bottom-1 left-4 right-4 h-2 bg-gradient-to-r ${card.gradient} rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 blur-sm`} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}