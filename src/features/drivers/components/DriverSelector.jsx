import React from 'react'
import { THEME_COLORS } from '../../../constants/colors'

export function DriverSelector({ drivers, selectedDrivers, onDriverSelect, darkMode }) {
  const theme = darkMode ? THEME_COLORS.DARK : THEME_COLORS.LIGHT

  if (!drivers || drivers.length === 0) return null

  const handleDriverToggle = (driverNumber) => {
    if (selectedDrivers.includes(driverNumber)) {
      onDriverSelect(selectedDrivers.filter(d => d !== driverNumber))
    } else {
      onDriverSelect([...selectedDrivers, driverNumber])
    }
  }

  const handleShowAll = () => {
    onDriverSelect([])
  }

  return (
    <div style={{
      backgroundColor: theme.BACKGROUND_SECONDARY,
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '30px',
      boxShadow: darkMode ? '0 2px 4px rgba(255,255,255,0.1)' : '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.3s'
    }}>
      <h3 style={{ marginBottom: '15px', color: theme.TEXT }}>
        Select Drivers to Compare:
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {drivers.map(driver => (
          <button
            key={driver.driver_number}
            onClick={() => handleDriverToggle(driver.driver_number)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '2px solid',
              borderColor: selectedDrivers.includes(driver.driver_number) || selectedDrivers.length === 0 
                ? driver.color 
                : theme.BORDER,
              backgroundColor: selectedDrivers.includes(driver.driver_number) || selectedDrivers.length === 0
                ? driver.color + '20'
                : theme.BACKGROUND_TERTIARY,
              cursor: 'pointer',
              fontWeight: '600',
              color: theme.TEXT,
              transition: 'all 0.2s'
            }}
          >
            {driver.name_acronym}
          </button>
        ))}
        {selectedDrivers.length > 0 && (
          <button
            onClick={handleShowAll}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '2px solid #666',
              backgroundColor: '#666',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Show All
          </button>
        )}
      </div>
    </div>
  )
}