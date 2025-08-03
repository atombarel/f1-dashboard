import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../../../services/f1Api'

export function useSessionResults(sessionKey) {
  return useQuery({
    queryKey: ['sessionResults', sessionKey],
    queryFn: () => f1Api.getSessionResults(sessionKey),
    enabled: !!sessionKey
  })
}

export function useStartingGrid(sessionKey) {
  return useQuery({
    queryKey: ['startingGrid', sessionKey],
    queryFn: () => f1Api.getStartingGrid(sessionKey),
    enabled: !!sessionKey
  })
}