import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { api } from '../api/client'
import { useTimeFormat } from '../context/TimeFormatContext'

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const ROLE_COLOR = {
  admin:      'bg-blue-500',
  it_support: 'bg-cyan-500',
  user:       'bg-slate-400',
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// timeStamp is now built from useTimeFormat — removed static helper

function convName(conv, myId) {
  const others = conv.members.filter(m => m.id !== myId)
  if (!others.length) return 'Just you'
  return others.map(m => m.username).join(', ')
}

function convInitials(conv, myId) {
  const others = conv.members.filter(m => m.id !== myId)
  if (!others.length) return '?'
  if (others.length === 1) return others[0].initials
  return others.length + ' people'[0]   // first letter of "people"
}

function UserAvatar({ user, size = 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'xs' ? 'w-5 h-5 text-[8px]' : 'w-9 h-9 text-xs'
  return (
    <div className={`${sz} ${ROLE_COLOR[user.role] || 'bg-slate-400'} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {user.initials}
    </div>
  )
}

/* ── View: New Chat (user search + multi-select) ────────────────────────── */
function NewChatView({ myId, onStart, onBack }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [selected, setSelected] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [starting, setStarting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q: query })
        selected.forEach(u => params.append('exclude', u.id))
        const d = await api.get(`/users/search?${params}`)
        setResults(d.users)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [query, selected.map(u => u.id).join(',')])   // eslint-disable-line

  const toggle = (user) => {
    setSelected(prev =>
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    )
    setQuery('')
    inputRef.current?.focus()
  }

  const start = async () => {
    if (!selected.length) return
    setStarting(true)
    try {
      const d = await api.post('/conversations', { member_ids: selected.map(u => u.id) })
      onStart(d.conversation)
    } catch (e) {
      alert(e?.message || 'Could not start conversation')
    } finally { setStarting(false) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-slate-800">New Conversation</span>
      </div>

      {/* Selected users chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50">
          {selected.map(u => (
            <span key={u.id} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              {u.username}
              <button onClick={() => toggle(u)} className="w-3.5 h-3.5 rounded-full bg-indigo-200 hover:bg-indigo-300 flex items-center justify-center text-[9px] transition-colors">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg border border-slate-200 focus-within:border-blue-400 focus-within:bg-white transition-colors">
          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search users to add…"
            className="flex-1 text-sm bg-transparent outline-none placeholder-slate-400"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6">{query ? 'No users found' : 'Type to search all users'}</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {results.map(u => (
              <li key={u.id}>
                <button
                  onClick={() => toggle(u)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <UserAvatar user={u} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{u.username}</p>
                    <p className="text-xs text-slate-400">{u.role_label}</p>
                  </div>
                  <div className="w-4 h-4 rounded border-2 border-slate-300 flex items-center justify-center flex-shrink-0">
                    {selected.find(s => s.id === u.id) && (
                      <div className="w-2 h-2 rounded-sm bg-blue-500" />
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Start button */}
      <div className="px-4 py-3 border-t border-slate-100">
        <button
          onClick={start}
          disabled={!selected.length || starting}
          className="w-full py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl
                     transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {starting ? 'Starting…' : selected.length ? `Start chat with ${selected.length === 1 ? selected[0].username : `${selected.length} people`}` : 'Select at least one person'}
        </button>
      </div>
    </div>
  )
}

/* ── View: Chat (messages + input) ──────────────────────────────────────── */
function ChatView({ conv, myId, socket, onBack, onConvsUpdate }) {
  const { fmtDateTime } = useTimeFormat()
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [connected, setConnected] = useState(false)
  const [showAdd,   setShowAdd]   = useState(false)
  const [addQuery,  setAddQuery]  = useState('')
  const [addResults,setAddResults]= useState([])
  const [adding,    setAdding]    = useState(null)
  const bottomRef = useRef(null)
  const addedIds  = useRef(new Set())
  const addRef    = useRef(null)

  // Load messages
  useEffect(() => {
    api.get(`/conversations/${conv.id}/messages`)
      .then(d => {
        setMessages(d.messages)
        d.messages.forEach(m => addedIds.current.add(m.id))
      })
      .catch(() => {})
  }, [conv.id])

  // Socket: join/leave room + listeners
  useEffect(() => {
    if (!socket) return
    setConnected(socket.connected)
    socket.emit('join_conv', { conv_id: conv.id })

    const onConnect    = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onMessage    = (msg) => {
      if (msg.conv_id !== conv.id) return
      if (addedIds.current.has(msg.id)) return
      addedIds.current.add(msg.id)
      setMessages(prev => [...prev, msg])
    }
    const onMemberAdded = ({ conv_id, user }) => {
      if (conv_id === conv.id) onConvsUpdate()
    }

    socket.on('connect',      onConnect)
    socket.on('disconnect',   onDisconnect)
    socket.on('dm_message',   onMessage)
    socket.on('member_added', onMemberAdded)

    return () => {
      socket.emit('leave_conv', { conv_id: conv.id })
      socket.off('connect',      onConnect)
      socket.off('disconnect',   onDisconnect)
      socket.off('dm_message',   onMessage)
      socket.off('member_added', onMemberAdded)
    }
  }, [socket, conv.id])   // eslint-disable-line

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Add-member search
  useEffect(() => {
    if (!showAdd) return
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: addQuery })
        conv.members.forEach(m => params.append('exclude', m.id))
        const d = await api.get(`/users/search?${params}`)
        setAddResults(d.users)
      } catch { setAddResults([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [addQuery, showAdd])   // eslint-disable-line

  // Close add-member panel on outside click
  useEffect(() => {
    if (!showAdd) return
    const h = (e) => { if (addRef.current && !addRef.current.contains(e.target)) setShowAdd(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showAdd])

  const send = (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !socket?.connected) return
    socket.emit('send_dm', { conv_id: conv.id, content: text })
    setInput('')
  }

  const addMember = async (user) => {
    setAdding(user.id)
    try {
      await api.post(`/conversations/${conv.id}/members`, { user_id: user.id })
      setAddResults(r => r.filter(u => u.id !== user.id))
      onConvsUpdate()
    } catch (e) { alert(e?.message || 'Could not add member') }
    finally { setAdding(null) }
  }

  const others = conv.members.filter(m => m.id !== myId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-white">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Avatar stack */}
        <div className="flex -space-x-1.5 flex-shrink-0">
          {others.slice(0, 3).map(m => (
            <div key={m.id} title={m.username}
              className={`w-7 h-7 ${ROLE_COLOR[m.role] || 'bg-slate-400'} rounded-full border-2 border-white
                          flex items-center justify-center text-white text-[9px] font-bold`}>
              {m.initials}
            </div>
          ))}
          {others.length > 3 && (
            <div className="w-7 h-7 bg-slate-200 rounded-full border-2 border-white flex items-center justify-center text-slate-500 text-[9px] font-bold">
              +{others.length - 3}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{convName(conv, myId)}</p>
          <p className="text-[10px] text-slate-400">{conv.members.length} members</p>
        </div>

        {/* Add member button */}
        <div className="relative flex-shrink-0" ref={addRef}>
          <button
            onClick={() => { setShowAdd(v => !v); setAddQuery('') }}
            className={`p-1.5 rounded-lg transition-colors ${showAdd ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-400 hover:text-blue-500'}`}
            title="Add member"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM3 20a6 6 0 0 1 12 0v1H3v-1z" />
            </svg>
          </button>

          {showAdd && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <input
                  autoFocus
                  value={addQuery}
                  onChange={e => setAddQuery(e.target.value)}
                  placeholder="Search users…"
                  className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none placeholder-slate-400 focus:border-blue-400"
                />
              </div>
              <div className="max-h-36 overflow-y-auto">
                {addResults.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-3">{addQuery ? 'No users found' : 'Type to search'}</p>
                ) : addResults.map(u => (
                  <button key={u.id} onClick={() => addMember(u)} disabled={adding === u.id}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left">
                    <UserAvatar user={u} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{u.username}</p>
                      <p className="text-[10px] text-slate-400">{u.role_label}</p>
                    </div>
                    {adding === u.id
                      ? <span className="text-[10px] text-slate-400">Adding…</span>
                      : <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    }
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-blue-400' : 'bg-slate-300'}`} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-6 text-center gap-2">
            <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs text-slate-400">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map(msg => {
            const mine = msg.author.id === myId
            return (
              <div key={msg.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5
                  ${mine ? 'bg-blue-600' : ROLE_COLOR[msg.author.role] || 'bg-slate-400'}`}>
                  {msg.author.initials}
                </div>
                <div className={`max-w-[75%] flex flex-col gap-0.5 ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && (
                    <span className="text-[10px] font-semibold text-slate-500 px-1">{msg.author.username}</span>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                    ${mine ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'}`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-400 px-1 tabular-nums">{fmtDateTime(msg.created_at)}</span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-slate-200 bg-white">
        <form onSubmit={send} className="flex items-center gap-2">
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
          <button type="submit" disabled={!connected || !input.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── View: Conversation List ─────────────────────────────────────────────── */
function ConvListView({ convs, myId, loading, onSelect, onNew }) {
  const { fmtTime } = useTimeFormat()
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="font-semibold text-slate-800 text-sm">Messages</span>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* List */}
      <ul className="overflow-y-auto flex-1 divide-y divide-slate-50">
        {loading ? (
          <li className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </li>
        ) : convs.length === 0 ? (
          <li className="flex flex-col items-center justify-center py-10 gap-3 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">Start a new chat to message any user, IT personnel, or administrator.</p>
            </div>
            <button onClick={onNew}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
              Start a Conversation
            </button>
          </li>
        ) : (
          convs.map(conv => {
            const others = conv.members.filter(m => m.id !== myId)
            const last   = conv.last_message
            return (
              <li key={conv.id}>
                <button
                  onClick={() => onSelect(conv)}
                  className="w-full flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  {/* Avatar stack */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    {others.length <= 1 ? (
                      <div className={`w-9 h-9 ${ROLE_COLOR[others[0]?.role] || 'bg-slate-400'} rounded-full
                                        flex items-center justify-center text-white text-xs font-bold`}>
                        {others[0]?.initials || '?'}
                      </div>
                    ) : (
                      <div className="w-9 h-9 relative">
                        <div className={`w-6 h-6 ${ROLE_COLOR[others[0]?.role] || 'bg-slate-400'} rounded-full absolute top-0 left-0
                                          flex items-center justify-center text-white text-[8px] font-bold border border-white`}>
                          {others[0]?.initials}
                        </div>
                        <div className={`w-6 h-6 ${ROLE_COLOR[others[1]?.role] || 'bg-slate-400'} rounded-full absolute bottom-0 right-0
                                          flex items-center justify-center text-white text-[8px] font-bold border border-white`}>
                          {others[1]?.initials}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-semibold text-slate-800 truncate">{convName(conv, myId)}</span>
                      {last && (
                      <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums" title={timeAgo(last.created_at)}>
                        {fmtTime(last.created_at)}
                      </span>
                    )}
                    </div>
                    {last ? (
                      <p className="text-xs text-slate-400 truncate">
                        <span className="font-medium text-slate-500">
                          {last.author.id === myId ? 'You' : last.author.username}:
                        </span>{' '}{last.content}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-300 italic">No messages yet</p>
                    )}
                  </div>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export default function RecentChatsPanel({ onClose }) {
  const { user }                  = useAuth()
  const socket                    = useSocket()
  const panelRef                  = useRef(null)
  const [view,  setView]          = useState('list')   // 'list' | 'new' | 'chat'
  const [convs, setConvs]         = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [loading, setLoading]     = useState(true)

  const loadConvs = useCallback(() => {
    api.get('/conversations')
      .then(d => setConvs(d.conversations))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadConvs() }, [loadConvs])

  // Listen for incoming DMs to refresh conversation list (last message preview update)
  useEffect(() => {
    if (!socket) return
    const onDm = () => loadConvs()
    socket.on('dm_message', onDm)
    return () => socket.off('dm_message', onDm)
  }, [socket, loadConvs])

  // Close on outside click (only in list / new views)
  useEffect(() => {
    if (view === 'chat') return
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose, view])

  const openConv = (conv) => { setActiveConv(conv); setView('chat') }

  const handleStart = (conv) => {
    loadConvs()
    openConv(conv)
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      style={{ width: '360px', height: '480px' }}
    >
      {view === 'list' && (
        <ConvListView
          convs={convs}
          myId={user?.id}
          loading={loading}
          onSelect={openConv}
          onNew={() => setView('new')}
        />
      )}
      {view === 'new' && (
        <NewChatView
          myId={user?.id}
          onStart={handleStart}
          onBack={() => setView('list')}
        />
      )}
      {view === 'chat' && activeConv && (
        <ChatView
          conv={activeConv}
          myId={user?.id}
          socket={socket}
          onBack={() => { setView('list'); setActiveConv(null) }}
          onConvsUpdate={loadConvs}
        />
      )}
    </div>
  )
}
