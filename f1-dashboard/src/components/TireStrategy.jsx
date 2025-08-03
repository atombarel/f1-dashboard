import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { formatLapTime, getTeamColor, getTireColor } from '../services/f1Api'
import { Activity, Clock, Gauge, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export function TireStrategy({ laps = [], stints = [], drivers = [], selectedDrivers = [] }) {
  const analysis = useMemo(() => {
    if (!laps.length || !stints.length) return null

    // Process data with driver and tire information
    const processedStints = stints.map(stint => {
      const driver = drivers?.find(d => d.driver_number === stint.driver_number)
      const stintLaps = laps.filter(lap => 
        lap.lap_number >= stint.lap_start && 
        lap.lap_number <= stint.lap_end && 
        lap.driver_number === stint.driver_number
      ).filter(lap => !lap.is_pit_out_lap && !lap.is_pit_in_lap) // Exclude pit laps

      const avgLapTime = stintLaps.length > 0 
        ? stintLaps.reduce((sum, lap) => sum + lap.lap_time_seconds, 0) / stintLaps.length
        : 0

      const bestLapTime = stintLaps.length > 0 
        ? Math.min(...stintLaps.map(lap => lap.lap_time_seconds))
        : 0

      const degradation = stintLaps.length > 1 
        ? stintLaps[stintLaps.length - 1].lap_time_seconds - stintLaps[0].lap_time_seconds
        : 0

      return {
        ...stint,
        driver_name: driver?.name_acronym || `#${stint.driver_number}`,
        team_color: getTeamColor(driver?.team_name),
        tire_color: getTireColor(stint.compound),
        lap_count: stint.lap_end - stint.lap_start + 1,
        avg_lap_time: avgLapTime,
        best_lap_time: bestLapTime,
        degradation: degradation,
        stint_laps: stintLaps
      }
    })

    // Filter by selected drivers
    const filteredStints = selectedDrivers.length > 0 
      ? processedStints.filter(stint => selectedDrivers.includes(stint.driver_number))
      : processedStints

    // Analyze tire compounds
    const tireCompoundAnalysis = {}
    filteredStints.forEach(stint => {
      if (!tireCompoundAnalysis[stint.compound]) {
        tireCompoundAnalysis[stint.compound] = {
          compound: stint.compound,
          color: stint.tire_color,
          stints: [],
          avg_performance: 0,
          total_laps: 0,
          avg_degradation: 0
        }
      }
      tireCompoundAnalysis[stint.compound].stints.push(stint)
    })

    // Calculate tire performance metrics
    Object.values(tireCompoundAnalysis).forEach(tire => {
      tire.avg_performance = tire.stints.reduce((sum, stint) => sum + stint.avg_lap_time, 0) / tire.stints.length
      tire.total_laps = tire.stints.reduce((sum, stint) => sum + stint.lap_count, 0)
      tire.avg_degradation = tire.stints.reduce((sum, stint) => sum + stint.degradation, 0) / tire.stints.length
    })

    // Create stint timeline data
    const stintTimeline = filteredStints
      .sort((a, b) => a.lap_start - b.lap_start)
      .map(stint => ({
        ...stint,
        start: stint.lap_start,
        end: stint.lap_end,
        duration: stint.lap_count
      }))

    // Strategy effectiveness analysis
    const driverStrategies = {}
    filteredStints.forEach(stint => {
      if (!driverStrategies[stint.driver_number]) {
        driverStrategies[stint.driver_number] = {
          driver_number: stint.driver_number,
          driver_name: stint.driver_name,
          team_color: stint.team_color,
          stints: [],
          total_pit_stops: 0,
          strategy_effectiveness: 0
        }
      }
      driverStrategies[stint.driver_number].stints.push(stint)
    })

    Object.values(driverStrategies).forEach(strategy => {
      strategy.total_pit_stops = strategy.stints.length - 1
      strategy.strategy_effectiveness = strategy.stints.reduce((sum, stint) => sum + stint.avg_lap_time, 0) / strategy.stints.length
    })

    return {
      processedStints: filteredStints,
      tireCompoundAnalysis: Object.values(tireCompoundAnalysis),
      stintTimeline,
      driverStrategies: Object.values(driverStrategies)
    }
  }, [laps, stints, drivers, selectedDrivers])

  if (!analysis) {
    return (
      <Card className="bg-white border border-gray-200 shadow-lg">
        <div className="p-16 text-center">
          <Activity className="mx-auto w-20 h-20 text-slate-400 mb-8" />
          <h3 className="text-2xl font-semibold text-white mb-3">No tire strategy data available</h3>
          <p className="text-slate-300 text-lg">Complete stints with different tire compounds to analyze strategy</p>
        </div>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-lg p-4 shadow-xl text-white">
          <div className="font-semibold mb-2">{data.driver_name || data.compound}</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Avg Pace:</span>
              <span className="font-mono">{formatLapTime(data.avg_lap_time || data.avg_performance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Laps:</span>
              <span className="font-mono">{data.lap_count || data.total_laps}</span>
            </div>
            {data.degradation !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-400">Degradation:</span>
                <span className="font-mono">{data.degradation > 0 ? '+' : ''}{(data.degradation * 1000).toFixed(0)}ms</span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-12">
      {/* Strategy Overview */}
      <Card className="bg-white border border-gray-200 shadow-lg">
        <CardHeader className="pb-8">
          <div className="flex items-center">
            <div className="p-4 bg-red-500/20 rounded-xl mr-6">
              <Activity className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-3xl text-white mb-2">Tire Strategy Overview</CardTitle>
              <p className="text-slate-300 text-lg">Comprehensive analysis of tire compound usage and strategy effectiveness</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center p-8 bg-gradient-to-br from-blue-500/15 to-blue-600/10 border border-blue-500/30 rounded-xl">
              <div className="text-4xl font-bold text-blue-300 mb-3">{analysis.tireCompoundAnalysis.length}</div>
              <div className="text-base text-blue-200 font-medium">Compounds Used</div>
            </div>
            <div className="text-center p-8 bg-gradient-to-br from-green-500/15 to-green-600/10 border border-green-500/30 rounded-xl">
              <div className="text-4xl font-bold text-green-300 mb-3">{analysis.processedStints.length}</div>
              <div className="text-base text-green-200 font-medium">Total Stints</div>
            </div>
            <div className="text-center p-8 bg-gradient-to-br from-yellow-500/15 to-yellow-600/10 border border-yellow-500/30 rounded-xl">
              <div className="text-4xl font-bold text-yellow-300 mb-3">
                {analysis.driverStrategies.reduce((sum, s) => sum + s.total_pit_stops, 0)}
              </div>
              <div className="text-base text-yellow-200 font-medium">Pit Stops</div>
            </div>
            <div className="text-center p-8 bg-gradient-to-br from-purple-500/15 to-purple-600/10 border border-purple-500/30 rounded-xl">
              <div className="text-4xl font-bold text-purple-300 mb-3">
                {analysis.tireCompoundAnalysis.length > 0 ? formatLapTime(Math.min(...analysis.tireCompoundAnalysis.map(t => t.avg_performance))) : '--'}
              </div>
              <div className="text-base text-purple-200 font-medium">Best Avg Pace</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tire Compound Performance */}
        <Card className="bg-white border border-gray-200 shadow-lg">
          <CardHeader className="pb-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-500/20 rounded-lg mr-4">
                <Gauge className="w-6 h-6 text-blue-400" />
              </div>
              <CardTitle className="text-xl text-white">Compound Performance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.tireCompoundAnalysis} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                    <XAxis 
                      dataKey="compound" 
                      stroke="#CBD5E1"
                      tick={{ fill: '#CBD5E1', fontSize: 14 }}
                    />
                    <YAxis 
                      stroke="#CBD5E1"
                      tick={{ fill: '#CBD5E1', fontSize: 14 }}
                      tickFormatter={(value) => formatLapTime(value)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="avg_performance" 
                      fill="#3B82F6"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Strategy Comparison */}
        <Card className="bg-white border border-gray-200 shadow-lg">
          <CardHeader className="pb-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-500/20 rounded-lg mr-4">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <CardTitle className="text-xl text-white">Strategy Effectiveness</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.driverStrategies} layout="horizontal" margin={{ top: 20, right: 30, left: 50, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                    <XAxis 
                      type="number"
                      stroke="#CBD5E1"
                      tick={{ fill: '#CBD5E1', fontSize: 12 }}
                      tickFormatter={(value) => formatLapTime(value)}
                    />
                    <YAxis 
                      type="category"
                      dataKey="driver_name"
                      stroke="#CBD5E1"
                      tick={{ fill: '#CBD5E1', fontSize: 12 }}
                      width={40}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="strategy_effectiveness" 
                      fill="#10B981"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stint Timeline */}
      <Card className="bg-white border border-gray-200 shadow-lg">
        <CardHeader className="pb-8">
          <div className="flex items-center">
            <div className="p-4 bg-purple-500/20 rounded-xl mr-6">
              <Clock className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-2xl text-white mb-2">Stint Timeline</CardTitle>
              <p className="text-slate-300 text-lg">Chronological view of each driver's tire strategy progression</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {analysis.stintTimeline.map((stint, index) => (
              <div key={`${stint.driver_number}-${stint.stint_number}`} 
                   className="flex items-center p-6 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <div className="flex items-center space-x-6 flex-1">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold ring-2 ring-white/30"
                    style={{ backgroundColor: stint.team_color }}
                  >
                    {stint.driver_number}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white text-lg">{stint.driver_name}</div>
                    <div className="text-base text-slate-300">
                      Laps {stint.lap_start}-{stint.lap_end} ({stint.lap_count} laps)
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <Badge 
                      className="flex items-center gap-3 px-4 py-2 text-base font-medium"
                      style={{ backgroundColor: stint.tire_color, color: stint.compound === 'HARD' ? '#000' : '#fff' }}
                    >
                      <span>{stint.compound}</span>
                    </Badge>
                    <div className="text-right">
                      <div className="font-mono text-white text-lg">{formatLapTime(stint.avg_lap_time)}</div>
                      <div className="text-base text-slate-300">avg pace</div>
                    </div>
                    {stint.best_lap_time > 0 && (
                      <div className="text-right">
                        <div className="font-mono text-yellow-300 text-lg">{formatLapTime(stint.best_lap_time)}</div>
                        <div className="text-base text-slate-300">best lap</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tire Compound Legend */}
      <Card className="bg-white border border-gray-200 shadow-lg">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl text-white">Tire Compounds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            {['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].map(compound => (
              <Badge key={compound} className="flex items-center gap-4 px-6 py-3 text-base font-medium bg-slate-800/60 border border-slate-600/40 text-slate-200">
                <div 
                  className="w-6 h-6 rounded-full border-2 border-white/40"
                  style={{ backgroundColor: getTireColor(compound) }}
                />
                <span>{compound}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}