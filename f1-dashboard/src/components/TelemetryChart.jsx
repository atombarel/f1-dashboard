import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Gauge, Zap, RotateCcw } from 'lucide-react';
import { openf1Api } from '../services/openf1Api';

const TelemetryChart = ({ sessionKey, driverNumber }) => {
  const [carData, setCarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState({
    speed: true,
    throttle: true,
    brake: false,
    rpm: false,
  });

  const metrics = [
    { key: 'speed', label: 'Speed (km/h)', color: '#00D2BE', icon: Gauge },
    { key: 'throttle', label: 'Throttle (%)', color: '#00FF00', icon: Zap },
    { key: 'brake', label: 'Brake (%)', color: '#FF0000', icon: Activity },
    { key: 'rpm', label: 'RPM', color: '#FF8700', icon: RotateCcw },
  ];

  useEffect(() => {
    if (sessionKey) {
      setLoading(true);
      setCarData([]); // Clear previous data
      
      openf1Api.getCarData(sessionKey, driverNumber)
        .then(data => {
          // Check if data is valid
          if (!Array.isArray(data) || data.length === 0) {
            setCarData([]);
            return;
          }
          
          // Process and format the data for charting
          const processedData = data
            .filter(item => item && item.date) // Filter out invalid entries
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((item, index) => ({
              index,
              time: new Date(item.date).toLocaleTimeString(),
              speed: item.speed || 0,
              throttle: item.throttle || 0,
              brake: item.brake || 0, // Keep the actual brake value
              rpm: item.rpm || 0,
              gear: item.n_gear || 0,
              drs: item.drs >= 10 ? 'DRS ON' : 'DRS OFF',
              driver: item.driver_number,
            }))
            .filter(item => !isNaN(item.speed) && !isNaN(item.throttle)) // Filter out NaN values
            .slice(0, 500); // Limit to 500 points for performance
            
          setCarData(processedData);
          
          // Debug: Log sample data points to see structure
          if (processedData.length > 0) {
            console.log('Sample data point:', processedData[0]);
            console.log('Data has speed values:', processedData.some(item => item.speed > 0));
            console.log('Data has throttle values:', processedData.some(item => item.throttle > 0));
            console.log('Speed range:', {
              min: Math.min(...processedData.map(item => item.speed)),
              max: Math.max(...processedData.map(item => item.speed))
            });
          }
        })
        .catch(error => {
          setCarData([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setCarData([]);
      setLoading(false);
    }
  }, [sessionKey, driverNumber]);

  const toggleMetric = (metricKey) => {
    setSelectedMetrics(prev => ({
      ...prev,
      [metricKey]: !prev[metricKey]
    }));
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-effect rounded-lg p-3 border border-white/20">
          <p className="text-white font-medium mb-2">{`Time: ${data.time}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${entry.value}${entry.name.includes('Speed') ? ' km/h' : entry.name.includes('RPM') ? '' : '%'}`}
            </p>
          ))}
          {data.gear && (
            <p className="text-gray-300 text-sm mt-1">
              Gear: {data.gear} | DRS: {data.drs}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="glass-effect rounded-xl p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-f1-red"></div>
          <span className="ml-3 text-white">Loading telemetry data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-effect rounded-xl p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <h3 className="text-xl font-bold text-white mb-4 lg:mb-0">
          Car Telemetry Data
        </h3>
        
        <div className="flex flex-wrap gap-2">
          {metrics.map(({ key, label, color, icon: Icon }) => (
            <button
              key={key}
              onClick={() => toggleMetric(key)}
              className={`flex items-center px-3 py-2 rounded-lg border transition-all duration-200 ${
                selectedMetrics[key]
                  ? 'bg-white/10 border-white/30 text-white'
                  : 'border-white/20 text-gray-400 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              <span className="text-sm">{label}</span>
              <div 
                className="w-3 h-3 rounded-full ml-2"
                style={{ backgroundColor: selectedMetrics[key] ? color : 'transparent' }}
              />
            </button>
          ))}
        </div>
      </div>

      {carData.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No telemetry data available</p>
          <p className="text-gray-500 text-sm">Select a session and driver to view car data</p>
        </div>
      ) : (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={carData} 
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="index" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                type="number"
              />
              <YAxis 
                stroke="#9CA3AF" 
                tick={{ fill: '#9CA3AF' }}
                domain={[0, 'dataMax + 10']}
                allowDataOverflow={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9CA3AF' }} />
              
              {/* Test line to verify chart is working */}
              <Line
                type="monotone"
                dataKey="index"
                stroke="#FFD700"
                strokeWidth={1}
                dot={false}
                name="Test (Index)"
                connectNulls={false}
                isAnimationActive={false}
              />
              
              {selectedMetrics.speed && carData.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="speed"
                  stroke="#00D2BE"
                  strokeWidth={2}
                  dot={false}
                  name="Speed"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              
              {selectedMetrics.throttle && carData.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="throttle"
                  stroke="#00FF00"
                  strokeWidth={2}
                  dot={false}
                  name="Throttle"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              
              {selectedMetrics.brake && carData.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="brake"
                  stroke="#FF0000"
                  strokeWidth={2}
                  dot={false}
                  name="Brake"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              
              {selectedMetrics.rpm && carData.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="rpm"
                  stroke="#FF8700"
                  strokeWidth={2}
                  dot={false}
                  name="RPM"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {carData.length > 0 && (
        <div className="mt-4 text-sm text-gray-400">
          Showing {carData.length} data points
          {driverNumber && (
            <span className="ml-2">for driver #{driverNumber}</span>
          )}
          <div className="mt-2 text-xs">
            Debug: Speed values {carData.some(item => item.speed > 0) ? '✓' : '✗'} | 
            Throttle values {carData.some(item => item.throttle > 0) ? '✓' : '✗'} | 
            Sample: {carData[0] ? `Speed: ${carData[0].speed}, Throttle: ${carData[0].throttle}` : 'No data'}
          </div>
        </div>
      )}
    </div>
  );
};

export default TelemetryChart; 