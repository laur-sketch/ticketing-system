import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { StatusBadge, PriorityBadge } from '../../components/Badge'
import Pagination from '../../components/Pagination'
import Spinner from '../../components/Spinner'

const STATUSES = ['Open', 'In Progress', 'Under Review', 'Resolved', 'Closed']
const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Queue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  const filters = {
    status: searchParams.get('status') || '',
    page:   parseInt(searchParams.get('page') || '1'),
  }

  useEffect(() => {
    setLoading(true)
    api.get('/it-support/queue', filters).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [searchParams.toString()])

  const setFilter = (k, v) => {
    const next = new URLSearchParams(searchParams)
    if (v) next.set(k, v); else next.delete(k)
    next.delete('page')
    setSearchParams(next)
  }

  return (
    <main className="flex-1 overflow-y-auto bg-slate-100">
      <div className="page-header">
        <div>
          <h1 className="text-base font-semibold text-slate-800">My IT Support Queue</h1>
          <p className="text-xs text-slate-400 mt-0.5">Tickets assigned to you — handle them in priority order</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Info banner */}
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-cyan-800">These are tickets assigned to you. Prioritize <strong>Critical</strong> and <strong>High</strong> issues first.</p>
        </div>

        {/* Filter */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-40">
              <label className="label">Filter by Status</label>
              <select value={filters.status} onChange={e => setFilter('status', e.target.value)} className="select">
                <option value="">All Status</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {filters.status && <button onClick={() => setFilter('status', '')} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Clear</button>}
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="card-header">
            <p className="text-sm text-slate-600">
              {loading ? 'Loading…' : <><span className="font-semibold text-slate-800">{data?.pagination?.total ?? 0}</span> ticket{data?.pagination?.total !== 1 ? 's' : ''} in queue</>}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : data?.tickets?.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['ID', 'Title', 'Priority', 'Status', 'Category', 'Submitted By', 'Created', ''].map(h => <th key={h} className="th">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.tickets.map(t => (
                      <tr key={t.id} className={`hover:bg-slate-50/70 transition-colors ${t.priority === 'Critical' ? 'bg-red-50/30' : ''}`}>
                        <td className="td"><Link to={`/tickets/${t.ticket_id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">{t.ticket_id}</Link></td>
                        <td className="td max-w-xs">
                          <Link to={`/tickets/${t.ticket_id}`} className="font-medium text-slate-800 hover:text-blue-700 line-clamp-1">{t.title}</Link>
                          <p className="text-xs text-slate-400 mt-0.5">{t.comment_count} comment{t.comment_count !== 1 ? 's' : ''}</p>
                        </td>
                        <td className="td"><PriorityBadge priority={t.priority} /></td>
                        <td className="td"><StatusBadge status={t.status} /></td>
                        <td className="td text-xs text-slate-500">{t.category}</td>
                        <td className="td">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold">{t.created_by.initials[0]}</span>
                            <span className="text-xs text-slate-600">{t.created_by.username}</span>
                          </div>
                        </td>
                        <td className="td text-xs text-slate-400">{fmt(t.created_at)}</td>
                        <td className="px-4 py-3.5">
                          <Link to={`/tickets/${t.ticket_id}`} className="text-slate-400 hover:text-blue-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </Link>
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
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-slate-600 font-medium">Queue is clear!</p>
              <p className="text-slate-400 text-sm mt-1 mb-4">No active tickets assigned to you</p>
              <Link to="/it-support/unassigned" className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                View Unassigned Tickets
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
