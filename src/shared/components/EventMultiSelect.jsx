import React, { useState, useRef, useEffect } from 'react'
import { EVENT_TYPES } from '../../constants/config'

export function EventMultiSelectInline({ selectedEvents, onSelectionChange, darkMode }) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)
  
  const filteredEvents = EVENT_TYPES.filter(event => 
    event.label.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const selectedCount = Object.values(selectedEvents).filter(Boolean).length
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleSelect = (eventValue) => {
    const newSelection = { ...selectedEvents, [eventValue]: !selectedEvents[eventValue] }
    onSelectionChange(newSelection)
  }
  
  const handleSelectAll = () => {
    const allSelected = Object.fromEntries(EVENT_TYPES.map(e => [e.value, true]))
    onSelectionChange(allSelected)
  }
  
  const handleClearAll = () => {
    const allClear = Object.fromEntries(EVENT_TYPES.map(e => [e.value, false]))
    onSelectionChange(allClear)
  }
  
  return (
    <div style={{ position: 'relative', width: '300px' }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: darkMode ? '#374151' : '#fff',
          border: darkMode ? '1px solid #4b5563' : '1px solid #d1d5db',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: '14px',
          color: darkMode ? '#fff' : '#111827',
          transition: 'all 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedCount === 0 ? (
            <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
              Select event types...
            </span>
          ) : selectedCount === EVENT_TYPES.length ? (
            <span>All events selected</span>
          ) : (
            <>
              <span>{selectedCount} selected</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {EVENT_TYPES
                  .filter(e => selectedEvents[e.value])
                  .slice(0, 3)
                  .map(e => (
                    <span key={e.value} style={{ fontSize: '16px' }}>
                      {e.icon}
                    </span>
                  ))}
                {selectedCount > 3 && (
                  <span style={{ fontSize: '12px', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    +{selectedCount - 3}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <svg
          style={{
            width: '16px',
            height: '16px',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: darkMode ? '#1f2937' : '#fff',
          border: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 1000,
          maxHeight: '350px',
          overflowY: 'auto'
        }}>
          <div style={{ padding: '8px' }}>
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: darkMode ? '#374151' : '#f9fafb',
                border: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
                borderRadius: '4px',
                fontSize: '14px',
                color: darkMode ? '#fff' : '#111827',
                outline: 'none'
              }}
            />
          </div>
          
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '0 8px 8px',
            borderBottom: darkMode ? '1px solid #374151' : '1px solid #e5e7eb'
          }}>
            <button
              onClick={handleSelectAll}
              style={{
                flex: 1,
                padding: '6px',
                backgroundColor: darkMode ? '#4b5563' : '#f3f4f6',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500',
                color: darkMode ? '#fff' : '#374151',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = darkMode ? '#6b7280' : '#e5e7eb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = darkMode ? '#4b5563' : '#f3f4f6'}
            >
              Select All
            </button>
            <button
              onClick={handleClearAll}
              style={{
                flex: 1,
                padding: '6px',
                backgroundColor: darkMode ? '#4b5563' : '#f3f4f6',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500',
                color: darkMode ? '#fff' : '#374151',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = darkMode ? '#6b7280' : '#e5e7eb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = darkMode ? '#4b5563' : '#f3f4f6'}
            >
              Clear All
            </button>
          </div>
          
          <div style={{ padding: '4px 0' }}>
            {filteredEvents.length === 0 ? (
              <div style={{
                padding: '16px',
                textAlign: 'center',
                color: darkMode ? '#9ca3af' : '#6b7280',
                fontSize: '14px'
              }}>
                No event types found
              </div>
            ) : (
              filteredEvents.map((eventType) => (
                <div
                  key={eventType.value}
                  onClick={() => handleSelect(eventType.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    backgroundColor: darkMode 
                      ? (selectedEvents[eventType.value] ? '#374151' : 'transparent')
                      : (selectedEvents[eventType.value] ? '#f3f4f6' : 'transparent')
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedEvents[eventType.value]) {
                      e.currentTarget.style.backgroundColor = darkMode ? '#2d3748' : '#f9fafb'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedEvents[eventType.value]) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <div style={{
                    width: '20px',
                    height: '20px',
                    marginRight: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedEvents[eventType.value] && (
                      <svg
                        style={{ width: '16px', height: '16px', color: '#10b981' }}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span style={{ marginRight: '8px', fontSize: '18px' }}>
                    {eventType.icon}
                  </span>
                  <span style={{
                    flex: 1,
                    fontSize: '14px',
                    color: darkMode ? '#fff' : '#111827'
                  }}>
                    {eventType.label}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '500',
                    backgroundColor: `${eventType.color}20`,
                    color: eventType.color,
                    border: `1px solid ${eventType.color}40`
                  }}>
                    {eventType.value}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}