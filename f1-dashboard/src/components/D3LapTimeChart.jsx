import React, { useRef, useEffect, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line, curveCardinal } from 'd3-shape'
import { extent, group } from 'd3-array'
import { select } from 'd3-selection'
import { axisBottom, axisLeft } from 'd3-axis'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { formatLapTime, getTeamColor, getTireColor } from '../services/f1Api'
import { TrendingUp, BarChart3, Activity, Zap, Timer } from 'lucide-react'

export function D3LapTimeChart({ 
  laps = [], 
  stints = [], 
  drivers = [], 
  selectedDrivers = [],
  title = "Lap Time Analysis" 
}) {
  const svgRef = useRef()
  const tooltipRef = useRef()
  const [chartType, setChartType] = useState('line') // 'line', 'scatter', 'tyre-timeline'
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 })

  // Process data with tire information
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
      driver_full_name: driver?.full_name || `Driver ${lap.driver_number}`
    }
  })

  // Filter data based on selected drivers
  const filteredLaps = selectedDrivers.length > 0 
    ? processedLaps.filter(lap => selectedDrivers.includes(lap.driver_number))
    : processedLaps

  // Group by driver
  const driverGroups = group(filteredLaps, d => d.driver_number)

  useEffect(() => {
    if (!filteredLaps.length) return

    const svg = select(svgRef.current)
    const tooltip = select(tooltipRef.current)
    
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 80, bottom: 60, left: 80 }
    const width = dimensions.width - margin.left - margin.right
    const height = dimensions.height - margin.top - margin.bottom

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Scales
    const xScale = scaleLinear()
      .domain(extent(filteredLaps, d => d.lap_number))
      .range([0, width])

    const yScale = scaleLinear()
      .domain(extent(filteredLaps, d => d.lap_time_seconds))
      .nice()
      .range([height, 0])

    // Axes
    const xAxis = axisBottom(xScale)
      .tickFormat(d => `Lap ${d}`)
    
    const yAxis = axisLeft(yScale)
      .tickFormat(d => formatLapTime(d))

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("fill", "#9CA3AF")

    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .style("fill", "#9CA3AF")

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height})`)
      .call(axisBottom(xScale)
        .tickSize(-height)
        .tickFormat("")
      )
      .style("stroke-dasharray", "3,3")
      .style("opacity", 0.3)
      .style("stroke", "#374151")

    g.append("g")
      .attr("class", "grid")
      .call(axisLeft(yScale)
        .tickSize(-width)
        .tickFormat("")
      )
      .style("stroke-dasharray", "3,3")
      .style("opacity", 0.3)
      .style("stroke", "#374151")

    // Chart rendering based on type
    if (chartType === 'line') {
      renderLineChart(g, driverGroups, xScale, yScale, tooltip)
    } else if (chartType === 'scatter') {
      renderScatterChart(g, filteredLaps, xScale, yScale, tooltip)
    } else if (chartType === 'tyre-timeline') {
      renderTyreTimeline(g, filteredLaps, xScale, yScale, tooltip)
    }

    // Axis labels
    g.append("text")
      .attr("transform", `translate(${width / 2}, ${height + 40})`)
      .style("text-anchor", "middle")
      .style("fill", "#9CA3AF")
      .text("Lap Number")

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "#9CA3AF")
      .text("Lap Time")

  }, [filteredLaps, chartType, dimensions, selectedDrivers])

  const renderLineChart = (g, driverGroups, xScale, yScale, tooltip) => {
    const lineGenerator = line()
      .x(d => xScale(d.lap_number))
      .y(d => yScale(d.lap_time_seconds))
      .curve(curveCardinal)

    driverGroups.forEach((driverLaps, driverNumber) => {
      const teamColor = driverLaps[0].team_color

      // Line
      g.append("path")
        .datum(driverLaps)
        .attr("fill", "none")
        .attr("stroke", teamColor)
        .attr("stroke-width", 3)
        .attr("opacity", 0.8)
        .attr("d", lineGenerator)

      // Points with tire colors
      g.selectAll(`.point-${driverNumber}`)
        .data(driverLaps)
        .enter()
        .append("circle")
        .attr("class", `point-${driverNumber}`)
        .attr("cx", d => xScale(d.lap_number))
        .attr("cy", d => yScale(d.lap_time_seconds))
        .attr("r", 5)
        .attr("fill", d => d.tire_color)
        .attr("stroke", teamColor)
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => showTooltip(event, d, tooltip))
        .on("mouseout", () => hideTooltip(tooltip))
    })
  }

  const renderScatterChart = (g, laps, xScale, yScale, tooltip) => {
    g.selectAll(".scatter-point")
      .data(laps)
      .enter()
      .append("circle")
      .attr("class", "scatter-point")
      .attr("cx", d => xScale(d.lap_number))
      .attr("cy", d => yScale(d.lap_time_seconds))
      .attr("r", 6)
      .attr("fill", d => d.tire_color)
      .attr("stroke", d => d.team_color)
      .attr("stroke-width", 2)
      .attr("opacity", 0.8)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => showTooltip(event, d, tooltip))
      .on("mouseout", () => hideTooltip(tooltip))
  }

  const renderTyreTimeline = (g, laps, xScale, yScale, tooltip) => {
    // Group laps by stint for tire timeline
    const stintGroups = group(laps, d => `${d.driver_number}-${d.stint_number}`)
    
    stintGroups.forEach((stintLaps, key) => {
      if (stintLaps.length < 2) return
      
      const sortedLaps = stintLaps.sort((a, b) => a.lap_number - b.lap_number)
      const teamColor = sortedLaps[0].team_color
      const tireColor = sortedLaps[0].tire_color
      
      // Create tire stint bands
      const bandHeight = 8
      const yPosition = yScale.range()[1] - (parseInt(key.split('-')[0]) * 12) - 10
      
      g.append("rect")
        .attr("x", xScale(sortedLaps[0].lap_number))
        .attr("y", yPosition)
        .attr("width", xScale(sortedLaps[sortedLaps.length - 1].lap_number) - xScale(sortedLaps[0].lap_number))
        .attr("height", bandHeight)
        .attr("fill", tireColor)
        .attr("opacity", 0.7)
        .attr("stroke", teamColor)
        .attr("stroke-width", 1)

      // Add lap time points
      g.selectAll(`.stint-point-${key}`)
        .data(sortedLaps)
        .enter()
        .append("circle")
        .attr("class", `stint-point-${key}`)
        .attr("cx", d => xScale(d.lap_number))
        .attr("cy", d => yScale(d.lap_time_seconds))
        .attr("r", 4)
        .attr("fill", tireColor)
        .attr("stroke", teamColor)
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => showTooltip(event, d, tooltip))
        .on("mouseout", () => hideTooltip(tooltip))
    })
  }

  const showTooltip = (event, data, tooltip) => {
    tooltip.style("opacity", 1)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 10) + "px")
      .html(`
        <div class="bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-lg p-4 shadow-xl text-white">
          <div class="font-semibold mb-2">
            Lap ${data.lap_number} - ${data.driver_name}
          </div>
          <div class="space-y-1 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-gray-400">Lap Time:</span>
              <span class="font-mono">${formatLapTime(data.lap_time_seconds)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-400">Tire:</span>
              <div class="flex items-center space-x-2">
                <div style="width: 12px; height: 12px; background-color: ${data.tire_color}; border-radius: 50%; border: 1px solid white;"></div>
                <span>${data.tire_compound}</span>
              </div>
            </div>
            ${data.sector1_seconds > 0 ? `
              <div class="flex items-center justify-between">
                <span class="text-yellow-400">S1:</span>
                <span class="font-mono">${formatLapTime(data.sector1_seconds)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-green-400">S2:</span>
                <span class="font-mono">${formatLapTime(data.sector2_seconds)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-purple-400">S3:</span>
                <span class="font-mono">${formatLapTime(data.sector3_seconds)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `)
  }

  const hideTooltip = (tooltip) => {
    tooltip.style("opacity", 0)
  }

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const container = svgRef.current?.parentElement
      if (container) {
        setDimensions({
          width: container.offsetWidth,
          height: 400
        })
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!filteredLaps.length) {
    return (
      <Card className="bg-white border border-gray-200 shadow-lg">
        <div className="p-16 text-center">
          <Timer className="mx-auto w-20 h-20 text-gray-400 mb-8" />
          <h3 className="text-2xl font-semibold text-gray-900 mb-3">No lap data available</h3>
          <p className="text-gray-600 text-lg">Data will appear once drivers complete laps in the selected session</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-lg">
      <div className="p-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-12">
          <div className="flex items-center mb-8 lg:mb-0">
            <div className="p-4 bg-red-500/20 rounded-xl mr-6">
              <TrendingUp className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {title}
              </h3>
              <p className="text-gray-600 text-lg">Interactive lap time visualization with multiple chart modes</p>
            </div>
          </div>
        
          {/* Chart Controls */}
          <div className="flex items-center bg-gray-100 rounded-xl p-2 gap-1">
            <Button
              variant={chartType === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('line')}
              className={`flex items-center gap-3 px-5 py-3 rounded-lg transition-all ${
                chartType === 'line' 
                  ? 'bg-red-100 text-red-700 border border-red-300' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              Line Chart
            </Button>
            <Button
              variant={chartType === 'scatter' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('scatter')}
              className={`flex items-center gap-3 px-5 py-3 rounded-lg transition-all ${
                chartType === 'scatter' 
                  ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              <Activity className="w-5 h-5" />
              Scatter Plot
            </Button>
            <Button
              variant={chartType === 'tyre-timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('tyre-timeline')}
              className={`flex items-center gap-3 px-5 py-3 rounded-lg transition-all ${
                chartType === 'tyre-timeline' 
                  ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              Tire Timeline
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="bg-gradient-to-br from-yellow-100 to-yellow-50 border border-yellow-300 rounded-xl p-8 text-center">
            <div className="text-4xl font-bold text-yellow-700 mb-3">
              {formatLapTime(Math.min(...filteredLaps.map(l => l.lap_time_seconds)))}
            </div>
            <div className="text-base text-yellow-600 font-medium">Fastest Lap</div>
          </div>
          <div className="bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-300 rounded-xl p-8 text-center">
            <div className="text-4xl font-bold text-blue-700 mb-3">
              {filteredLaps.length}
            </div>
            <div className="text-base text-blue-600 font-medium">Total Laps</div>
          </div>
          <div className="bg-gradient-to-br from-green-100 to-green-50 border border-green-300 rounded-xl p-8 text-center">
            <div className="text-4xl font-bold text-green-700 mb-3">
              {new Set(filteredLaps.map(l => l.driver_number)).size}
            </div>
            <div className="text-base text-green-600 font-medium">Drivers</div>
          </div>
          <div className="bg-gradient-to-br from-purple-100 to-purple-50 border border-purple-300 rounded-xl p-8 text-center">
            <div className="text-4xl font-bold text-purple-700 mb-3">
              {new Set(filteredLaps.map(l => l.tire_compound)).size}
            </div>
            <div className="text-base text-purple-600 font-medium">Tire Compounds</div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative mb-12">
          <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              className="overflow-visible w-full"
            />
          </div>
          <div
            ref={tooltipRef}
            className="absolute pointer-events-none opacity-0 transition-opacity duration-200 z-10"
          />
        </div>

        {/* Tire Legend */}
        <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
          <h4 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <div className="w-3 h-3 bg-gray-600 rounded-full mr-4"></div>
            Tire Compounds
          </h4>
          <div className="flex flex-wrap gap-6">
            {['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].map(compound => (
              <div key={compound} className="flex items-center gap-4 px-6 py-3 bg-white rounded-xl border border-gray-300">
                <div 
                  className="w-6 h-6 rounded-full border-2 border-gray-400"
                  style={{ backgroundColor: getTireColor(compound) }}
                />
                <span className="text-base font-medium text-gray-900">{compound}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}