import { useState, useCallback, useRef, useEffect } from 'react'
import { Outlet, useNavigate, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useIdleLogout } from '../hooks/useIdleLogout'
import { useNotifications } from '../hooks/useNotifications'
import { useSocket } from '../context/SocketContext'
import NotificationPanel from './NotificationPanel'
import RecentChatsPanel from './RecentChatsPanel'

export default function Layout() {
  const { user, logout }                                      = useAuth()
  const { addToast }                                          = useToast()
  const navigate                                              = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [notifOpen, setNotifOpen]       = useState(false)
  const [chatOpen, setChatOpen]         = useState(false)
  const [unreadChat, setUnreadChat]     = useState(0)
  const [accountOpen, setAccountOpen]   = useState(false)
  const bellRef                         = useRef(null)
  const chatRef                         = useRef(null)
  const accountRef                      = useRef(null)
  const socket                          = useSocket()

  // Close account dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Count incoming direct messages from others when panel is closed
  useEffect(() => {
    if (!socket) return
    const onDm = (msg) => {
      if (msg.author?.id === user?.id) return   // ignore own messages
      if (!chatOpen) setUnreadChat(prev => prev + 1)
    }
    socket.on('dm_message', onDm)
    return () => socket.off('dm_message', onDm)
  }, [socket, user, chatOpen])

  const handleIdleLogout = useCallback(async () => {
    try { await logout() } catch (_) {}
    addToast('You were automatically signed out due to inactivity.', 'warning')
    navigate('/login', { replace: true })
  }, [logout, addToast, navigate])

  const { countdown } = useIdleLogout(handleIdleLogout)

  const handleLogout = async () => {
    await logout()
    addToast('You have been signed out.', 'info')
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar — dark, matching sidebar */}
        <header className="flex-shrink-0 h-14 bg-blue-950 border-b border-blue-900 flex items-center justify-end px-6 gap-1.5 z-30">

          {/* Live Chat button */}
          <div className="relative" ref={chatRef}>
            <button
              onClick={() => { setChatOpen(prev => !prev); setUnreadChat(0) }}
              className="relative p-2 rounded-lg text-blue-200 hover:bg-blue-900 hover:text-blue-50 transition-colors"
              aria-label="Live Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {unreadChat > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                  {unreadChat > 99 ? '99+' : unreadChat}
                </span>
              )}
            </button>

            {chatOpen && (
              <RecentChatsPanel onClose={() => setChatOpen(false)} />
            )}
          </div>

          {/* Notification bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setNotifOpen(prev => !prev)}
              className="relative p-2 rounded-lg text-blue-200 hover:bg-blue-900 hover:text-blue-50 transition-colors"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <NotificationPanel
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={markRead}
                onMarkAllRead={markAllRead}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </div>

          {/* Divider */}
          <div className="h-7 w-px bg-blue-800 mx-1" />

          {/* Account dropdown */}
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => setAccountOpen(prev => !prev)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                {user?.initials}
              </div>
              <div className="text-left leading-tight">
                <p className="text-sm font-semibold text-white">{user?.username}</p>
                <p className="text-[11px] text-blue-200/90">{user?.role_label}</p>
              </div>
              <svg className={`w-4 h-4 text-blue-200/90 transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {accountOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-blue-50 rounded-xl shadow-xl border border-blue-200 py-1 z-50">
                <div className="px-4 py-2.5 border-b border-blue-200">
                  <p className="text-sm font-semibold text-slate-800 truncate">{user?.username}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.role_label}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-4 h-4 text-blue-200/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Account Settings
                </Link>
                <div className="my-1 border-t border-blue-200" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Idle warning banner */}
        {countdown !== null && (
          <div className="flex items-center justify-between gap-4 bg-amber-50 border-b border-amber-200 px-5 py-2.5 z-40">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-600 animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium text-amber-800">
                Session expiring — you'll be signed out in{' '}
                <span className="font-bold tabular-nums text-amber-900">{countdown}s</span>
                {' '}due to inactivity.
              </p>
            </div>
            <p className="text-xs text-amber-700 flex-shrink-0">Move your mouse or press any key to stay signed in.</p>
          </div>
        )}

        <Outlet />
      </div>
    </div>
  )
}
