import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { api } from '../api/client'

const POLL_INTERVAL = 60_000 // 60-second fallback poll (socket handles real-time)

export function useNotifications() {
  const { user }  = useAuth()
  const socket    = useSocket()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const intervalRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const data = await api.get('/notifications')
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch {
      // silently fail — don't disrupt the UI for background polls
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    fetchNotifications()
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [user, fetchNotifications])

  // Socket: instant push — prepend new notification without waiting for poll
  useEffect(() => {
    if (!socket) return
    const onNotification = (notif) => {
      setNotifications(prev => {
        if (prev.some(n => n.id === notif.id)) return prev
        return [notif, ...prev]
      })
      setUnreadCount(prev => prev + 1)
    }
    socket.on('notification', onNotification)
    return () => socket.off('notification', onNotification)
  }, [socket])

  const markRead = useCallback(async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* ignore */ }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }, [])

  return { notifications, unreadCount, markRead, markAllRead, refresh: fetchNotifications }
}
