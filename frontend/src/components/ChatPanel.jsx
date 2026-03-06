import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { api } from '../api/client'
import AddParticipantPopover from './AddParticipantPopover'

function timeStamp(iso) {
  const d = new Date(iso)
  return (
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) +
    ' · ' +
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  )
}

const ROLE_PILL = {
  admin:      'bg-blue-100 text-blue-700',
  it_support: 'bg-cyan-100 text-cyan-700',
}

const ROLE_COLOR = {
  admin:      'bg-blue-500',
  it_support: 'bg-cyan-500',
  user:       'bg-slate-400',
}

function Avatar({ user, size = 'sm', tooltip = true }) {
  const sz = size === 'xs' ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-xs'
  const bg = ROLE_COLOR[user.role] || 'bg-slate-400'
  return (
    <div
      title={tooltip ? `${user.username} (${user.role_label})` : undefined}
      className={`${sz} ${bg} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 cursor-default`}
    >
      {user.initials}
    </div>
  )
}


/* ── Participants Strip ───────────────────────────────────────────────────── */
function ParticipantsStrip({ ticketId, currentUserId, isArchived }) {
  const [participants,    setParticipants]    = useState([])
  const [showAdd,         setShowAdd]         = useState(false)
  const [removing,        setRemoving]        = useState(null)
  const socket     = useSocket()
  const stripRef   = useRef(null)

  const load = useCallback(() => {
    api.get(`/tickets/${ticketId}/chat/participants`)
      .then(d => setParticipants(d.participants))
      .catch(() => {})
  }, [ticketId])

  useEffect(() => { load() }, [load])

  // Close add-popover on outside click
  useEffect(() => {
    if (!showAdd) return
    const handler = (e) => {
      if (stripRef.current && !stripRef.current.contains(e.target)) setShowAdd(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAdd])

  // Real-time: participant added / removed by others
  useEffect(() => {
    if (!socket) return
    const onAdded   = (p) => setParticipants(prev => {
      if (prev.find(x => x.id === p.id)) return prev
      return [...prev, p]
    })
    const onRemoved = ({ user_id }) => setParticipants(prev => prev.filter(p => p.user.id !== user_id))
    socket.on('participant_added',   onAdded)
    socket.on('participant_removed', onRemoved)
    return () => {
      socket.off('participant_added',   onAdded)
      socket.off('participant_removed', onRemoved)
    }
  }, [socket])

  const remove = async (p) => {
    if (!confirm(`Remove ${p.user.username} from this conversation?`)) return
    setRemoving(p.user.id)
    try {
      await api.delete(`/tickets/${ticketId}/chat/participants/${p.user.id}`)
      setParticipants(prev => prev.filter(x => x.id !== p.id))
    } catch (e) {
      alert(e?.message || 'Could not remove participant')
    } finally { setRemoving(null) }
  }

  // IDs to exclude from the add dropdown: participants + logged-in user (backend also excludes)
  const existingIds = participants.map(p => p.user.id)

  return (
    <div ref={stripRef} className="relative flex items-center gap-1.5 flex-wrap">
      {participants.map(p => (
        <div key={p.id} className="group relative flex items-center">
          <div
            title={`${p.user.username} (${p.user.role_label}) — added by ${p.added_by.username}`}
            className={`w-6 h-6 ${ROLE_COLOR[p.user.role] || 'bg-slate-400'} rounded-full flex items-center
                        justify-center text-white text-[9px] font-bold cursor-default`}
          >
            {p.user.initials}
          </div>
          {!isArchived && (
            <button
              onClick={() => remove(p)}
              disabled={removing === p.user.id}
              className="absolute -top-1 -right-1 hidden group-hover:flex w-3.5 h-3.5 bg-rose-500 text-white
                         rounded-full items-center justify-center text-[8px] leading-none hover:bg-rose-600 transition-colors"
              title={`Remove ${p.user.username}`}
            >
              ×
            </button>
          )}
        </div>
      ))}

      {participants.length === 0 && !isArchived && (
        <span className="text-[10px] text-slate-400 italic">No extra participants</span>
      )}

      {!isArchived && (
        <button
          onClick={() => setShowAdd(v => !v)}
          className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 hover:border-blue-400
                     flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors"
          title="Add participant"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {showAdd && (
        <AddParticipantPopover
          ticketId={ticketId}
          existingIds={existingIds}
          onAdded={() => setShowAdd(false)}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

/* ── ChatPanel (main export) ─────────────────────────────────────────────── */
export default function ChatPanel({ ticketId, isArchived = false }) {
  const { user }                    = useAuth()
  const socket                      = useSocket()
  const [messages,  setMessages]    = useState([])
  const [input,     setInput]       = useState('')
  const [connected, setConnected]   = useState(false)
  const bottomRef                   = useRef(null)
  const addedIds                    = useRef(new Set())

  // Load history
  useEffect(() => {
    api.get(`/tickets/${ticketId}/chat`)
      .then(d => {
        setMessages(d.messages)
        d.messages.forEach(m => addedIds.current.add(m.id))
      })
      .catch(() => {})
  }, [ticketId])

  // Socket events
  useEffect(() => {
    if (!socket) return
    setConnected(socket.connected)

    const onConnect    = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onMessage    = (msg) => {
      if (addedIds.current.has(msg.id)) return
      addedIds.current.add(msg.id)
      setMessages(prev => [...prev, msg])
    }

    socket.on('connect',      onConnect)
    socket.on('disconnect',   onDisconnect)
    socket.on('chat_message', onMessage)

    return () => {
      socket.off('connect',      onConnect)
      socket.off('disconnect',   onDisconnect)
      socket.off('chat_message', onMessage)
    }
  }, [socket])

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !socket?.connected) return
    socket.emit('send_chat', { ticket_id: ticketId, content: text })
    setInput('')
  }

  const isMine = (msg) => msg.author.id === user?.id

  return (
    <div className="card flex flex-col" style={{ height: '460px' }}>
      {/* Header — includes participants + add button */}
      <div className="card-header flex items-center gap-3 py-3">
        {/* Title */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-800">Live Chat</h3>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-200 flex-shrink-0" />

        {/* Participants strip — inline in header */}
        <div className="flex-1 min-w-0">
          <ParticipantsStrip
            ticketId={ticketId}
            currentUserId={user?.id}
            isArchived={isArchived}
          />
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-blue-400' : 'bg-slate-300'}`} />
          <span className="text-xs text-slate-400">{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <svg className="w-8 h-8 text-slate-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs text-slate-400">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          messages.map(msg => {
            /* System event (participant added/removed) */
            if (msg.is_system) {
              return (
                <div key={msg.id} className="flex items-center gap-2 py-0.5">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] text-slate-400 whitespace-nowrap px-2">{msg.content}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              )
            }

            const mine = isMine(msg)
            return (
              <div key={msg.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5
                  ${mine ? 'bg-blue-600 text-white' : (ROLE_COLOR[msg.author.role] || 'bg-slate-200') + ' text-white'}`}>
                  {msg.author.initials}
                </div>

                {/* Bubble */}
                <div className={`max-w-[72%] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!mine && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700">{msg.author.username}</span>
                      {ROLE_PILL[msg.author.role] && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ROLE_PILL[msg.author.role]}`}>
                          {msg.author.role_label}
                        </span>
                      )}
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                    ${mine
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
                    }`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-400">{timeStamp(msg.created_at)}</span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white rounded-b-xl">
        {isArchived ? (
          <p className="text-center text-xs text-slate-400 py-1">
            This ticket is archived — chat is read-only.
          </p>
        ) : (
          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full ${ROLE_COLOR[user?.role] || 'bg-blue-600'} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {user?.initials}
            </div>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={connected ? 'Type a message…' : 'Connecting…'}
              disabled={!connected}
              className="flex-1 px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg
                         focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20
                         outline-none transition placeholder-slate-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!connected || !input.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
