import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, PriorityBadge } from '../components/Badge'
import Spinner from '../components/Spinner'

function StatCard({ title, value, icon, bg, textColor, barColor, barPct, link, linkLabel }) {
  return (
    <div className="bg-blue-50/90 rounded-xl border border-blue-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{title}</p>
        <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
      </div>
      <p className={`text-3xl font-bold text-slate-800`}>{value}</p>
      {barColor != null && (
        <div className="flex items-center gap-1 mt-1">
          <div className="flex-1 bg-blue-100 rounded-full h-1.5">
            <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${barPct}%` }} />
          </div>
          <span className="text-xs text-slate-500">{barPct}%</span>
        </div>
      )}
      {link && <Link to={link} className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-block">{linkLabel} →</Link>}
    </div>
  )
}

function fmt(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Dashboard() {
  const { user }               = useAuth()
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    api.get('/dashboard').then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
      <Spinner size="lg" />
    </main>
  )

  const s = data?.stats || {}
  const pct = (n) => s.total ? Math.round(n / s.total * 100) : 0
  const isSupport = ['it_support', 'admin'].includes(user?.role)
  const isAdmin   = user?.role === 'admin'

  return (
    <main className="flex-1 overflow-y-auto bg-blue-100">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">Welcome back, {user?.username}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Main stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Tickets" value={s.total ?? 0} bg="bg-blue-100"
            icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
          <StatCard title="Open" value={s.open ?? 0} bg="bg-emerald-100"
            barColor="bg-emerald-500" barPct={pct(s.open)}
            icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>} />
          <StatCard title="In Progress" value={s.in_progress ?? 0} bg="bg-amber-100"
            barColor="bg-amber-500" barPct={pct(s.in_progress)}
            icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatCard title="Resolved" value={s.resolved ?? 0} bg="bg-emerald-100"
            barColor="bg-emerald-500" barPct={pct(s.resolved)}
            icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        </div>

        {/* Secondary row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="bg-red-50 border border-red-100 rounded-xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{s.critical ?? 0}</p>
              <p className="text-sm font-medium text-red-600">Critical Priority</p>
            </div>
            {s.critical > 0 && <Link to="/tickets?priority=Critical" className="ml-auto text-xs text-red-600 hover:text-red-700 font-medium">View →</Link>}
          </div>

          <div className="bg-blue-100/50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{s.archived ?? 0}</p>
              <p className="text-sm font-medium text-blue-600">Archived</p>
            </div>
            {s.archived > 0 && <Link to="/admin/archive" className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-medium">View →</Link>}
          </div>

          {isSupport ? (
            <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-5 flex items-center gap-4">
              <div className="w-11 h-11 bg-cyan-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M15 11h-1m1 4h-1m-5-4H8m1 4H8" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-700">{s.my_queue ?? 0}</p>
                <p className="text-sm font-medium text-cyan-600">My Queue (Active)</p>
              </div>
              <Link to="/it-support/queue" className="ml-auto text-xs text-cyan-600 hover:text-cyan-700 font-medium">View →</Link>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-center gap-4">
              <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{s.my_open ?? 0}</p>
                <p className="text-sm font-medium text-blue-600">My Open Tickets</p>
              </div>
              {s.my_open > 0 && <Link to="/tickets/my" className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-medium">View →</Link>}
            </div>
          )}
        </div>

        {/* IT Support unassigned warning */}
        {isSupport && s.unassigned > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800">{s.unassigned} unassigned ticket{s.unassigned !== 1 ? 's' : ''} need attention</p>
              <p className="text-xs text-orange-600 mt-0.5">These tickets haven't been picked up by any IT Support staff yet.</p>
            </div>
            <Link to="/it-support/unassigned" className="btn-secondary text-orange-600 border-orange-200 hover:bg-orange-50">View →</Link>
          </div>
        )}

        {/* Recent Tickets */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Recent Tickets</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest 8 submitted tickets</p>
            </div>
            <Link to="/tickets" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>

          {data?.recent_tickets?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 border-b border-blue-200">
                    {['ID', 'Title', 'Status', 'Priority', 'Category', 'Created'].map(h => (
                      <th key={h} className="th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recent_tickets.map(t => (
                    <tr key={t.id} className="hover:bg-blue-50/70 transition-colors">
                      <td className="td">
                        <Link to={`/tickets/${t.ticket_id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">{t.ticket_id}</Link>
                      </td>
                      <td className="td max-w-xs">
                        <Link to={`/tickets/${t.ticket_id}`} className="font-medium text-slate-800 hover:text-blue-700 line-clamp-1">{t.title}</Link>
                        <p className="text-xs text-slate-400 mt-0.5">by {t.created_by?.username}</p>
                      </td>
                      <td className="td"><StatusBadge status={t.status} /></td>
                      <td className="td"><PriorityBadge priority={t.priority} /></td>
                      <td className="td text-xs text-slate-500">{t.category}</td>
                      <td className="td text-xs text-slate-400">{fmt(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium text-sm">No tickets yet</p>
              <p className="text-slate-400 text-xs mt-1">Submitted tickets will appear here once created.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
