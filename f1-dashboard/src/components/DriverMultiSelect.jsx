import React, { useState } from 'react'
import { Check, ChevronsUpDown, X, User, Users } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Alert, AlertDescription } from './ui/alert'
import { cn } from '../lib/utils'
import { getTeamColor } from '../services/f1Api'

export function DriverMultiSelect({ drivers = [], selectedDrivers = [], onSelectionChange }) {
  const [open, setOpen] = useState(false)

  const toggleDriver = (driverNumber) => {
    const newSelection = selectedDrivers.includes(driverNumber)
      ? selectedDrivers.filter(d => d !== driverNumber)
      : [...selectedDrivers, driverNumber]
    
    onSelectionChange(newSelection)
  }

  const clearAll = () => {
    onSelectionChange([])
  }

  const selectAll = () => {
    onSelectionChange(drivers.map(d => d.driver_number))
  }

  const selectedDriversData = drivers.filter(d => selectedDrivers.includes(d.driver_number))

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            Driver Comparison
          </h3>
          <p className="text-gray-600 text-base mt-1">
            {selectedDrivers.length > 0 
              ? `${selectedDrivers.length} driver${selectedDrivers.length === 1 ? '' : 's'} selected`
              : 'Select drivers to compare their performance'
            }
          </p>
        </div>
        <div className="flex gap-3">
          {selectedDrivers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 px-4 py-2"
            >
              <X className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 px-4 py-2"
          >
            <Check className="w-4 h-4 mr-2" />
            Select All
          </Button>
        </div>
      </div>

      {/* Selected Drivers Display */}
      {selectedDriversData.length > 0 && (
        <div className="space-y-5">
          <h4 className="text-base font-medium text-gray-900">Selected Drivers:</h4>
          <div className="flex flex-wrap gap-3">
            {selectedDriversData.map(driver => (
              <Badge
                key={driver.driver_number}
                variant="secondary"
                className="group px-4 py-2 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-all text-gray-900 border border-gray-300"
                onClick={() => toggleDriver(driver.driver_number)}
              >
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: getTeamColor(driver.team_name) }}
                />
                #{driver.driver_number} {driver.name_acronym}
                <X className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Driver Grid */}
      <div className="space-y-5">
        <h4 className="text-base font-medium text-gray-900">Available Drivers:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {drivers.map(driver => {
            const isSelected = selectedDrivers.includes(driver.driver_number)
            
            return (
              <Card
                key={driver.driver_number}
                onClick={() => toggleDriver(driver.driver_number)}
                className={cn(
                  "group relative cursor-pointer transition-all duration-300 hover:scale-105 border-gray-300",
                  isSelected 
                    ? "bg-red-50 border-red-300 shadow-lg shadow-red-200" 
                    : "bg-white hover:border-gray-400 hover:bg-gray-50"
                )}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div 
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm",
                          isSelected ? "ring-2 ring-red-400" : "ring-1 ring-white/30"
                        )}
                        style={{ backgroundColor: getTeamColor(driver.team_name) }}
                      >
                        {driver.driver_number}
                      </div>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className={cn(
                        "font-semibold text-sm truncate",
                        isSelected ? "text-gray-900" : "text-gray-700 group-hover:text-gray-900"
                      )}>
                        {driver.name_acronym}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {driver.team_name}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {drivers.length === 0 && (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            No drivers available. Select a session to view drivers.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}