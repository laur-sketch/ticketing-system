import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { PriorityBadge } from '../../components/Badge'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../context/ToastContext'

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const CATEGORIES = ['General', 'Bug', 'Feature Request', 'Support', 'Security', 'Performance', 'Documentation', 'Other']
const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Archive() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState(searchParams.get('q') || '')
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [restoring, setRestoring]         = useState(false)

  const filters = {
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    q:        searchParams.get('q') || '',
    page:     parseInt(searchParams.get('page') || '1'),
  }

  const load = () => {
    setLoading(true)
    api.get('/admin/archive', filters).then(setData).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(load, [searchParams.toString()])

  const setFilter = (k, v) => {
    const next = new URLSearchParams(searchParams)
    if (v) next.set(k, v); else next.delete(k)
    next.delete('page')
    setSearchParams(next)
  }

  const clearAll = () => { setSearch(''); setSearchParams({}) }

  const handleRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      await api.post(`/tickets/${restoreTarget.ticket_id}/restore`, {})
      addToast(`Ticket ${restoreTarget.ticket_id} restored successfully.`, 'success')
      setRestoreTarget(null)
      load()
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setRestoring(false) }
  }

  const hasFilters = filters.priority || filters.category || filters.q

  return (
    <main className="flex-1 overflow-y-auto bg-slate-100">
      <div className="page-header">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Ticket Archive</h1>
          <p className="text-xs text-slate-400 mt-0.5">Closed tickets — restore to move back to active queue</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span className="font-medium">Archived — read-only unless restored</span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="label">Search</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                </svg>
                <input type="text" placeholder="Search ticket ID or title…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setFilter('q', search)}
                  className="input pl-9" />
              </div>
            </div>
            <div className="min-w-40">
              <label className="label">Priority</label>
              <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)} className="select">
                <option value="">All Priorities</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="min-w-44">
              <label className="label">Category</label>
              <select value={filters.category} onChange={e => setFilter('category', e.target.value)} className="select">
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={() => setFilter('q', search)} className="btn-primary">Search</button>
            {hasFilters && (
              <button onClick={clearAll} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Clear</button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="card-header">
            <p className="text-sm text-slate-600">
              {loading
                ? 'Loading…'
                : <><span className="font-semibold text-slate-800">{data?.pagination?.total ?? 0}</span> archived ticket{data?.pagination?.total !== 1 ? 's' : ''}</>}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : data?.tickets?.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 border-b border-blue-100">
                      {['Ticket ID', 'Title', 'Priority', 'Category', 'Submitted By', 'Assigned To', 'Archived On', 'Actions'].map(h => (
                        <th key={h} className="th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.tickets.map(t => (
                      <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="td">
                          <Link to={`/tickets/${t.ticket_id}?from=archive`}
                            className="font-mono text-xs font-bold text-blue-600 hover:underline">
                            {t.ticket_id}
                          </Link>
                        </td>
                        <td className="td max-w-xs">
                          <Link to={`/tickets/${t.ticket_id}?from=archive`}
                            className="font-medium text-slate-800 hover:text-blue-700 line-clamp-1">
                            {t.title}
                          </Link>
                        </td>
                        <td className="td"><PriorityBadge priority={t.priority} /></td>
                        <td className="td text-xs text-slate-500">{t.category}</td>
                        <td className="td text-sm text-slate-700">{t.created_by?.username}</td>
                        <td className="td text-sm text-slate-500">
                          {t.assigned_to?.username ?? <span className="italic text-slate-400">Unassigned</span>}
                        </td>
                        <td className="td text-xs text-slate-400">{fmt(t.updated_at)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setRestoreTarget(t)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-300 bg-blue-50 rounded-lg px-2.5 py-1.5 hover:bg-blue-100 transition-colors whitespace-nowrap">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Restore
                            </button>
                            <Link to={`/tickets/${t.ticket_id}?from=archive`}
                              className="text-slate-400 hover:text-blue-600 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={data.pagination} onPageChange={p => setFilter('page', p)} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">No archived tickets found</p>
              <p className="text-slate-400 text-sm mt-1">Tickets appear here when they are marked as Closed or manually archived</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
        loading={restoring}
        title="Restore Ticket"
        message={restoreTarget ? `Restore ticket ${restoreTarget.ticket_id} ("${restoreTarget.title}")? It will be removed from the archive and become active again.` : ''}
        confirmLabel="Yes, Restore Ticket"
        confirmClass="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      />
    </main>
  )
}
