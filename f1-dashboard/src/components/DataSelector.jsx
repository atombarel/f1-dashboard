import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, MapPin, Clock, Flag } from 'lucide-react'
import { f1Api } from '../services/f1Api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { Alert, AlertDescription } from './ui/alert'

export function DataSelector({ onSelectionChange }) {
  const [selectedYear, setSelectedYear] = useState(2025)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)

  const { data: meetings, isLoading: meetingsLoading } = useQuery({
    queryKey: ['meetings', selectedYear],
    queryFn: () => f1Api.getMeetings(selectedYear)
  })

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', selectedMeeting?.meeting_key],
    queryFn: () => f1Api.getSessions(selectedMeeting.meeting_key),
    enabled: !!selectedMeeting
  })

  React.useEffect(() => {
    onSelectionChange({
      year: selectedYear,
      meeting: selectedMeeting,
      session: selectedSession
    })
  }, [selectedYear, selectedMeeting, selectedSession, onSelectionChange])

  const handleYearChange = (year) => {
    setSelectedYear(parseInt(year))
    setSelectedMeeting(null)
    setSelectedSession(null)
  }

  const handleMeetingChange = (meetingKey) => {
    const meeting = meetings?.find(m => m.meeting_key.toString() === meetingKey)
    setSelectedMeeting(meeting)
    setSelectedSession(null)
  }

  const handleSessionChange = (sessionKey) => {
    const session = sessions?.find(s => s.session_key.toString() === sessionKey)
    setSelectedSession(session)
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <div className="p-3 bg-red-100 rounded-xl mr-4">
            <Flag className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Select Race Data</h2>
            <p className="text-gray-600 text-lg mt-1">Choose your season, Grand Prix, and session to start analyzing F1 data</p>
          </div>
        </div>
      </div>
      <div className="space-y-8">
      
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Year Selector */}
          <div className="space-y-4">
            <label className="text-base font-semibold flex items-center text-gray-900">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              Season
            </label>
            <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
              <SelectTrigger className="h-12 bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {[2025, 2024, 2023, 2022, 2021].map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meeting Selector */}
          <div className="space-y-4">
            <label className="text-base font-semibold flex items-center text-gray-900">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              Grand Prix
            </label>
            {meetingsLoading ? (
              <Skeleton className="h-12 w-full bg-gray-200" />
            ) : (
              <Select 
                value={selectedMeeting?.meeting_key?.toString() || ""} 
                onValueChange={handleMeetingChange}
                disabled={!meetings}
              >
                <SelectTrigger className="h-12 bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select Grand Prix" />
                </SelectTrigger>
                <SelectContent>
                  {meetings?.map(meeting => (
                    <SelectItem key={meeting.meeting_key} value={meeting.meeting_key.toString()}>
                      {meeting.meeting_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Session Selector */}
          <div className="space-y-4">
            <label className="text-base font-semibold flex items-center text-gray-900">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              Session
            </label>
            {sessionsLoading ? (
              <Skeleton className="h-12 w-full bg-gray-200" />
            ) : (
              <Select 
                value={selectedSession?.session_key?.toString() || ""} 
                onValueChange={handleSessionChange}
                disabled={!sessions || !selectedMeeting}
              >
                <SelectTrigger className="h-12 bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select Session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions?.map(session => (
                    <SelectItem key={session.session_key} value={session.session_key.toString()}>
                      {session.session_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {selectedSession && (
          <Alert className="border-green-200 bg-green-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="relative mr-4">
                  <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 w-4 h-4 bg-green-500 rounded-full animate-ping opacity-75"></div>
                </div>
                <div>
                  <AlertDescription className="text-green-800 font-semibold text-lg mb-1">
                    {selectedSession.session_name} - {selectedMeeting?.meeting_name}
                  </AlertDescription>
                  <p className="text-green-700 text-base">{selectedYear} Season • Ready for analysis</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800 px-3 py-1">
                ✓ Connected
              </Badge>
            </div>
          </Alert>
        )}
      </div>
    </div>
  )
}