import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'

const ROLE_COLOR = {
  admin:      'bg-blue-500',
  it_support: 'bg-cyan-500',
  user:       'bg-slate-400',
}

/**
 * Searchable popover to add a participant to a ticket's chat.
 *
 * Props:
 *  ticketId    – string ticket_id (e.g. "TKT-001")
 *  existingIds – array of user.id numbers to exclude from results
 *  onAdded     – callback(user) after successful add
 *  onClose     – callback to close the popover
 */
export default function AddParticipantPopover({ ticketId, existingIds = [], onAdded, onClose }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding,  setAdding]  = useState(null)   // user_id being added
  const inputRef              = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q: query })
        existingIds.forEach(id => params.append('exclude', id))
        const d = await api.get(`/users/search?${params}`)
        setResults(d.users)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [query, existingIds.join(',')])  // eslint-disable-line

  const add = async (user) => {
    setAdding(user.id)
    try {
      await api.post(`/tickets/${ticketId}/chat/participants`, { user_id: user.id })
      onAdded?.(user)
      setResults(r => r.filter(u => u.id !== user.id))
    } catch (e) {
      alert(e?.message || 'Could not add participant')
    } finally { setAdding(null) }
  }

  return (
    <div className="absolute top-full right-0 z-50 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Search input */}
      <div className="p-2 border-b border-slate-100">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search users…"
            className="flex-1 text-xs bg-transparent outline-none placeholder-slate-400"
          />
        </div>
      </div>

      {/* Results */}
      <div className="max-h-48 overflow-y-auto">
        {loading && <p className="text-center text-xs text-slate-400 py-3">Searching…</p>}
        {!loading && results.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-3">
            {query ? 'No users found' : 'Type to search users'}
          </p>
        )}
        {results.map(u => (
          <button
            key={u.id}
            onClick={() => add(u)}
            disabled={adding === u.id}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
          >
            <div className={`w-5 h-5 ${ROLE_COLOR[u.role] || 'bg-slate-400'} rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
              {u.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-800 truncate">{u.username}</p>
              <p className="text-[10px] text-slate-400">{u.role_label}</p>
            </div>
            {adding === u.id ? (
              <span className="text-[10px] text-slate-400">Adding…</span>
            ) : (
              <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Cancel */}
      <div className="border-t border-slate-100 p-2">
        <button onClick={onClose} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
