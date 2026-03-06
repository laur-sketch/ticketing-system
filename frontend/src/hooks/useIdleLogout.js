import { useEffect, useRef, useState, useCallback } from 'react'

const IDLE_MS = 2 * 60 * 1000  // 2 minutes total idle threshold
const WARN_MS = 30 * 1000      // show warning 30 seconds before logout

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'input']

/**
 * Detects user inactivity. Shows a 30-second countdown warning at the 1:30 mark,
 * then calls onLogout at the 2:00 mark. Any user activity resets the clock.
 *
 * Returns { countdown } — null when idle timer is running normally,
 * or a number (30→0) during the warning phase.
 */
export function useIdleLogout(onLogout) {
  const [countdown, setCountdown] = useState(null)

  const logoutTimer = useRef(null)
  const warnTimer   = useRef(null)
  const tickTimer   = useRef(null)
  const onLogoutRef = useRef(onLogout)

  useEffect(() => { onLogoutRef.current = onLogout }, [onLogout])

  const clearAllTimers = () => {
    clearTimeout(logoutTimer.current)
    clearTimeout(warnTimer.current)
    clearInterval(tickTimer.current)
  }

  const resetTimers = useCallback(() => {
    clearAllTimers()
    setCountdown(null)

    // At 1:30 — start the visible 30-second countdown
    warnTimer.current = setTimeout(() => {
      let secs = 30
      setCountdown(secs)
      tickTimer.current = setInterval(() => {
        secs -= 1
        setCountdown(secs)
        if (secs <= 0) clearInterval(tickTimer.current)
      }, 1000)
    }, IDLE_MS - WARN_MS)

    // At 2:00 — execute logout
    logoutTimer.current = setTimeout(() => {
      clearAllTimers()
      setCountdown(null)
      onLogoutRef.current()
    }, IDLE_MS)
  }, [])

  useEffect(() => {
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimers, { passive: true }))
    resetTimers()
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimers))
      clearAllTimers()
    }
  }, [resetTimers])

  return { countdown }
}
