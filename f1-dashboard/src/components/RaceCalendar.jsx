import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, MapPin, Clock, Users, Flag, Award, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'

const raceCalendar2025 = [
  {
    round: 1,
    name: "Bahrain Grand Prix",
    country: "Bahrain",
    circuit: "Bahrain International Circuit",
    date: "March 2, 2025",
    status: "completed",
    winner: "VER",
    fastestLap: "1:31.895",
    sessions: {
      fp1: "Feb 28, 13:30",
      fp2: "Feb 28, 17:00",
      fp3: "Mar 1, 14:30",
      qualifying: "Mar 1, 18:00",
      race: "Mar 2, 18:00"
    }
  },
  {
    round: 2,
    name: "Saudi Arabian Grand Prix",
    country: "Saudi Arabia",
    circuit: "Jeddah Corniche Circuit",
    date: "March 9, 2025",
    status: "completed",
    winner: "LEC",
    fastestLap: "1:29.018",
    sessions: {
      fp1: "Mar 7, 17:30",
      fp2: "Mar 7, 21:00",
      fp3: "Mar 8, 18:30",
      qualifying: "Mar 8, 22:00",
      race: "Mar 9, 22:00"
    }
  },
  {
    round: 3,
    name: "Australian Grand Prix",
    country: "Australia",
    circuit: "Albert Park Circuit",
    date: "March 23, 2025",
    status: "upcoming",
    sessions: {
      fp1: "Mar 21, 05:30",
      fp2: "Mar 21, 09:00",
      fp3: "Mar 22, 05:30",
      qualifying: "Mar 22, 09:00",
      race: "Mar 23, 08:00"
    }
  },
  {
    round: 4,
    name: "Chinese Grand Prix",
    country: "China",
    circuit: "Shanghai International Circuit",
    date: "April 13, 2025",
    status: "upcoming",
    sessions: {
      fp1: "Apr 11, 11:30",
      fp2: "Apr 11, 15:00",
      fp3: "Apr 12, 11:30",
      qualifying: "Apr 12, 15:00",
      race: "Apr 13, 15:00"
    }
  },
  {
    round: 5,
    name: "Miami Grand Prix",
    country: "United States",
    circuit: "Miami International Autodrome",
    date: "May 4, 2025",
    status: "upcoming",
    sessions: {
      fp1: "May 2, 20:30",
      fp2: "May 3, 00:00",
      fp3: "May 3, 19:30",
      qualifying: "May 3, 23:00",
      race: "May 4, 22:00"
    }
  },
  {
    round: 6,
    name: "Emilia Romagna Grand Prix",
    country: "Italy",
    circuit: "Autodromo Enzo e Dino Ferrari",
    date: "May 18, 2025",
    status: "upcoming",
    sessions: {
      fp1: "May 16, 13:30",
      fp2: "May 16, 17:00",
      fp3: "May 17, 12:30",
      qualifying: "May 17, 16:00",
      race: "May 18, 15:00"
    }
  }
]

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'bg-green-500'
    case 'live': return 'bg-red-500 animate-pulse'
    case 'upcoming': return 'bg-blue-500'
    default: return 'bg-gray-500'
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'completed': return 'Race Complete'
    case 'live': return 'Live Now'
    case 'upcoming': return 'Upcoming'
    default: return 'TBD'
  }
}

export function RaceCalendar() {
  const [selectedRace, setSelectedRace] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(3) // March

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const filteredRaces = raceCalendar2025.filter(race => {
    const raceMonth = new Date(race.date).getMonth() + 1
    return raceMonth === currentMonth
  })

  const nextMonth = () => {
    if (currentMonth < 12) setCurrentMonth(currentMonth + 1)
  }

  const prevMonth = () => {
    if (currentMonth > 1) setCurrentMonth(currentMonth - 1)
  }

  return (
    <div className="space-y-8">
      {/* Calendar Header */}
      <motion.div 
        className="f1-glass-card p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-4xl font-bold text-white mb-2">2025 F1 Calendar</h2>
              <p className="text-gray-400 text-lg">Championship race schedule and results</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={prevMonth}
              className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300"
              disabled={currentMonth === 1}
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl">
              <span className="text-white font-bold text-xl">{monthNames[currentMonth - 1]} 2025</span>
            </div>
            <button
              onClick={nextMonth}
              className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300"
              disabled={currentMonth === 12}
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Race Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredRaces.map((race, index) => (
            <motion.div
              key={race.round}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur border border-white/10 hover:border-red-500/30 transition-all duration-300 cursor-pointer group"
              onClick={() => setSelectedRace(race)}
            >
              {/* Race Status Indicator */}
              <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${getStatusColor(race.status)}`} />
              
              {/* Race Number */}
              <div className="absolute top-4 left-4">
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-black text-lg">{race.round}</span>
                </div>
              </div>

              <div className="p-6 pt-20">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{race.name}</h3>
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">{race.country}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">{race.date}</span>
                    </div>
                    <div className="text-xs text-gray-500">{race.circuit}</div>
                  </div>

                  {race.status === 'completed' && (
                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-400 mb-1">WINNER</div>
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-yellow-500" />
                            <span className="text-white font-bold">{race.winner}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-400 mb-1">FASTEST LAP</div>
                          <div className="text-white font-mono text-sm">{race.fastestLap}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {race.status === 'upcoming' && (
                    <div className="pt-4 border-t border-white/10">
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                        {getStatusText(race.status)}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Hover Animation */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </motion.div>
          ))}
        </div>

        {filteredRaces.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No races in {monthNames[currentMonth - 1]}</h3>
            <p className="text-gray-500">Select a different month to view race schedule</p>
          </div>
        )}
      </motion.div>

      {/* Detailed Race Modal */}
      <AnimatePresence>
        {selectedRace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedRace(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                    <span className="text-white font-black text-2xl">{selectedRace.round}</span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-1">{selectedRace.name}</h2>
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin className="w-5 h-5" />
                      <span>{selectedRace.country}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRace(null)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                  <h3 className="text-xl font-bold text-white mb-4">Circuit Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Circuit</div>
                      <div className="text-white font-medium">{selectedRace.circuit}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Race Date</div>
                      <div className="text-white font-medium">{selectedRace.date}</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                  <h3 className="text-xl font-bold text-white mb-4">Session Schedule</h3>
                  <div className="space-y-3">
                    {Object.entries(selectedRace.sessions).map(([session, time]) => (
                      <div key={session} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-white font-medium capitalize">
                            {session.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </span>
                        </div>
                        <span className="text-gray-400 font-mono text-sm">{time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedRace.status === 'completed' && (
                  <div className="p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl border border-green-500/20">
                    <h3 className="text-xl font-bold text-white mb-4">Race Results</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <Award className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                        <div className="text-gray-400 text-sm mb-1">Race Winner</div>
                        <div className="text-2xl font-bold text-white">{selectedRace.winner}</div>
                      </div>
                      <div className="text-center">
                        <Flag className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                        <div className="text-gray-400 text-sm mb-1">Fastest Lap</div>
                        <div className="text-2xl font-bold text-white font-mono">{selectedRace.fastestLap}</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedRace.status === 'upcoming' && (
                  <div className="p-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20">
                    <div className="text-center">
                      <Play className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-white mb-2">Upcoming Race</h3>
                      <p className="text-gray-400">Session schedule and results will be available closer to race weekend</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}