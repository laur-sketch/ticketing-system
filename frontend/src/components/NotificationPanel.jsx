import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTimeFormat } from '../context/TimeFormatContext'

const TYPE_META = {
  assigned: {
    label: 'Assigned',
    bg:    'bg-blue-100',
    text:  'text-blue-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  resolved: {
    label: 'Resolved',
    bg:    'bg-green-100',
    text:  'text-green-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
}

function relativeAgo(isoString) {
  const diff = (Date.now() - new Date(isoString)) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationPanel({ notifications, unreadCount, onMarkRead, onMarkAllRead, onClose }) {
  const navigate        = useNavigate()
  const panelRef        = useRef(null)
  const { fmtTime }     = useTimeFormat()

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) onMarkRead(notif.id)
    onClose()
    navigate(`/tickets/${notif.ticket_id}`)
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col"
      style={{ maxHeight: '26rem' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <ul className="overflow-y-auto flex-1 divide-y divide-gray-50">
        {notifications.length === 0 ? (
          <li className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
            <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-sm">No notifications yet</span>
          </li>
        ) : (
          notifications.map(notif => {
            const meta = TYPE_META[notif.type] || TYPE_META.assigned
            return (
              <li
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${!notif.is_read ? 'bg-blue-50/60' : ''}`}
              >
                {/* Type icon */}
                <div className={`mt-0.5 w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${meta.bg} ${meta.text}`}>
                  {meta.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${notif.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-gray-400">{notif.ticket_id}</span>
                    <span className="text-[10px] text-gray-400">·</span>
                    <span className="text-[10px] text-gray-400 tabular-nums" title={fmtTime(notif.created_at)}>
                      {fmtTime(notif.created_at)}
                    </span>
                    <span className="text-[10px] text-gray-300">({relativeAgo(notif.created_at)})</span>
                  </div>
                </div>

                {/* Unread dot */}
                {!notif.is_read && (
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
