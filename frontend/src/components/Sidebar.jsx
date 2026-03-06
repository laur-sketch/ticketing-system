import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * NavItem with a custom isActiveFn so each link owns its own match logic.
 * Falls back to exact-path matching when no fn is provided.
 */
function NavItem({ to, icon, label, isActiveFn }) {
  const { pathname, search } = useLocation()
  const active = isActiveFn
    ? isActiveFn(pathname, search)
    : pathname === to

  return (
    <Link to={to}
      className={`sidebar-link ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-200 hover:bg-blue-900 hover:text-blue-50'}`}>
      {icon}
      {label}
    </Link>
  )
}

// ── active-state matchers ──────────────────────────────────────────────────
const isDashboard   = p => p === '/'
const isAllTickets  = (p, s) =>
  p === '/tickets' ||
  (p.startsWith('/tickets/') &&
    !p.startsWith('/tickets/my') &&
    !p.startsWith('/tickets/create') &&
    !s.includes('from=archive'))
const isMyTickets   = p => p.startsWith('/tickets/my')
const isNewTicket   = p => p === '/tickets/create'
const isQueue       = p => p.startsWith('/it-support/queue')
const isUnassigned  = p => p.startsWith('/it-support/unassigned')
const isAdminUsers  = p => p.startsWith('/admin/users')
const isReports     = p => p.startsWith('/admin/reports')
const isArchive     = (p, s) =>
  p === '/admin/archive' ||
  (p.startsWith('/tickets/') &&
    !p.startsWith('/tickets/my') &&
    !p.startsWith('/tickets/create') &&
    s.includes('from=archive'))

export default function Sidebar() {
  const { user } = useAuth()

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900 flex flex-col shadow-xl z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-blue-900">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight">TicketFlow</p>
          <p className="text-blue-400/90 text-xs">Issue Tracking</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-4 mb-2 text-xs font-semibold text-blue-400/90 uppercase tracking-wider">Main</p>
        <NavItem to="/" isActiveFn={isDashboard} icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>} label="Dashboard" />

        <p className="px-4 pt-4 mb-2 text-xs font-semibold text-blue-400/90 uppercase tracking-wider">Tickets</p>
        <NavItem to="/tickets" isActiveFn={isAllTickets} icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>} label="All Tickets" />
        <NavItem to="/tickets/my" isActiveFn={isMyTickets} icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>} label="My Tickets" />
        <NavItem to="/tickets/create" isActiveFn={isNewTicket} icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>} label="New Ticket" />

        {user?.role && ['it_support', 'admin'].includes(user.role) && (<>
          <p className="px-4 pt-4 mb-2 text-xs font-semibold text-blue-400/90 uppercase tracking-wider">IT Support</p>
          <NavItem to="/it-support/queue" isActiveFn={isQueue} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M15 11h-1m1 4h-1m-5-4H8m1 4H8" />
            </svg>} label="My Queue" />
          <NavItem to="/it-support/unassigned" isActiveFn={isUnassigned} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>} label="Unassigned" />
        </>)}

        {user?.role === 'admin' && (<>
          <p className="px-4 pt-4 mb-2 text-xs font-semibold text-blue-400/90 uppercase tracking-wider">Admin</p>
          <NavItem to="/admin/users" isActiveFn={isAdminUsers} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>} label="User Management" />
          <NavItem to="/admin/archive" isActiveFn={isArchive} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>} label="Archive" />
          <NavItem to="/admin/reports" isActiveFn={isReports} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>} label="Reports" />
        </>)}
      </nav>

    </aside>
  )
}
