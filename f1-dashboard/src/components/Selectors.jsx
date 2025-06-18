import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from 'lucide-react';
import { openf1Api } from '../services/openf1Api';

const DropdownPortal = ({ isOpen, position, onClose, options, onChange }) => {
  if (!isOpen) return null;

  const dropdownContent = (
    <>
      <div
        className="fixed inset-0 bg-transparent"
        style={{ zIndex: 999998 }}
        onClick={onClose}
      />
      <div 
        className="fixed max-h-60 overflow-auto rounded-lg glass-effect py-1 shadow-xl border border-white/20"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
          zIndex: 999999,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}
      >
        {options.map((option, index) => (
          <button
            key={option.value || index}
            className="relative w-full px-4 py-2 text-left text-white hover:bg-white/20 transition-colors duration-150 border-none"
            style={{ backgroundColor: 'transparent' }}
            onClick={() => {
              onChange(option);
              onClose();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );

  return createPortal(dropdownContent, document.body);
};

const Dropdown = ({ label, value, onChange, options, placeholder, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  const handleClose = () => setIsOpen(false);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={`relative w-full glass-effect rounded-lg px-4 py-3 text-left text-white transition-all duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-f1-red/50 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="block truncate">
          {value ? (typeof value === 'object' ? value.label : value) : placeholder}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDownIcon
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      <DropdownPortal
        isOpen={isOpen}
        position={dropdownPosition}
        onClose={handleClose}
        options={options}
        onChange={onChange}
      />
    </div>
  );
};

const Selectors = ({ onSelectionChange }) => {
  const [meetings, setMeetings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [drivers, setDrivers] = useState([]);
  
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  
  const [loading, setLoading] = useState({
    meetings: false,
    sessions: false,
    drivers: false,
  });

  // Generate year options (2023-2024 for now, as OpenF1 has limited historical data)
  const yearOptions = [
    { value: 2025, label: '2025' },
    { value: 2024, label: '2024' },
    { value: 2023, label: '2023' },
  ];

  // Load meetings when year changes
  useEffect(() => {
    if (selectedYear) {
      setLoading(prev => ({ ...prev, meetings: true }));
      openf1Api.getMeetings(selectedYear.value)
        .then(data => {
          const meetingOptions = data.map(meeting => ({
            value: meeting.meeting_key,
            label: meeting.meeting_name,
            data: meeting
          }));
          setMeetings(meetingOptions);
          setSelectedMeeting(null);
          setSelectedSession(null);
          setSelectedDriver(null);
          setSessions([]);
          setDrivers([]);
        })
        .catch(error => {
          console.error('Failed to load meetings:', error);
          setMeetings([]);
        })
        .finally(() => {
          setLoading(prev => ({ ...prev, meetings: false }));
        });
    }
  }, [selectedYear]);

  // Load sessions when meeting changes
  useEffect(() => {
    if (selectedMeeting) {
      setLoading(prev => ({ ...prev, sessions: true }));
      openf1Api.getSessions(selectedMeeting.value)
        .then(data => {
          const sessionOptions = data.map(session => ({
            value: session.session_key,
            label: `${session.session_name} (${session.session_type})`,
            data: session
          }));
          setSessions(sessionOptions);
          setSelectedSession(null);
          setSelectedDriver(null);
          setDrivers([]);
        })
        .catch(error => {
          console.error('Failed to load sessions:', error);
          setSessions([]);
        })
        .finally(() => {
          setLoading(prev => ({ ...prev, sessions: false }));
        });
    }
  }, [selectedMeeting]);

  // Load drivers when session changes
  useEffect(() => {
    if (selectedSession) {
      setLoading(prev => ({ ...prev, drivers: true }));
      openf1Api.getDrivers(selectedSession.value)
        .then(data => {
          const driverOptions = [
            { value: null, label: 'All Drivers' },
            ...data.map(driver => ({
              value: driver.driver_number,
              label: `${driver.name_acronym} - ${driver.full_name} (${driver.team_name})`,
              data: driver
            }))
          ];
          setDrivers(driverOptions);
          setSelectedDriver(driverOptions[0]); // Default to "All Drivers"
        })
        .catch(error => {
          console.error('Failed to load drivers:', error);
          setDrivers([]);
        })
        .finally(() => {
          setLoading(prev => ({ ...prev, drivers: false }));
        });
    }
  }, [selectedSession]);

  // Notify parent component of selection changes
  useEffect(() => {
    onSelectionChange({
      year: selectedYear,
      meeting: selectedMeeting,
      session: selectedSession,
      driver: selectedDriver,
    });
  }, [selectedYear, selectedMeeting, selectedSession, selectedDriver, onSelectionChange]);

  return (
    <div className="glass-effect rounded-xl p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-6 f1-gradient bg-clip-text text-transparent">
        Select Race Data
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Dropdown
          label="Year"
          value={selectedYear}
          onChange={setSelectedYear}
          options={yearOptions}
          placeholder="Select year..."
        />
        
        <Dropdown
          label="Race"
          value={selectedMeeting}
          onChange={setSelectedMeeting}
          options={meetings}
          placeholder={loading.meetings ? "Loading races..." : "Select race..."}
          disabled={!selectedYear || loading.meetings}
        />
        
        <Dropdown
          label="Session"
          value={selectedSession}
          onChange={setSelectedSession}
          options={sessions}
          placeholder={loading.sessions ? "Loading sessions..." : "Select session..."}
          disabled={!selectedMeeting || loading.sessions}
        />
        
        <Dropdown
          label="Driver"
          value={selectedDriver}
          onChange={setSelectedDriver}
          options={drivers}
          placeholder={loading.drivers ? "Loading drivers..." : "Select driver..."}
          disabled={!selectedSession || loading.drivers}
        />
      </div>
      
      {selectedSession && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 text-sm">
            ✓ Ready to load data for {selectedSession.label}
            {selectedDriver?.value && ` - ${selectedDriver.label}`}
          </p>
        </div>
      )}
    </div>
  );
};

export default Selectors; 