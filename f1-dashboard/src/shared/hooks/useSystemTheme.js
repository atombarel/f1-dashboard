import { useState, useEffect } from 'react'

export function useSystemTheme() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  const [themeSource, setThemeSource] = useState('system') // 'system', 'light', 'dark'

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e) => {
      if (themeSource === 'system') {
        setIsDarkMode(e.matches)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeSource])

  const setTheme = (newTheme) => {
    setThemeSource(newTheme)
    
    if (newTheme === 'system') {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
    } else {
      setIsDarkMode(newTheme === 'dark')
    }
  }

  return {
    isDarkMode,
    themeSource,
    setTheme
  }
}