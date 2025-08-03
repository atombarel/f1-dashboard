import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Flag, Zap, TrendingDown, TrendingUp } from 'lucide-react'
import { formatLapTime, getTeamColor, getTireColor } from '../services/f1Api'

export function TireStrategyTimeline({ laps, stints, drivers, selectedDrivers = [] }) {
  const [hoveredStint, setHoveredStint] = useState(null)

  // Process stint data with enhanced analytics
  const processedStints = useMemo(() => {
    if (!stints || !stints.length || !laps || !laps.length) return []

    return stints.map(stint => {
      const driver = drivers?.find(d => d.driver_number === stint.driver_number)
      const stintLaps = laps.filter(lap => 
        lap.driver_number === stint.driver_number &&
        lap.lap_number >= stint.lap_start &&
        lap.lap_number <= stint.lap_end
      )

      const avgLapTime = stintLaps.length > 0 
        ? stintLaps.reduce((sum, lap) => sum + lap.lap_time_seconds, 0) / stintLaps.length
        : 0

      const firstLap = stintLaps[0]
      const lastLap = stintLaps[stintLaps.length - 1]
      const degradation = lastLap && firstLap ? lastLap.lap_time_seconds - firstLap.lap_time_seconds : 0

      return {
        ...stint,
        driver_name: driver?.name_acronym || `#${stint.driver_number}`,
        team_name: driver?.team_name,
        team_color: getTeamColor(driver?.team_name),
        tire_color: getTireColor(stint.compound),
        stint_length: stint.lap_end - stint.lap_start + 1,
        avg_lap_time: avgLapTime,
        degradation,
        laps: stintLaps
      }
    })
  }, [stints, laps, drivers])

  // Filter by selected drivers
  const filteredStints = useMemo(() => {
    if (selectedDrivers.length === 0) return processedStints
    return processedStints.filter(stint => selectedDrivers.includes(stint.driver_number))
  }, [processedStints, selectedDrivers])

  // Group stints by driver
  const driverStints = useMemo(() => {
    const grouped = filteredStints.reduce((acc, stint) => {
      if (!acc[stint.driver_number]) {
        acc[stint.driver_number] = []
      }
      acc[stint.driver_number].push(stint)
      return acc
    }, {})

    // Sort drivers by their final position or driver number
    return Object.entries(grouped).sort(([a], [b]) => parseInt(a) - parseInt(b))
  }, [filteredStints])

  if (!stints || stints.length === 0) {
    return (
      <div className="tire-strategy-container">
        <div className="flex items-center justify-center h-64 bg-slate-900/50 rounded-3xl backdrop-blur-xl border border-white/10">
          <div className="text-center">
            <Clock className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <p className="text-white/60 text-xl">No stint data available</p>
          </div>
        </div>
      </div>
    )
  }

  const totalLaps = Math.max(...stints.map(s => s.lap_end))

  return (
    <div className="tire-strategy-container space-y-8">
      {/* Header */}
      <motion.div 
        className="flex items-center gap-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl flex items-center justify-center shadow-2xl">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -inset-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl blur-2xl opacity-50 animate-pulse" />
        </div>
        <div>
          <h2 className="text-4xl font-black text-white mb-2">
            TIRE STRATEGY TIMELINE
          </h2>
          <p className="text-white/70 text-xl font-medium">
            Race strategy visualization with stint performance analysis
          </p>
        </div>
      </motion.div>

      {/* Timeline Container */}
      <motion.div 
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-2xl border border-white/10 shadow-2xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.2 }}
      >
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-orange-500/5" />
        </div>

        <div className="relative z-10 p-8">
          {/* Lap Number Scale */}
          <div className="flex justify-between items-center mb-8 px-4">
            <div className="text-white/60 font-bold text-sm tracking-wider">LAP</div>
            {Array.from({ length: Math.ceil(totalLaps / 10) }, (_, i) => (i + 1) * 10).map(lapNum => (
              <div key={lapNum} className="text-white/60 font-mono text-sm">
                {lapNum <= totalLaps ? lapNum : totalLaps}
              </div>
            ))}
          </div>

          {/* Driver Timeline Rows */}
          <div className="space-y-6">
            {driverStints.map(([driverNumber, stints], driverIndex) => {
              const driver = drivers?.find(d => d.driver_number === parseInt(driverNumber))
              
              return (
                <motion.div 
                  key={driverNumber}
                  className="relative"
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: driverIndex * 0.1, duration: 0.6 }}
                >
                  {/* Driver Info */}
                  <div className="flex items-center gap-4 mb-4">
                    <div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-2xl border-2 border-white/20"
                      style={{ backgroundColor: getTeamColor(driver?.team_name) }}
                    >
                      {driver?.name_acronym || `#${driverNumber}`}
                    </div>
                    <div>
                      <div className="text-white font-bold text-lg">
                        {driver?.name_acronym || `Driver #${driverNumber}`}
                      </div>
                      <div className="text-white/70 text-sm">
                        {driver?.team_name}
                      </div>
                    </div>
                  </div>

                  {/* Timeline Track */}
                  <div className="relative h-16 bg-black/30 rounded-2xl border border-white/10 overflow-hidden">
                    {/* Background grid */}
                    <div className="absolute inset-0">
                      {Array.from({ length: Math.ceil(totalLaps / 5) }, (_, i) => (
                        <div 
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-white/10"
                          style={{ left: `${(i * 5 / totalLaps) * 100}%` }}
                        />
                      ))}
                    </div>

                    {/* Stint Segments */}
                    {stints.map((stint, stintIndex) => {
                      const stintWidth = (stint.stint_length / totalLaps) * 100
                      const stintLeft = ((stint.lap_start - 1) / totalLaps) * 100

                      return (
                        <motion.div
                          key={`${stint.driver_number}-${stint.stint_number}`}
                          className="absolute top-2 bottom-2 rounded-xl overflow-hidden cursor-pointer group"
                          style={{
                            left: `${stintLeft}%`,
                            width: `${stintWidth}%`,
                            background: `linear-gradient(135deg, ${stint.tire_color} 0%, ${stint.tire_color}CC 100%)`,
                            border: `2px solid ${stint.tire_color}`,
                            boxShadow: `0 0 20px ${stint.tire_color}40`
                          }}
                          initial={{ scaleX: 0, opacity: 0 }}
                          animate={{ scaleX: 1, opacity: 1 }}
                          transition={{ 
                            delay: driverIndex * 0.1 + stintIndex * 0.2, 
                            duration: 0.8,
                            ease: "easeOut"
                          }}
                          onMouseEnter={() => setHoveredStint(stint)}
                          onMouseLeave={() => setHoveredStint(null)}
                          whileHover={{ scale: 1.05, y: -2 }}
                        >
                          {/* Stint inner effects */}
                          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          
                          {/* Stint info overlay */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-white font-black text-sm drop-shadow-lg">
                                {stint.compound}
                              </div>
                              <div className="text-white/90 font-bold text-xs drop-shadow-lg">
                                {stint.stint_length} laps
                              </div>
                            </div>
                          </div>

                          {/* Pit stop markers */}
                          {stintIndex < stints.length - 1 && (
                            <div className="absolute -right-3 top-1/2 transform -translate-y-1/2">
                              <motion.div 
                                className="w-6 h-6 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: driverIndex * 0.1 + stintIndex * 0.2 + 0.8 }}
                              >
                                <Zap className="w-3 h-3 text-white" />
                              </motion.div>
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Legend and Stats */}
        <div className="border-t border-white/10 bg-black/20 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-red-600 rounded-lg shadow-lg"></div>
                <span className="text-white/80 font-medium">Soft Compound</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-yellow-500 rounded-lg shadow-lg"></div>
                <span className="text-white/80 font-medium">Medium Compound</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-white rounded-lg shadow-lg border border-gray-600"></div>
                <span className="text-white/80 font-medium">Hard Compound</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-orange-600 rounded-full shadow-lg">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/80 font-medium">Pit Stop</span>
              </div>
            </div>
            
            <div className="text-white/60 text-sm">
              {totalLaps} total laps • {driverStints.length} drivers
            </div>
          </div>
        </div>
      </motion.div>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {hoveredStint && (
          <motion.div
            className="fixed z-50 pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="bg-black/90 backdrop-blur-2xl border border-white/20 rounded-2xl p-6 shadow-2xl">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div 
                    className="w-8 h-8 rounded-lg shadow-lg"
                    style={{ backgroundColor: hoveredStint.tire_color }}
                  />
                  <div>
                    <div className="text-white font-bold text-xl">
                      {hoveredStint.compound} Stint {hoveredStint.stint_number}
                    </div>
                    <div className="text-white/70 text-sm">
                      {hoveredStint.driver_name} • {hoveredStint.team_name}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 text-center">
                  <div>
                    <div className="text-white/60 text-sm font-semibold mb-1">STINT LENGTH</div>
                    <div className="text-white font-bold text-lg">{hoveredStint.stint_length} laps</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-sm font-semibold mb-1">AVG LAP TIME</div>
                    <div className="text-white font-mono font-bold text-lg">
                      {formatLapTime(hoveredStint.avg_lap_time)}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-sm font-semibold mb-1">LAPS</div>
                    <div className="text-white font-bold text-lg">
                      {hoveredStint.lap_start} - {hoveredStint.lap_end}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-sm font-semibold mb-1">DEGRADATION</div>
                    <div className={`font-bold text-lg flex items-center justify-center gap-1 ${
                      hoveredStint.degradation > 0 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {hoveredStint.degradation > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {hoveredStint.degradation > 0 ? '+' : ''}{hoveredStint.degradation.toFixed(2)}s
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}