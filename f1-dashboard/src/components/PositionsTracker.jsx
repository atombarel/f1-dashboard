import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, Users, TrendingUp } from 'lucide-react';
import { openf1Api } from '../services/openf1Api';

const PositionsTracker = ({ sessionKey }) => {
  const [positionData, setPositionData] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Team colors for consistent visualization
  const teamColors = {
    'Red Bull Racing': '#0600EF',
    'Mercedes': '#00D2BE',
    'Ferrari': '#DC143C',
    'McLaren': '#FF8700',
    'Alpine': '#0090FF',
    'Alfa Romeo': '#900000',
    'Haas F1 Team': '#FFFFFF',
    'AlphaTauri': '#2B4562',
    'Williams': '#005AFF',
    'Aston Martin': '#006F62',
  };

  const getRandomColor = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  useEffect(() => {
    if (sessionKey) {
      setLoading(true);
      
      Promise.all([
        openf1Api.getPositions(sessionKey),
        openf1Api.getDrivers(sessionKey)
      ])
        .then(([positions, driversData]) => {
          // Create driver lookup
          const driverLookup = {};
          driversData.forEach(driver => {
            driverLookup[driver.driver_number] = {
              ...driver,
              color: teamColors[driver.team_name] || getRandomColor()
            };
          });
          setDrivers(driverLookup);

          // Process position data
          const positionsByTime = {};
          
          positions.forEach(pos => {
            const timeKey = new Date(pos.date).getTime();
            if (!positionsByTime[timeKey]) {
              positionsByTime[timeKey] = {
                time: new Date(pos.date).toLocaleTimeString(),
                timestamp: timeKey,
              };
            }
            positionsByTime[timeKey][`driver_${pos.driver_number}`] = pos.position;
          });

          // Convert to array and sort by time
          const processedData = Object.values(positionsByTime)
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, 100); // Limit to 100 data points for performance

          setPositionData(processedData);
        })
        .catch(error => {
          console.error('Failed to load position data:', error);
          setPositionData([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [sessionKey]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-effect rounded-lg p-3 border border-white/20">
          <p className="text-white font-medium mb-2">{`Time: ${label}`}</p>
          {payload
            .sort((a, b) => a.value - b.value)
            .slice(0, 10) // Show top 10 positions
            .map((entry, index) => {
              const driverNumber = entry.dataKey.replace('driver_', '');
              const driver = drivers[driverNumber];
              return (
                <p key={index} style={{ color: entry.color }} className="text-sm">
                  {`P${entry.value}: ${driver?.name_acronym || `#${driverNumber}`}`}
                </p>
              );
            })}
        </div>
      );
    }
    return null;
  };

  const getCurrentStandings = () => {
    if (positionData.length === 0) return [];
    
    const latestData = positionData[positionData.length - 1];
    const standings = [];
    
    Object.keys(latestData).forEach(key => {
      if (key.startsWith('driver_')) {
        const driverNumber = key.replace('driver_', '');
        const position = latestData[key];
        const driver = drivers[driverNumber];
        
        if (driver && position) {
          standings.push({
            position,
            driverNumber,
            driver
          });
        }
      }
    });
    
    return standings.sort((a, b) => a.position - b.position);
  };

  if (loading) {
    return (
      <div className="glass-effect rounded-xl p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-f1-red"></div>
          <span className="ml-3 text-white">Loading position data...</span>
        </div>
      </div>
    );
  }

  const currentStandings = getCurrentStandings();

  return (
    <div className="space-y-6">
      {/* Current Standings */}
      <div className="glass-effect rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center">
          <Trophy className="w-6 h-6 mr-2 text-yellow-400" />
          Current Positions
        </h3>
        
        {currentStandings.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No position data available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {currentStandings.slice(0, 12).map(({ position, driver }) => (
              <div 
                key={driver.driver_number}
                className="glass-effect rounded-lg p-3 flex items-center space-x-3"
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: driver.color }}
                >
                  P{position}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {driver.name_acronym}
                  </p>
                  <p className="text-gray-400 text-xs truncate">
                    {driver.team_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Position Chart */}
      <div className="glass-effect rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center">
          <TrendingUp className="w-6 h-6 mr-2 text-blue-400" />
          Position Changes Over Time
        </h3>
        
        {positionData.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No position tracking data available</p>
            <p className="text-gray-500 text-sm">Select a race session to view position changes</p>
          </div>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={positionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="time" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  tick={{ fill: '#9CA3AF' }}
                  domain={[1, 20]}
                  reversed={true}
                  label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#9CA3AF' } }}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {Object.keys(drivers).slice(0, 10).map((driverNumber) => {
                  const driver = drivers[driverNumber];
                  return (
                    <Line
                      key={driverNumber}
                      type="monotone"
                      dataKey={`driver_${driverNumber}`}
                      stroke={driver.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      name={driver.name_acronym}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {positionData.length > 0 && (
          <div className="mt-4 text-sm text-gray-400">
            Showing position changes over {positionData.length} time points
            {Object.keys(drivers).length > 10 && (
              <span className="ml-2">(displaying top 10 drivers for clarity)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionsTracker; 