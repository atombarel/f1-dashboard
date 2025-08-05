import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../../../services/f1Api'

export function useLaps(sessionKey) {
  return useQuery({
    queryKey: ['laps', sessionKey],
    queryFn: () => f1Api.getLaps(sessionKey),
    enabled: !!sessionKey
  })
}

export function useStints(sessionKey) {
  return useQuery({
    queryKey: ['stints', sessionKey],
    queryFn: () => f1Api.getStints(sessionKey),
    enabled: !!sessionKey
  })
}