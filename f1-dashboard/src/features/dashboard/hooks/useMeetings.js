import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../../../services/f1Api'

export function useMeetings(year) {
  return useQuery({
    queryKey: ['meetings', year],
    queryFn: () => f1Api.getMeetings(parseInt(year)),
    enabled: !!year
  })
}

export function useSessions(meetingKey) {
  return useQuery({
    queryKey: ['sessions', meetingKey],
    queryFn: () => f1Api.getSessions(meetingKey),
    enabled: !!meetingKey
  })
}

export function useDrivers(sessionKey) {
  return useQuery({
    queryKey: ['drivers', sessionKey],
    queryFn: () => f1Api.getDrivers(sessionKey),
    enabled: !!sessionKey
  })
}