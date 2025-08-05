import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { f1Api } from '../../../services/f1Api'

export function useRaceControl(sessionKey) {
  return useQuery({
    queryKey: ['raceControl', sessionKey],
    queryFn: () => f1Api.getRaceControl(sessionKey),
    enabled: !!sessionKey
  })
}

export function usePitStops(sessionKey) {
  return useQuery({
    queryKey: ['pitStops', sessionKey],
    queryFn: () => f1Api.getPitStops(sessionKey),
    enabled: !!sessionKey
  })
}

export function usePositions(sessionKey) {
  return useQuery({
    queryKey: ['positions', sessionKey],
    queryFn: () => f1Api.getPositions(sessionKey),
    enabled: !!sessionKey
  })
}

export function useRaceStrategy(sessionKey, pitStops, stints, allLaps, drivers, positions) {
  return useMemo(() => {
    if (!pitStops || !stints || !allLaps || !drivers) {
      return { strategies: [], bestStrategies: [] }
    }

    // Analyze each driver's strategy
    const driverStrategies = drivers.map(driver => {
      const driverPitStops = pitStops.filter(ps => ps.driver_number === driver.driver_number)
      const driverStints = stints.filter(s => s.driver_number === driver.driver_number)
      const driverLaps = allLaps.filter(lap => lap.driver_number === driver.driver_number)
      
      // Calculate pit stop count
      const pitStopCount = driverPitStops.length
      
      // Get tire compounds used
      const tireCompounds = driverStints.map(stint => stint.compound).filter(Boolean)
      
      // Calculate average pace per stint
      const stintPaces = driverStints.map(stint => {
        const stintLaps = driverLaps.filter(lap => 
          lap.lap_number >= stint.lap_start && 
          lap.lap_number <= stint.lap_end
        )
        
        if (stintLaps.length === 0) return null
        
        const avgLapTime = stintLaps.reduce((sum, lap) => sum + lap.lap_time_seconds, 0) / stintLaps.length
        return {
          compound: stint.compound,
          avgLapTime,
          lapCount: stintLaps.length
        }
      }).filter(Boolean)
      
      // Find starting and finishing positions if position data is available
      let startPosition = null
      let finishPosition = null
      let positionChange = 0
      
      if (positions && positions.length > 0) {
        const driverPositions = positions
          .filter(pos => pos.driver_number === driver.driver_number)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        
        if (driverPositions.length > 0) {
          startPosition = driverPositions[0].position
          finishPosition = driverPositions[driverPositions.length - 1].position
          positionChange = startPosition - finishPosition // Positive = positions gained
        }
      }
      
      // Calculate overall average lap time
      const avgLapTime = driverLaps.length > 0 
        ? driverLaps.reduce((sum, lap) => sum + lap.lap_time_seconds, 0) / driverLaps.length
        : null

      return {
        driver_number: driver.driver_number,
        name_acronym: driver.name_acronym,
        team_name: driver.team_name,
        pitStopCount,
        tireCompounds,
        stintPaces,
        startPosition,
        finishPosition,
        positionChange,
        avgLapTime,
        totalLaps: driverLaps.length
      }
    })

    // Group strategies by pit stop count and tire compounds
    const strategyGroups = {}
    
    driverStrategies.forEach(strategy => {
      const strategyKey = `${strategy.pitStopCount}-stop-${strategy.tireCompounds.join('-')}`
      
      if (!strategyGroups[strategyKey]) {
        strategyGroups[strategyKey] = {
          name: `${strategy.pitStopCount}-Stop Strategy`,
          pitStops: strategy.pitStopCount,
          compounds: [...new Set(strategy.tireCompounds)],
          drivers: [],
          avgPositionChange: 0,
          avgLapTime: 0,
          successRate: 0
        }
      }
      
      strategyGroups[strategyKey].drivers.push(strategy)
    })

    // Calculate strategy effectiveness
    Object.values(strategyGroups).forEach(group => {
      const validPositionChanges = group.drivers
        .filter(d => d.positionChange !== 0)
        .map(d => d.positionChange)
      
      group.avgPositionChange = validPositionChanges.length > 0
        ? validPositionChanges.reduce((sum, change) => sum + change, 0) / validPositionChanges.length
        : 0

      const validLapTimes = group.drivers
        .filter(d => d.avgLapTime !== null)
        .map(d => d.avgLapTime)
      
      group.avgLapTime = validLapTimes.length > 0
        ? validLapTimes.reduce((sum, time) => sum + time, 0) / validLapTimes.length
        : 0

      // Success rate: percentage of drivers who gained positions or finished well
      const successfulDrivers = group.drivers.filter(d => 
        d.positionChange > 0 || (d.finishPosition && d.finishPosition <= 10)
      )
      group.successRate = group.drivers.length > 0 
        ? (successfulDrivers.length / group.drivers.length) * 100
        : 0
    })

    const strategies = Object.values(strategyGroups)
      .filter(group => group.drivers.length > 0)
      .sort((a, b) => {
        // Sort by success rate first, then by average position change
        if (Math.abs(b.successRate - a.successRate) > 5) {
          return b.successRate - a.successRate
        }
        return b.avgPositionChange - a.avgPositionChange
      })

    // Identify best 1-2 strategies
    const bestStrategies = strategies.slice(0, 2)

    return {
      strategies,
      bestStrategies
    }
  }, [pitStops, stints, allLaps, drivers, positions])
}