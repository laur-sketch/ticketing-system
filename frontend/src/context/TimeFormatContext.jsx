import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'tf_clock_format'

const TimeFormatContext = createContext(null)

export function TimeFormatProvider({ children }) {
  const [is24h, setIs24h] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) !== '12h'  // default: 24h
  })

  const toggle = useCallback(() => {
    setIs24h(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '24h' : '12h')
      return next
    })
  }, [])

  /** Format just the time portion of an ISO string. */
  const fmtTime = useCallback((iso) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', {
      hour:   '2-digit',
      minute: '2-digit',
      hour12: !is24h,
    })
  }, [is24h])

  /** Format time + short date (used in chat bubbles). */
  const fmtDateTime = useCallback((iso) => {
    const d = new Date(iso)
    const time = d.toLocaleTimeString('en-US', {
      hour:   '2-digit',
      minute: '2-digit',
      hour12: !is24h,
    })
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${time} · ${date}`
  }, [is24h])

  return (
    <TimeFormatContext.Provider value={{ is24h, toggle, fmtTime, fmtDateTime }}>
      {children}
    </TimeFormatContext.Provider>
  )
}

export function useTimeFormat() {
  const ctx = useContext(TimeFormatContext)
  if (!ctx) throw new Error('useTimeFormat must be used inside TimeFormatProvider')
  return ctx
}
