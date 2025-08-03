import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Timer, Trophy, TrendingUp, Gauge } from 'lucide-react'
import { formatLapTime, getTeamColor, getTireColor } from '../services/f1Api'

export function HeroLapTimeChart({ laps, stints, drivers, selectedDrivers = [] }) {
  const [hoveredLap, setHoveredLap] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  // Process lap data with tire information and relative times
  const processedLaps = useMemo(() => {
    if (!laps || !laps.length) return []

    const fastestLap = Math.min(...laps.map(l => l.lap_time_seconds))
    
    return laps.map(lap => {
      const stint = stints?.find(s => 
        lap.lap_number >= s.lap_start && 
        lap.lap_number <= s.lap_end && 
        s.driver_number === lap.driver_number
      )
      
      const driver = drivers?.find(d => d.driver_number === lap.driver_number)
      
      return {
        ...lap,
        tire_compound: stint?.compound || 'UNKNOWN',
        stint_number: stint?.stint_number || 0,
        tire_color: getTireColor(stint?.compound || 'UNKNOWN'),
        team_color: getTeamColor(driver?.team_name),
        driver_name: driver?.name_acronym || `#${lap.driver_number}`,
        relative_time: lap.lap_time_seconds - fastestLap, // Relative to fastest
        opacity: 1 - (stint ? (lap.lap_number - stint.lap_start) / Math.max(stint.lap_end - stint.lap_start, 1) * 0.4 : 0)
      }
    })
  }, [laps, stints, drivers])

  // Filter data based on selected drivers
  const filteredData = useMemo(() => {
    if (selectedDrivers.length === 0) return processedLaps
    return processedLaps.filter(lap => selectedDrivers.includes(lap.driver_number))
  }, [processedLaps, selectedDrivers])

  // Group by driver for multi-line rendering
  const driverGroups = useMemo(() => {
    return filteredData.reduce((acc, lap) => {
      if (!acc[lap.driver_number]) {
        acc[lap.driver_number] = []
      }
      acc[lap.driver_number].push(lap)
      return acc
    }, {})
  }, [filteredData])

  if (!laps || laps.length === 0) {
    return (
      <div className="hero-chart-container">
        <div className="flex items-center justify-center h-96 bg-slate-900/50 rounded-3xl backdrop-blur-xl border border-white/10">
          <div className="text-center">
            <Timer className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <p className="text-white/60 text-xl">No lap data available</p>
          </div>
        </div>
      </div>
    )
  }

  const fastestLap = Math.min(...laps.map(l => l.lap_time_seconds))
  const fastestDriver = drivers?.find(d => d.driver_number === 
    laps.find(l => l.lap_time_seconds === fastestLap)?.driver_number
  )

  // Enhanced Tire Compound Dot
  const TireCompoundDot = ({ cx, cy, payload, stroke }) => {
    return (
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: payload.opacity }}
        transition={{ duration: 0.3 }}
      >
        {/* Outer glow */}
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill={payload.tire_color}
          opacity={0.3}
          className="blur-sm"
        />
        {/* Main dot */}
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill={payload.tire_color}
          stroke={stroke}
          strokeWidth={2}
          className="drop-shadow-lg"
        />
        {/* Inner highlight */}
        <circle
          cx={cx - 1}
          cy={cy - 1}
          r={1.5}
          fill="white"
          opacity={0.7}
        />
      </motion.g>
    )
  }

  // Stunning Tooltip
  const EnhancedTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    const driver = drivers?.find(d => d.driver_number === data.driver_number)
    
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          className="relative"
        >
          {/* Glass morphism tooltip */}
          <div className="bg-black/80 backdrop-blur-2xl border border-white/20 rounded-2xl p-6 shadow-2xl">
            {/* Header with driver info */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-2xl"
                  style={{ backgroundColor: data.team_color }}
                >
                  {data.driver_name}
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl opacity-75 blur-lg animate-pulse" />
              </div>
              <div>
                <div className="text-white font-bold text-xl">
                  Lap {data.lap_number}
                </div>
                <div className="text-white/70 text-sm">
                  {driver?.team_name}
                </div>
              </div>
            </div>

            {/* Lap time showcase */}
            <div className="text-center mb-6">
              <div className="text-4xl font-mono font-black text-white mb-2">
                {formatLapTime(data.lap_time_seconds)}
              </div>
              <div className="text-lg text-red-400 font-semibold">
                +{data.relative_time.toFixed(3)}s from best
              </div>
            </div>

            {/* Tire info */}
            <div className="flex items-center justify-center gap-3 mb-4 p-3 bg-white/10 rounded-xl">
              <div 
                className="w-6 h-6 rounded-full border-2 border-white/50 shadow-lg"
                style={{ backgroundColor: data.tire_color }}
              />
              <span className="text-white font-bold text-lg">{data.tire_compound}</span>
              <div className="text-white/70 text-sm">
                Stint {data.stint_number}
              </div>
            </div>

            {/* Sector times if available */}
            {data.sector1_seconds > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
                <div className="text-center">
                  <div className="text-yellow-400 text-sm font-semibold mb-1">S1</div>
                  <div className="text-white font-mono text-sm">{formatLapTime(data.sector1_seconds)}</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 text-sm font-semibold mb-1">S2</div>
                  <div className="text-white font-mono text-sm">{formatLapTime(data.sector2_seconds)}</div>
                </div>
                <div className="text-center">
                  <div className="text-purple-400 text-sm font-semibold mb-1">S3</div>
                  <div className="text-white font-mono text-sm">{formatLapTime(data.sector3_seconds)}</div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <div className="hero-chart-container">
      {/* Hero Header */}
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-2xl">
                <Gauge className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -inset-2 bg-gradient-to-br from-red-500 to-orange-600 rounded-3xl blur-2xl opacity-50 animate-pulse" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white mb-2">
                LAP TIME ANALYSIS
              </h2>
              <p className="text-white/70 text-xl font-medium">
                Real-time performance with tire degradation visualization
              </p>
            </div>
          </div>

          {/* Fastest Lap Badge */}
          <motion.div 
            className="flex items-center gap-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-xl border border-yellow-500/30 rounded-2xl p-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
          >
            <Trophy className="w-8 h-8 text-yellow-400" />
            <div>
              <div className="text-yellow-400 font-bold text-sm tracking-wider">FASTEST LAP</div>
              <div className="text-white font-mono text-2xl font-black">
                {formatLapTime(fastestLap)}
              </div>
              <div className="text-white/70 text-sm">
                {fastestDriver?.name_acronym} - {fastestDriver?.team_name}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Main Chart */}
      <motion.div 
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-2xl border border-white/10 shadow-2xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.2 }}
      >
        {/* Background Effects */}
        <div className="absolute inset-0">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-blue-500/5" />
          
          {/* Track map watermark */}
          <div className="absolute bottom-4 right-4 opacity-5">
            <svg width="200" height="120" viewBox="0 0 200 120" className="text-white">
              <path 
                d="M20,60 Q50,20 100,40 Q150,60 180,30 Q190,50 170,80 Q120,100 80,90 Q40,80 20,60" 
                stroke="currentColor" 
                strokeWidth="3" 
                fill="none"
              />
            </svg>
          </div>
        </div>

        <div className="relative z-10 p-8">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData}>
                {/* Enhanced Grid */}
                <CartesianGrid 
                  strokeDasharray="2 8" 
                  stroke="#374151" 
                  opacity={0.3}
                  horizontal={true}
                  vertical={false}
                />
                
                {/* X Axis */}
                <XAxis 
                  dataKey="lap_number" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 14, fontWeight: 600 }}
                  tickLine={{ stroke: '#9CA3AF' }}
                  axisLine={{ stroke: '#9CA3AF', strokeWidth: 2 }}
                  label={{ 
                    value: 'LAP NUMBER', 
                    position: 'insideBottom', 
                    offset: -10, 
                    fill: '#9CA3AF',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.1em'
                  }}
                />
                
                {/* Y Axis with relative times */}
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 14, fontWeight: 600 }}
                  tickLine={{ stroke: '#9CA3AF' }}
                  axisLine={{ stroke: '#9CA3AF', strokeWidth: 2 }}
                  tickFormatter={(value) => `+${value.toFixed(2)}s`}
                  dataKey="relative_time"
                  label={{ 
                    value: 'GAP TO FASTEST', 
                    angle: -90, 
                    position: 'insideLeft', 
                    fill: '#9CA3AF',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.1em'
                  }}
                />

                {/* Reference line for fastest lap */}
                <ReferenceLine 
                  y={0} 
                  stroke="#EF4444" 
                  strokeWidth={2} 
                  strokeDasharray="5 5"
                  opacity={0.7}
                />

                <Tooltip 
                  content={<EnhancedTooltip />}
                  cursor={{
                    stroke: '#EF4444',
                    strokeWidth: 2,
                    strokeDasharray: '5 5',
                    opacity: 0.7
                  }}
                />

                {/* Animated Lines for each driver */}
                {Object.entries(driverGroups).map(([driverNum, driverLaps], index) => {
                  const driver = drivers?.find(d => d.driver_number === parseInt(driverNum))
                  const teamColor = getTeamColor(driver?.team_name)
                  
                  return (
                    <Line
                      key={driverNum}
                      data={driverLaps}
                      type="monotone"
                      dataKey="relative_time"
                      stroke={teamColor}
                      strokeWidth={4}
                      dot={({ cx, cy, payload }) => (
                        <TireCompoundDot 
                          cx={cx} 
                          cy={cy} 
                          payload={payload} 
                          stroke={teamColor}
                        />
                      )}
                      activeDot={{
                        r: 8,
                        stroke: teamColor,
                        strokeWidth: 3,
                        fill: 'white'
                      }}
                      connectNulls={false}
                      isAnimationActive={isLoaded}
                      animationDuration={2000 + index * 200}
                      animationEasing="ease-out"
                      style={{
                        filter: `drop-shadow(0 0 8px ${teamColor}40)`
                      }}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Legend Bar */}
        <div className="border-t border-white/10 bg-black/20 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-red-600 rounded-full shadow-lg"></div>
                <span className="text-white/80 font-medium">Soft</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-yellow-500 rounded-full shadow-lg"></div>
                <span className="text-white/80 font-medium">Medium</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-white rounded-full shadow-lg border border-gray-600"></div>
                <span className="text-white/80 font-medium">Hard</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="text-white/60">
                <span className="font-bold">{filteredData.length}</span> laps analyzed
              </div>
              <div className="text-white/60">
                <span className="font-bold">{Object.keys(driverGroups).length}</span> drivers
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}