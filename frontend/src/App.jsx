import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { SocketProvider } from './context/SocketContext'
import { TimeFormatProvider } from './context/TimeFormatContext'
import Layout from './components/Layout'
import Spinner from './components/Spinner'

import Login          from './pages/Login'
import Register       from './pages/Register'
import Dashboard      from './pages/Dashboard'
import Profile        from './pages/Profile'
import TicketList     from './pages/tickets/TicketList'
import MyTickets      from './pages/tickets/MyTickets'
import CreateTicket   from './pages/tickets/CreateTicket'
import TicketDetail   from './pages/tickets/TicketDetail'
import EditTicket     from './pages/tickets/EditTicket'
import Queue          from './pages/it_support/Queue'
import Unassigned     from './pages/it_support/Unassigned'
import AdminUsers     from './pages/admin/Users'
import AdminArchive  from './pages/admin/Archive'
import AdminReports  from './pages/admin/Reports'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function ITSupportRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!['it_support', 'admin'].includes(user.role)) return <Navigate to="/" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={
        <ProtectedRoute><Layout /></ProtectedRoute>
      }>
        <Route index                    element={<Dashboard />} />
        <Route path="tickets"           element={<TicketList />} />
        <Route path="tickets/my"        element={<MyTickets />} />
        <Route path="tickets/create"    element={<CreateTicket />} />
        <Route path="tickets/:ticketId" element={<TicketDetail />} />
        <Route path="tickets/:ticketId/edit" element={<EditTicket />} />
        <Route path="profile"           element={<Profile />} />
        <Route path="it-support/queue"  element={<ITSupportRoute><Queue /></ITSupportRoute>} />
        <Route path="it-support/unassigned" element={<ITSupportRoute><Unassigned /></ITSupportRoute>} />
        <Route path="admin/users"        element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="admin/archive"      element={<AdminRoute><AdminArchive /></AdminRoute>} />
        <Route path="admin/reports"      element={<AdminRoute><AdminReports /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TimeFormatProvider>
        <AuthProvider>
          <SocketProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </SocketProvider>
        </AuthProvider>
      </TimeFormatProvider>
    </BrowserRouter>
  )
}
