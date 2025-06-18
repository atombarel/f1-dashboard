import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, TrendingDown, TrendingUp, Timer } from 'lucide-react';
import { openf1Api } from '../services/openf1Api';

const LapTimes = ({ sessionKey, driverNumber }) => {
  const [lapData, setLapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => {
    if (sessionKey) {
      setLoading(true);
      
      openf1Api.getLaps(sessionKey, driverNumber)
        .then(data => {
          // Process lap data
          const processedData = data
            .sort((a, b) => a.lap_number - b.lap_number)
            .map(lap => ({
              lap_number: lap.lap_number,
              lap_time: lap.lap_duration,
              sector_1: lap.duration_sector_1,
              sector_2: lap.duration_sector_2,
              sector_3: lap.duration_sector_3,
              is_pit_out_lap: lap.is_pit_out_lap,
              i1_speed: lap.i1_speed,
              i2_speed: lap.i2_speed,
              st_speed: lap.st_speed,
              driver_number: lap.driver_number,
            }))
            .filter(lap => lap.lap_time && lap.lap_time > 0);
            
          setLapData(processedData);
        })
        .catch(error => {
          console.error('Failed to load lap data:', error);
          setLapData([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [sessionKey, driverNumber]);

  const formatTime = (seconds) => {
    if (!seconds) return '--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(3);
    return `${minutes}:${remainingSeconds.padStart(6, '0')}`;
  };

  const getBestLap = () => {
    if (lapData.length === 0) return null;
    return lapData.reduce((best, current) => 
      current.lap_time < best.lap_time ? current : best
    );
  };

  const getAverageLapTime = () => {
    if (lapData.length === 0) return 0;
    const total = lapData.reduce((sum, lap) => sum + lap.lap_time, 0);
    return total / lapData.length;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-effect rounded-lg p-3 border border-white/20">
          <p className="text-white font-medium mb-2">{`Lap ${label}`}</p>
          <p className="text-blue-400 text-sm">
            Lap Time: {formatTime(data.lap_time)}
          </p>
          <p className="text-green-400 text-sm">
            Sector 1: {formatTime(data.sector_1)}
          </p>
          <p className="text-yellow-400 text-sm">
            Sector 2: {formatTime(data.sector_2)}
          </p>
          <p className="text-red-400 text-sm">
            Sector 3: {formatTime(data.sector_3)}
          </p>
          {data.is_pit_out_lap && (
            <p className="text-orange-400 text-sm mt-1">Pit Out Lap</p>
          )}
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-gray-300 text-xs">
              Speed Trap: {data.st_speed} km/h
            </p>
          </div>
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
          <span className="ml-3 text-white">Loading lap times...</span>
        </div>
      </div>
    );
  }

  const bestLap = getBestLap();
  const avgLapTime = getAverageLapTime();

  return (
    <div className="glass-effect rounded-xl p-6">
      <h3 className="text-xl font-bold text-white mb-6">Lap Times Analysis</h3>
      
      {lapData.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No lap data available</p>
          <p className="text-gray-500 text-sm">Select a session to view lap times</p>
        </div>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="glass-effect rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Best Lap</p>
                  <p className="text-white text-lg font-bold">
                    {bestLap ? formatTime(bestLap.lap_time) : '--'}
                  </p>
                  <p className="text-green-400 text-sm">
                    {bestLap ? `Lap ${bestLap.lap_number}` : ''}
                  </p>
                </div>
                <TrendingDown className="w-8 h-8 text-green-400" />
              </div>
            </div>
            
            <div className="glass-effect rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Average Lap</p>
                  <p className="text-white text-lg font-bold">
                    {formatTime(avgLapTime)}
                  </p>
                  <p className="text-blue-400 text-sm">
                    {lapData.length} laps
                  </p>
                </div>
                <Timer className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            
            <div className="glass-effect rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Laps</p>
                  <p className="text-white text-lg font-bold">{lapData.length}</p>
                  <p className="text-purple-400 text-sm">
                    {lapData.filter(lap => lap.is_pit_out_lap).length} pit out
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Lap Times Chart */}
          <div className="h-96 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lapData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="lap_number" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  tick={{ fill: '#9CA3AF' }}
                  tickFormatter={formatTime}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#9CA3AF' }} />
                
                <Bar 
                  dataKey="lap_time" 
                  fill="#0891b2"
                  name="Lap Time"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Lap Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-2 text-gray-400">Lap</th>
                  <th className="text-left py-3 px-2 text-gray-400">Time</th>
                  <th className="text-left py-3 px-2 text-gray-400">S1</th>
                  <th className="text-left py-3 px-2 text-gray-400">S2</th>
                  <th className="text-left py-3 px-2 text-gray-400">S3</th>
                  <th className="text-left py-3 px-2 text-gray-400">Speed Trap</th>
                  <th className="text-left py-3 px-2 text-gray-400">Notes</th>
                </tr>
              </thead>
              <tbody>
                {lapData.slice(0, 20).map((lap) => (
                  <tr 
                    key={lap.lap_number} 
                    className={`border-b border-white/5 hover:bg-white/5 ${
                      lap.lap_number === bestLap?.lap_number ? 'bg-green-500/10' : ''
                    }`}
                  >
                    <td className="py-2 px-2 text-white font-medium">
                      {lap.lap_number}
                    </td>
                    <td className={`py-2 px-2 ${
                      lap.lap_number === bestLap?.lap_number ? 'text-green-400 font-bold' : 'text-white'
                    }`}>
                      {formatTime(lap.lap_time)}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {formatTime(lap.sector_1)}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {formatTime(lap.sector_2)}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {formatTime(lap.sector_3)}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {lap.st_speed || '--'} km/h
                    </td>
                    <td className="py-2 px-2">
                      {lap.is_pit_out_lap && (
                        <span className="text-orange-400 text-xs bg-orange-400/20 px-2 py-1 rounded">
                          Pit Out
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {lapData.length > 20 && (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">
                  Showing first 20 laps of {lapData.length} total
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LapTimes; 