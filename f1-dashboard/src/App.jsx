import React, { useState, useCallback } from 'react';
import { Car, BarChart3, TrendingUp, Radio } from 'lucide-react';
import Selectors from './components/Selectors';
import TelemetryChart from './components/TelemetryChart';
import LapTimes from './components/LapTimes';
import PositionsTracker from './components/PositionsTracker';

function App() {
  const [selectedData, setSelectedData] = useState({
    year: null,
    meeting: null,
    session: null,
    driver: null,
  });

  const [activeTab, setActiveTab] = useState('telemetry');

  const handleSelectionChange = useCallback((newSelection) => {
    console.log('Selection changed:', newSelection);
    setSelectedData(newSelection);
  }, []);

  const tabs = [
    { id: 'telemetry', label: 'Telemetry', icon: Car },
    { id: 'laptimes', label: 'Lap Times', icon: BarChart3 },
    { id: 'positions', label: 'Positions', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2">
            <span className="f1-gradient bg-clip-text text-transparent">F1</span> Data Dashboard
          </h1>
          <p className="text-gray-400 text-lg">
            Real-time Formula 1 data visualization powered by OpenF1 API
          </p>
        </header>

        {/* Selectors */}
        <Selectors onSelectionChange={handleSelectionChange} />

        {/* Tab Navigation */}
        <div className="glass-effect rounded-xl p-2 mb-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === id
                    ? 'f1-gradient text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="space-y-6">
          {activeTab === 'telemetry' && (
            <>
              {console.log('Rendering TelemetryChart with props:', {
                sessionKey: selectedData.session?.value,
                driverNumber: selectedData.driver?.value,
                selectedData
              })}
              <TelemetryChart
                sessionKey={selectedData.session?.value}
                driverNumber={selectedData.driver?.value}
              />
            </>
          )}

          {activeTab === 'laptimes' && (
            <LapTimes
              sessionKey={selectedData.session?.value}
              driverNumber={selectedData.driver?.value}
            />
          )}

          {activeTab === 'positions' && (
            <PositionsTracker
              sessionKey={selectedData.session?.value}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <div className="glass-effect rounded-xl p-6">
            <p className="text-gray-400 mb-2">
              Powered by{' '}
              <a
                href="https://openf1.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-f1-red hover:text-red-400 transition-colors"
              >
                OpenF1 API
              </a>
            </p>
            <p className="text-gray-500 text-sm">
              Formula 1 data visualization dashboard - Built with React & Tailwind CSS
            </p>
            <div className="flex justify-center items-center mt-4 space-x-4">
              <div className="flex items-center text-gray-500 text-sm">
                <Radio className="w-4 h-4 mr-1" />
                Real-time data
              </div>
              <div className="flex items-center text-gray-500 text-sm">
                <BarChart3 className="w-4 h-4 mr-1" />
                Interactive charts
              </div>
              <div className="flex items-center text-gray-500 text-sm">
                <Car className="w-4 h-4 mr-1" />
                Car telemetry
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
