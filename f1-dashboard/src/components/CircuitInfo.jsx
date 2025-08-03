import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Ruler, Clock, TrendingUp, Gauge, Award, Users, Calendar, ChevronRight, ArrowUpRight } from 'lucide-react'

const circuitData = [
  {
    name: "Bahrain International Circuit",
    country: "Bahrain",
    city: "Sakhir",
    length: "5.412 km",
    turns: 15,
    lapRecord: "1:31.447",
    recordHolder: "Pedro de la Rosa (2005)",
    drsZones: 3,
    capacity: 70000,
    firstRace: 2004,
    characteristics: ["High-speed straights", "Technical middle sector", "Desert environment"],
    difficulty: "Medium",
    trackType: "Permanent",
    elevation: "±7m",
    image: "/api/placeholder/400/300",
    description: "A modern circuit built in the Bahrain desert, featuring a mix of high-speed sections and technical corners.",
    keyCorners: [
      { name: "Turn 1", type: "Hard braking zone", difficulty: "High" },
      { name: "Turn 4", type: "High-speed left", difficulty: "Medium" },
      { name: "Turn 10", type: "Technical chicane", difficulty: "High" }
    ],
    stats: {
      overtakingOpportunities: "High",
      tireWear: "Medium",
      fuelConsumption: "High",
      brakingDemand: "Very High"
    }
  },
  {
    name: "Jeddah Corniche Circuit",
    country: "Saudi Arabia",
    city: "Jeddah",
    length: "6.174 km",
    turns: 27,
    lapRecord: "1:30.734",
    recordHolder: "Lewis Hamilton (2021)",
    drsZones: 3,
    capacity: 50000,
    firstRace: 2021,
    characteristics: ["Longest circuit", "High-speed street circuit", "Minimal run-off areas"],
    difficulty: "Very High",
    trackType: "Street Circuit",
    elevation: "±32m",
    image: "/api/placeholder/400/300",
    description: "The fastest street circuit on the calendar, running along the Red Sea coastline with challenging high-speed corners.",
    keyCorners: [
      { name: "Turn 1", type: "Heavy braking", difficulty: "High" },
      { name: "Turn 13", type: "Blind corner", difficulty: "Very High" },
      { name: "Turn 27", type: "Final corner", difficulty: "Medium" }
    ],
    stats: {
      overtakingOpportunities: "Medium",
      tireWear: "High",
      fuelConsumption: "Very High",
      brakingDemand: "High"
    }
  },
  {
    name: "Albert Park Circuit",
    country: "Australia",
    city: "Melbourne",
    length: "5.278 km",
    turns: 14,
    lapRecord: "1:20.260",
    recordHolder: "Charles Leclerc (2022)",
    drsZones: 4,
    capacity: 125000,
    firstRace: 1996,
    characteristics: ["Park setting", "Wide corners", "Stop-and-go nature"],
    difficulty: "Medium",
    trackType: "Semi-permanent",
    elevation: "±15m",
    image: "/api/placeholder/400/300",
    description: "A picturesque circuit set around Albert Park Lake, known for its unique atmosphere and challenging layout.",
    keyCorners: [
      { name: "Turn 1", type: "90-degree right", difficulty: "Medium" },
      { name: "Turn 6", type: "Chicane", difficulty: "High" },
      { name: "Turn 11-12", type: "Esses", difficulty: "Medium" }
    ],
    stats: {
      overtakingOpportunities: "Medium",
      tireWear: "Medium",
      fuelConsumption: "Medium",
      brakingDemand: "Medium"
    }
  },
  {
    name: "Shanghai International Circuit",
    country: "China",
    city: "Shanghai",
    length: "5.451 km",
    turns: 16,
    lapRecord: "1:32.238",
    recordHolder: "Michael Schumacher (2004)",
    drsZones: 2,
    capacity: 200000,
    firstRace: 2004,
    characteristics: ["Unique corner sequences", "Long back straight", "Technical first sector"],
    difficulty: "High",
    trackType: "Permanent",
    elevation: "±15m",
    image: "/api/placeholder/400/300",
    description: "An intricate circuit designed by Hermann Tilke, featuring the challenging snail-shell section and long straights.",
    keyCorners: [
      { name: "Turn 1-2", type: "Hairpin complex", difficulty: "High" },
      { name: "Turn 7-8", type: "Snail shell", difficulty: "Very High" },
      { name: "Turn 14", type: "Long radius", difficulty: "Medium" }
    ],
    stats: {
      overtakingOpportunities: "High",
      tireWear: "Medium",
      fuelConsumption: "Medium",
      brakingDemand: "High"
    }
  }
]

const getDifficultyColor = (difficulty) => {
  switch (difficulty.toLowerCase()) {
    case 'low': return 'text-green-400 bg-green-500/20'
    case 'medium': return 'text-yellow-400 bg-yellow-500/20'
    case 'high': return 'text-orange-400 bg-orange-500/20'
    case 'very high': return 'text-red-400 bg-red-500/20'
    default: return 'text-gray-400 bg-gray-500/20'
  }
}

const getStatColor = (value) => {
  switch (value.toLowerCase()) {
    case 'low': return 'from-green-500 to-emerald-500'
    case 'medium': return 'from-yellow-500 to-orange-500'
    case 'high': return 'from-orange-500 to-red-500'
    case 'very high': return 'from-red-500 to-red-700'
    default: return 'from-gray-500 to-gray-600'
  }
}

export function CircuitInfo() {
  const [selectedCircuit, setSelectedCircuit] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        className="f1-glass-card p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <MapPin className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-4xl font-bold text-white mb-2">Circuit Guide</h2>
              <p className="text-gray-400 text-lg">Detailed information and analysis for every track</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'grid' 
                  ? 'bg-red-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'list' 
                  ? 'bg-red-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Circuits Grid/List */}
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-8' : 'space-y-6'}>
          {circuitData.map((circuit, index) => (
            <motion.div
              key={circuit.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur border border-white/10 hover:border-purple-500/30 transition-all duration-300 cursor-pointer group"
              onClick={() => setSelectedCircuit(circuit)}
            >
              {/* Circuit Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-gray-700 to-gray-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getDifficultyColor(circuit.difficulty)}`}>
                    {circuit.difficulty}
                  </span>
                </div>
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white">
                    {circuit.trackType}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-xl font-bold text-white mb-1">{circuit.name}</h3>
                  <div className="flex items-center gap-2 text-gray-300">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{circuit.city}, {circuit.country}</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <Ruler className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                    <div className="text-xs text-gray-400 mb-1">LENGTH</div>
                    <div className="text-white font-bold">{circuit.length}</div>
                  </div>
                  <div className="text-center">
                    <TrendingUp className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                    <div className="text-xs text-gray-400 mb-1">TURNS</div>
                    <div className="text-white font-bold">{circuit.turns}</div>
                  </div>
                  <div className="text-center">
                    <Clock className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                    <div className="text-xs text-gray-400 mb-1">LAP RECORD</div>
                    <div className="text-white font-bold font-mono text-sm">{circuit.lapRecord}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-2">KEY CHARACTERISTICS</div>
                    <div className="flex flex-wrap gap-2">
                      {circuit.characteristics.slice(0, 2).map((char, i) => (
                        <span key={i} className="px-2 py-1 bg-white/10 rounded-lg text-xs text-gray-300">
                          {char}
                        </span>
                      ))}
                      {circuit.characteristics.length > 2 && (
                        <span className="px-2 py-1 bg-gray-500/20 rounded-lg text-xs text-gray-400">
                          +{circuit.characteristics.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{circuit.capacity.toLocaleString()} capacity</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                </div>

                {/* Hover Animation */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Detailed Circuit Modal */}
      <AnimatePresence>
        {selectedCircuit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCircuit(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-1">{selectedCircuit.name}</h2>
                      <div className="flex items-center gap-4 text-gray-400">
                        <span>{selectedCircuit.city}, {selectedCircuit.country}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getDifficultyColor(selectedCircuit.difficulty)}`}>
                          {selectedCircuit.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCircuit(null)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Circuit Overview */}
                  <div className="space-y-6">
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Circuit Overview</h3>
                      <p className="text-gray-300 mb-6">{selectedCircuit.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Length</div>
                          <div className="text-white font-bold">{selectedCircuit.length}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Turns</div>
                          <div className="text-white font-bold">{selectedCircuit.turns}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm mb-1">First Race</div>
                          <div className="text-white font-bold">{selectedCircuit.firstRace}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Elevation Change</div>
                          <div className="text-white font-bold">{selectedCircuit.elevation}</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Lap Record</h3>
                      <div className="flex items-center gap-4">
                        <Award className="w-8 h-8 text-yellow-500" />
                        <div>
                          <div className="text-2xl font-bold text-white font-mono">{selectedCircuit.lapRecord}</div>
                          <div className="text-gray-400 text-sm">{selectedCircuit.recordHolder}</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Key Corners</h3>
                      <div className="space-y-3">
                        {selectedCircuit.keyCorners.map((corner, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                            <div>
                              <div className="text-white font-medium">{corner.name}</div>
                              <div className="text-gray-400 text-sm">{corner.type}</div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getDifficultyColor(corner.difficulty)}`}>
                              {corner.difficulty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Circuit Stats */}
                  <div className="space-y-6">
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Performance Characteristics</h3>
                      <div className="space-y-4">
                        {Object.entries(selectedCircuit.stats).map(([stat, value]) => (
                          <div key={stat}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-300 capitalize">{stat.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                              <span className="text-white font-bold">{value}</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full bg-gradient-to-r ${getStatColor(value)}`}
                                style={{ 
                                  width: value === 'Low' ? '25%' : 
                                         value === 'Medium' ? '50%' : 
                                         value === 'High' ? '75%' : '100%'
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Technical Data</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-black/30 rounded-lg">
                          <ArrowUpRight className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                          <div className="text-gray-400 text-sm mb-1">DRS Zones</div>
                          <div className="text-white font-bold text-xl">{selectedCircuit.drsZones}</div>
                        </div>
                        <div className="text-center p-4 bg-black/30 rounded-lg">
                          <Users className="w-6 h-6 text-green-400 mx-auto mb-2" />
                          <div className="text-gray-400 text-sm mb-1">Capacity</div>
                          <div className="text-white font-bold text-xl">{selectedCircuit.capacity.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Characteristics</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCircuit.characteristics.map((char, index) => (
                          <span key={index} className="px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-300 text-sm">
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}