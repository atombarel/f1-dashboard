import { useCallback, useEffect, useRef, useState } from 'react'

export const SPEEDS = ['0.5', '1', '2', '4'] as const
export type Speed = (typeof SPEEDS)[number]

/**
 * Playback clock for the ghost laps (seconds since the lap start). Starts paused on `initial`; the first
 * play from there restarts the lap, later plays resume where the user left it.
 */
export function useLapClock(end: number, initial: number) {
  const [t, setT] = useState(initial)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>('1')
  const fresh = useRef(true)
  const tRef = useRef(initial)

  const seek = useCallback(
    (next: number) => {
      fresh.current = false
      tRef.current = Math.max(0, Math.min(end, next))
      setT(tRef.current)
    },
    [end],
  )

  // a new segment (new lap set) resets the clock to its freeze frame
  useEffect(() => {
    fresh.current = true
    tRef.current = initial
    setT(initial)
    setPlaying(false)
  }, [initial, end])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      tRef.current = Math.min(end, tRef.current + dt * Number(speed))
      setT(tRef.current)
      if (tRef.current >= end) setPlaying(false)
      else raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, end])

  useEffect(() => {
    const onVis = () => document.hidden && setPlaying(false)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const toggle = useCallback(() => {
    if (!playing && (fresh.current || tRef.current >= end)) seek(0)
    fresh.current = false
    setPlaying((p) => !p)
  }, [playing, end, seek])

  return { t, playing, speed, setSpeed, seek, toggle, pause: () => setPlaying(false) }
}
