import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { PriorityBadge, StatusBadge } from '../../components/Badge'
import Spinner from '../../components/Spinner'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useTimeFormat } from '../../context/TimeFormatContext'

const STATUSES   = ['Open', 'In Progress', 'Under Review', 'Resolved', 'Closed']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const CATEGORIES = ['General', 'Bug', 'Feature Request', 'Support', 'Security', 'Performance', 'Documentation', 'Other']

const SORT_OPTIONS = [
  { label: 'Date',     value: 'date_desc' },
  { label: 'Oldest',   value: 'date_asc'  },
  { label: 'Priority', value: 'priority'  },
]

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 }

const PRIORITY_DOT = {
  Critical: 'bg-red-500',
  High:     'bg-orange-400',
  Medium:   'bg-blue-400',
  Low:      'bg-blue-400',
}

function timeAgo(iso, is24h) {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: !is24h })
}

function isOverdue(ticket) {
  if (['Resolved', 'Closed'].includes(ticket.status)) return false
  return (Date.now() - new Date(ticket.created_at)) / 86_400_000 > 3
}

export default function TicketList() {
  const { addToast }                    = useToast()
  const { user }                        = useAuth()
  const { is24h }                       = useTimeFormat()
  const isAdmin                         = user?.role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData]                 = useState(null)
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(new Set())
  const [deleting, setDeleting]         = useState(false)
  const [archiving, setArchiving]       = useState(false)
  const [sort, setSort]                 = useState('date_desc')
  const [sortOpen, setSortOpen]         = useState(false)
  const sortRef                         = useRef(null)

  const filters = {
    q:        searchParams.get('q') || '',
    status:   searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    page:     parseInt(searchParams.get('page') || '1'),
  }

  useEffect(() => {
    setLoading(true)
    setSelected(new Set())
    api.get('/tickets', filters)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [searchParams.toString()])

  // Close sort dropdown on outside click
  useEffect(() => {
    function h(e) { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const setFilter = (key, val) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set(key, val); else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }

  const tickets  = data?.tickets || []
  const pg       = data?.pagination
  const hasFilters = filters.q || filters.status || filters.priority || filters.category

  const sorted = [...tickets].sort((a, b) => {
    if (sort === 'date_asc')  return new Date(a.created_at) - new Date(b.created_at)
    if (sort === 'priority')  return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const toggleAll = () =>
    setSelected(selected.size === tickets.length ? new Set() : new Set(tickets.map(t => t.ticket_id)))
  const toggleOne = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} ticket(s)? This cannot be undone.`)) return
    setDeleting(true)
    let ok = 0, fail = 0
    await Promise.allSettled(
      [...selected].map(tid =>
        api.delete(`/tickets/${tid}`).then(() => ok++).catch(() => fail++)
      )
    )
    setDeleting(false)
    setSelected(new Set())
    if (ok)   addToast(`${ok} ticket(s) deleted.`, 'success')
    if (fail) addToast(`${fail} ticket(s) could not be deleted (permission denied).`, 'error')
    // Refresh
    api.get('/tickets', filters).then(setData).catch(console.error)
  }

  const handleBulkArchive = async (ticketIds) => {
    if (!window.confirm(`Archive ${ticketIds.length} ticket(s)? They will become read-only.`)) return
    setArchiving(true)
    let ok = 0, fail = 0
    await Promise.allSettled(
      ticketIds.map(tid =>
        api.post(`/tickets/${tid}/archive`).then(() => ok++).catch(() => fail++)
      )
    )
    setArchiving(null)
    setSelected(new Set())
    if (ok)   addToast(`${ok} ticket(s) archived.`, 'success')
    if (fail) addToast(`${fail} ticket(s) could not be archived.`, 'error')
    api.get('/tickets', filters).then(setData).catch(console.error)
  }

  const fromRow = (filters.page - 1) * 15 + 1
  const toRow   = Math.min(filters.page * 15, pg?.total ?? 0)

  return (
    <main className="flex-1 overflow-hidden flex flex-col bg-slate-100">

      {/* ── Page header — light, matching new page-header theme ───────────── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Tickets</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? '…' : `${pg?.total ?? 0} total tickets`}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-80">
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={filters.q}
            onChange={e => setFilter('q', e.target.value)}
            placeholder="Search tickets…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-slate-100 border border-slate-200
                       text-slate-800 placeholder-slate-400
                       focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20
                       outline-none transition"
          />
        </div>
      </div>

      {/* ── Body: list + filter panel ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Ticket list */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tickets.length > 0 && selected.size === tickets.length}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-slate-600 font-medium">Select all</span>
            </label>

            {selected.size > 0 && (
              <>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200
                             rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {deleting ? 'Deleting…' : `Delete (${selected.size})`}
                </button>

                {isAdmin && (() => {
                  const archivable = sorted.filter(t =>
                    selected.has(t.ticket_id) && ['Resolved', 'Closed'].includes(t.status)
                  )
                  if (!archivable.length) return null
                  return (
                    <button
                      onClick={() => handleBulkArchive(archivable.map(t => t.ticket_id))}
                      disabled={!!archiving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200
                                 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      {archiving ? 'Archiving…' : `Archive (${archivable.length})`}
                    </button>
                  )
                })()}
              </>
            )}

            {/* Sort dropdown */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setSortOpen(p => !p)}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                </svg>
                Sort by: <span className="font-semibold ml-0.5">{SORT_OPTIONS.find(s => s.value === sort)?.label}</span>
                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${sortOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {sortOpen && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => { setSort(opt.value); setSortOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors
                        ${sort === opt.value ? 'text-blue-600 font-semibold' : 'text-slate-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination arrows */}
            {pg && pg.total > 0 && (
              <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
                <span className="tabular-nums">{fromRow}–{toRow} of {pg.total}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    disabled={filters.page <= 1}
                    onClick={() => setFilter('page', filters.page - 1)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    disabled={!pg.has_next}
                    onClick={() => setFilter('page', filters.page + 1)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Spinner size="lg" />
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-xl shadow-sm">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-500">
                  {hasFilters ? 'No tickets match your filters' : 'No tickets yet'}
                </p>
                {hasFilters && (
                  <button onClick={() => setSearchParams({})}
                    className="mt-2 text-xs text-blue-600 hover:underline">Clear filters</button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
                {sorted.map(t => {
                  const overdue    = isOverdue(t)
                  const isLocked   = ['Resolved', 'Closed'].includes(t.status)
                  const isSelected = selected.has(t.ticket_id)
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-4 pl-3 pr-6 py-3.5 transition-colors group
                        ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    >
                      {/* Overdue / selection bar */}
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 transition-colors
                        ${overdue ? 'bg-red-500' : isSelected ? 'bg-blue-500' : 'bg-transparent'}`}
                      />

                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(t.ticket_id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                      />

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600
                                      flex items-center justify-center flex-shrink-0 text-white text-sm font-bold shadow-sm">
                        {t.created_by?.username?.[0]?.toUpperCase() ?? '?'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 mb-0.5 truncate">{t.created_by?.username}</p>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <span className="truncate">{t.title}</span>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-slate-300'}`} />
                          {overdue && (
                            <span className="text-[10px] font-bold uppercase bg-red-500 text-white px-1.5 py-0.5 rounded-md flex-shrink-0 tracking-wide">
                              Overdue
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {t.category}
                          {t.assigned_to && <> · <span className="text-slate-500">{t.assigned_to.username}</span></>}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <span className="text-xs text-slate-400 flex-shrink-0 text-right whitespace-nowrap min-w-[5rem]">
                        {timeAgo(t.created_at, is24h)}
                      </span>

                      {/* Status badge */}
                      <div className="flex-shrink-0">
                        <StatusBadge status={t.status} />
                      </div>

                      {/* Priority badge */}
                      <div className="flex-shrink-0">
                        <PriorityBadge priority={t.priority} />
                      </div>

                      {/* Lock icon */}
                      <div className="flex-shrink-0 w-5">
                        {isLocked ? (
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-slate-200 group-hover:text-slate-300 transition-colors"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>

                      {/* View button — admin & IT support only */}
                      {['admin', 'it_support'].includes(user?.role) && (
                        <Link
                          to={`/tickets/${t.ticket_id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200
                                     rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right filter panel ───────────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 bg-slate-100 border-l border-slate-200 flex flex-col overflow-y-auto">
          <div className="px-5 py-4 bg-white border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-800">Ticket Filters</h2>
          </div>

          <div className="flex-1 px-4 py-4 space-y-3">
            {[
              { label: 'Category', key: 'category', placeholder: 'All Categories', opts: CATEGORIES },
              { label: 'Status',   key: 'status',   placeholder: 'All Status',     opts: STATUSES   },
              { label: 'Priority', key: 'priority', placeholder: 'All Priorities', opts: PRIORITIES },
            ].map(({ label, key, placeholder, opts }) => (
              <div key={key} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-200">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {label}
                  {filters[key] && (
                    <span className="ml-1.5 text-blue-600 normal-case font-medium">· {filters[key]}</span>
                  )}
                </p>
                <select
                  value={filters[key]}
                  onChange={e => setFilter(key, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50
                             hover:bg-white focus:bg-white focus:border-blue-400
                             focus:ring-2 focus:ring-blue-500/20 outline-none transition text-slate-700"
                >
                  <option value="">{placeholder}</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Active filter chips */}
          {hasFilters && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {filters.q && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                  "{filters.q}"
                  <button onClick={() => setFilter('q', '')} className="hover:text-blue-900">×</button>
                </span>
              )}
              {filters.status && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                  {filters.status}
                  <button onClick={() => setFilter('status', '')} className="hover:text-blue-900">×</button>
                </span>
              )}
              {filters.priority && (
                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-medium px-2 py-1 rounded-full">
                  {filters.priority}
                  <button onClick={() => setFilter('priority', '')} className="hover:text-orange-900">×</button>
                </span>
              )}
              {filters.category && (
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-full">
                  {filters.category}
                  <button onClick={() => setFilter('category', '')} className="hover:text-slate-800">×</button>
                </span>
              )}
            </div>
          )}

          {/* Clear filters */}
          <div className="px-4 py-4 mt-auto border-t border-slate-200">
            <button
              onClick={() => setSearchParams({})}
              disabled={!hasFilters}
              className="w-full py-2 text-sm font-medium text-slate-500 bg-white border border-slate-200 rounded-xl
                         hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              Clear filters
            </button>
          </div>
        </aside>
      </div>
    </main>
  )
}
