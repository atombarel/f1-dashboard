import React, { useMemo } from 'react'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { formatLapTime, getTeamColor, getTireColor } from '../services/f1Api'
import { Timer, TrendingDown, Zap, Target, Activity } from 'lucide-react'

export function LongRunAnalysis({ laps = [], stints = [], drivers = [], selectedDrivers = [] }) {
  // Helper functions
  const calculateConsistency = (run) => {
    if (run.length < 3) return 0
    const times = run.map(lap => lap.lap_time_seconds)
    const mean = times.reduce((sum, time) => sum + time, 0) / times.length
    const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length
    return Math.sqrt(variance)
  }

  const analyzeTirePerformance = (longRuns) => {
    const tireData = {}
    
    longRuns.forEach(run => {
      if (!tireData[run.tire_compound]) {
        tireData[run.tire_compound] = {
          compound: run.tire_compound,
          color: run.tire_color,
          runs: [],
          avg_pace: 0,
          avg_degradation: 0,
          consistency: 0
        }
      }
      tireData[run.tire_compound].runs.push(run)
    })

    Object.values(tireData).forEach(tire => {
      tire.avg_pace = tire.runs.reduce((sum, run) => sum + run.avg_lap_time, 0) / tire.runs.length
      tire.avg_degradation = tire.runs.reduce((sum, run) => sum + run.degradation_per_lap, 0) / tire.runs.length
      tire.consistency = tire.runs.reduce((sum, run) => sum + run.consistency, 0) / tire.runs.length
    })

    return Object.values(tireData)
  }

  const analyzeDegradation = (longRuns) => {
    return longRuns.map(run => ({
      driver_name: run.driver_name,
      team_color: run.team_color,
      tire_compound: run.tire_compound,
      degradation_per_lap: run.degradation_per_lap * 1000, // Convert to milliseconds
      lap_count: run.lap_count,
      avg_lap_time: run.avg_lap_time
    }))
  }

  const analysis = useMemo(() => {
    if (!laps.length) return null

    // Process data with driver and tire information
    const processedLaps = laps.map(lap => {
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
        is_out_lap: lap.is_pit_out_lap,
        is_in_lap: lap.is_pit_in_lap
      }
    })

    // Filter by selected drivers
    const filteredLaps = selectedDrivers.length > 0 
      ? processedLaps.filter(lap => selectedDrivers.includes(lap.driver_number))
      : processedLaps

    // Classify runs
    const runs = []
    const driverRuns = {}

    filteredLaps.forEach(lap => {
      if (!driverRuns[lap.driver_number]) {
        driverRuns[lap.driver_number] = { currentRun: [], runs: [] }
      }

      const driverData = driverRuns[lap.driver_number]

      // Start new run after pit stop or stint change
      if (lap.is_out_lap || (driverData.currentRun.length > 0 && 
          driverData.currentRun[driverData.currentRun.length - 1].stint_number !== lap.stint_number)) {
        if (driverData.currentRun.length > 0) {
          driverData.runs.push([...driverData.currentRun])
        }
        driverData.currentRun = []
      }

      // Exclude outliers (pit in/out laps, very slow laps)
      if (!lap.is_out_lap && !lap.is_in_lap) {
        driverData.currentRun.push(lap)
      }

      // End run on pit in lap
      if (lap.is_in_lap && driverData.currentRun.length > 0) {
        driverData.runs.push([...driverData.currentRun])
        driverData.currentRun = []
      }
    })

    // Finalize remaining runs
    Object.values(driverRuns).forEach(driverData => {
      if (driverData.currentRun.length > 0) {
        driverData.runs.push(driverData.currentRun)
      }
    })

    // Categorize runs
    const shortRuns = []
    const longRuns = []
    const runAnalysis = []

    Object.entries(driverRuns).forEach(([driverNumber, driverData]) => {
      driverData.runs.forEach((run, index) => {
        if (run.length < 3) return // Skip very short runs

        const avgLapTime = run.reduce((sum, lap) => sum + lap.lap_time_seconds, 0) / run.length
        const firstLap = run[0]
        const lastLap = run[run.length - 1]
        const degradation = lastLap.lap_time_seconds - firstLap.lap_time_seconds
        const degradationPerLap = degradation / run.length

        const runData = {
          driver_number: parseInt(driverNumber),
          driver_name: run[0].driver_name,
          team_color: run[0].team_color,
          tire_compound: run[0].tire_compound,
          tire_color: run[0].tire_color,
          stint_number: run[0].stint_number,
          run_index: index,
          laps: run,
          lap_count: run.length,
          avg_lap_time: avgLapTime,
          first_lap_time: firstLap.lap_time_seconds,
          last_lap_time: lastLap.lap_time_seconds,
          degradation: degradation,
          degradation_per_lap: degradationPerLap,
          is_long_run: run.length >= 8,
          consistency: calculateConsistency(run)
        }

        runAnalysis.push(runData)

        if (run.length >= 8) {
          longRuns.push(runData)
        } else if (run.length >= 3) {
          shortRuns.push(runData)
        }
      })
    })

    return {
      processedLaps: filteredLaps,
      shortRuns: shortRuns.sort((a, b) => a.avg_lap_time - b.avg_lap_time),
      longRuns: longRuns.sort((a, b) => a.avg_lap_time - b.avg_lap_time),
      runAnalysis,
      tirePerformance: analyzeTirePerformance(longRuns),
      degradationComparison: analyzeDegradation(longRuns)
    }
  }, [laps, stints, drivers, selectedDrivers])

  if (!analysis) {
    return (
      <Card className="bg-white border border-gray-200 shadow-lg">
        <div className="p-16 text-center">
          <Timer className="mx-auto w-20 h-20 text-gray-400 mb-8" />
          <h3 className="text-2xl font-semibold text-gray-900 mb-3">No sufficient run data for analysis</h3>
          <p className="text-gray-600 text-lg">Complete more laps to enable long run analysis</p>
        </div>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-lg p-4 shadow-xl text-white">
          <div className="font-semibold mb-2">{data.driver_name}</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Avg Pace:</span>
              <span className="font-mono">{formatLapTime(data.avg_lap_time || data.avg_pace)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Degradation:</span>
              <span className="font-mono">{((data.degradation_per_lap || data.avg_degradation) * 1000).toFixed(0)}ms/lap</span>
            </div>
            {data.lap_count && (
              <div className="flex justify-between">
                <span className="text-gray-400">Laps:</span>
                <span className="font-mono">{data.lap_count}</span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-lg">
      <div className="p-10">
        <div className="flex items-center mb-10">
          <div className="p-4 bg-red-500/20 rounded-xl mr-6">
            <Activity className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900 mb-2">Long Run vs Short Run Analysis</h3>
            <p className="text-gray-600 text-lg">Compare race pace and tire performance across different stint lengths</p>
          </div>
        </div>

        <Tabs defaultValue="comparison" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-100 border-gray-200 p-2 gap-2">
            <TabsTrigger value="comparison" className="text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">Run Comparison</TabsTrigger>
            <TabsTrigger value="tire-performance" className="text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">Tire Performance</TabsTrigger>
            <TabsTrigger value="degradation" className="text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">Degradation</TabsTrigger>
            <TabsTrigger value="statistics" className="text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="comparison" className="space-y-8 mt-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Long Runs */}
              <div>
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-green-500/20 rounded-lg mr-4">
                    <Timer className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-white">Long Runs (8+ laps)</h4>
                    <Badge variant="secondary" className="mt-1 bg-green-500/20 text-green-300 border-green-500/30">{analysis.longRuns.length} runs</Badge>
                  </div>
                </div>
              
                {analysis.longRuns.length > 0 ? (
                  <div className="space-y-4">
                    {analysis.longRuns.slice(0, 10).map((run, index) => (
                      <div key={`${run.driver_number}-${run.run_index}`} 
                           className="flex items-center justify-between p-5 bg-slate-800/60 rounded-xl border border-slate-700/50">
                        <div className="flex items-center space-x-4">
                          <div className="text-xl font-mono text-green-300 bg-green-500/20 px-3 py-1 rounded-lg">#{index + 1}</div>
                          <div 
                            className="w-5 h-5 rounded-full ring-2 ring-white/30"
                            style={{ backgroundColor: run.team_color }}
                          />
                          <div>
                            <div className="font-semibold text-white text-lg">{run.driver_name}</div>
                            <div className="flex items-center space-x-3 text-base text-slate-300">
                              <div 
                                className="w-4 h-4 rounded-full ring-1 ring-white/30"
                                style={{ backgroundColor: run.tire_color }}
                              />
                              <span>{run.tire_compound}</span>
                              <span>•</span>
                              <span>{run.lap_count} laps</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-white text-xl">{formatLapTime(run.avg_lap_time)}</div>
                          <div className="text-base text-slate-300">
                            {run.degradation_per_lap > 0 ? '+' : ''}{(run.degradation_per_lap * 1000).toFixed(0)}ms/lap
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400">
                    <p className="text-lg">No long runs detected</p>
                  </div>
                )}
            </div>

              {/* Short Runs */}
              <div>
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-yellow-500/20 rounded-lg mr-4">
                    <Zap className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-white">Short Runs (3-7 laps)</h4>
                    <Badge variant="secondary" className="mt-1 bg-yellow-500/20 text-yellow-300 border-yellow-500/30">{analysis.shortRuns.length} runs</Badge>
                  </div>
                </div>
              
                {analysis.shortRuns.length > 0 ? (
                  <div className="space-y-4">
                    {analysis.shortRuns.slice(0, 10).map((run, index) => (
                      <div key={`${run.driver_number}-${run.run_index}`} 
                           className="flex items-center justify-between p-5 bg-slate-800/60 rounded-xl border border-slate-700/50">
                        <div className="flex items-center space-x-4">
                          <div className="text-xl font-mono text-yellow-300 bg-yellow-500/20 px-3 py-1 rounded-lg">#{index + 1}</div>
                          <div 
                            className="w-5 h-5 rounded-full ring-2 ring-white/30"
                            style={{ backgroundColor: run.team_color }}
                          />
                          <div>
                            <div className="font-semibold text-white text-lg">{run.driver_name}</div>
                            <div className="flex items-center space-x-3 text-base text-slate-300">
                              <div 
                                className="w-4 h-4 rounded-full ring-1 ring-white/30"
                                style={{ backgroundColor: run.tire_color }}
                              />
                              <span>{run.tire_compound}</span>
                              <span>•</span>
                              <span>{run.lap_count} laps</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-white text-xl">{formatLapTime(run.avg_lap_time)}</div>
                          <div className="text-base text-slate-300">
                            {run.degradation_per_lap > 0 ? '+' : ''}{(run.degradation_per_lap * 1000).toFixed(0)}ms/lap
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400">
                    <p className="text-lg">No short runs detected</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tire-performance" className="space-y-8 mt-8">
            <div className="bg-slate-800/40 rounded-xl p-8 border border-slate-700/50">
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.tirePerformance} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                      dataKey="avg_pace" 
                      fill="#3B82F6"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="degradation" className="space-y-8 mt-8">
            <div className="bg-slate-800/40 rounded-xl p-8 border border-slate-700/50">
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.degradationComparison} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                    <XAxis 
                      dataKey="driver_name" 
                      stroke="#CBD5E1"
                      tick={{ fill: '#CBD5E1', fontSize: 14 }}
                    />
                    <YAxis 
                      stroke="#CBD5E1"
                      tick={{ fill: '#CBD5E1', fontSize: 14 }}
                      label={{ value: 'Degradation (ms/lap)', angle: -90, position: 'insideLeft', fill: '#CBD5E1' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="degradation_per_lap" 
                      fill="#EF4444"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="statistics" className="space-y-8 mt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center p-8 bg-gradient-to-br from-green-500/15 to-green-600/10 border border-green-500/30 rounded-xl">
                <div className="text-4xl font-bold text-green-300 mb-3">{analysis.longRuns.length}</div>
                <div className="text-base text-green-200 font-medium">Long Runs</div>
              </div>
              <div className="text-center p-8 bg-gradient-to-br from-yellow-500/15 to-yellow-600/10 border border-yellow-500/30 rounded-xl">
                <div className="text-4xl font-bold text-yellow-300 mb-3">{analysis.shortRuns.length}</div>
                <div className="text-base text-yellow-200 font-medium">Short Runs</div>
              </div>
              <div className="text-center p-8 bg-gradient-to-br from-blue-500/15 to-blue-600/10 border border-blue-500/30 rounded-xl">
                <div className="text-4xl font-bold text-blue-300 mb-3">
                  {analysis.longRuns.length > 0 ? formatLapTime(Math.min(...analysis.longRuns.map(r => r.avg_lap_time))) : '--'}
                </div>
                <div className="text-base text-blue-200 font-medium">Best Long Run</div>
              </div>
              <div className="text-center p-8 bg-gradient-to-br from-purple-500/15 to-purple-600/10 border border-purple-500/30 rounded-xl">
                <div className="text-4xl font-bold text-purple-300 mb-3">
                  {analysis.shortRuns.length > 0 ? formatLapTime(Math.min(...analysis.shortRuns.map(r => r.avg_lap_time))) : '--'}
                </div>
                <div className="text-base text-purple-200 font-medium">Best Short Run</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  )
}