import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { RoleBadge } from '../../components/Badge'
import Spinner from '../../components/Spinner'
const ROLES = [
  { value: 'user',       label: 'User' },
  { value: 'it_support', label: 'IT Support' },
  { value: 'admin',      label: 'Administrator' },
]

const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function AdminUsers() {
  const { user: me }    = useAuth()
  const { addToast }    = useToast()
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    api.get('/admin/users').then(d => setUsers(d.users)).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const changeRole = async (userId, role) => {
    try {
      const d = await api.patch(`/admin/users/${userId}/role`, { role })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...d.user } : u))
      addToast(`Role updated to ${d.user.role_label}.`, 'success')
    } catch (err) { addToast(err.message, 'error') }
  }

  const toggleUser = async (userId, isActive) => {
    const action = isActive ? 'Deactivate' : 'Activate'
    if (!window.confirm(`${action} this user?`)) return
    try {
      const d = await api.patch(`/admin/users/${userId}/toggle`, {})
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...d.user } : u))
      addToast(`${d.user.username} has been ${d.user.is_active_user ? 'activated' : 'deactivated'}.`, 'success')
    } catch (err) { addToast(err.message, 'error') }
  }

  const resetPassword = async (userId, username) => {
    if (!window.confirm(`Reset password for "${username}"?\n\nTheir password will be set to the default: 123456\nThey should change it after logging in.`)) return
    try {
      const d = await api.post(`/admin/users/${userId}/reset-password`, {})
      addToast(d.message, 'success')
    } catch (err) { addToast(err.message, 'error') }
  }

  const avatarStyle = (role) => ({
    admin:      'bg-blue-100 text-blue-700',
    it_support: 'bg-cyan-100 text-cyan-700',
    user:       'bg-slate-100 text-slate-700',
  }[role] || 'bg-slate-100 text-slate-700')

  return (
    <main className="flex-1 overflow-y-auto bg-slate-100">
      <div className="page-header">
        <div>
          <h1 className="text-base font-semibold text-slate-800">User Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage user accounts and roles</p>
        </div>
      </div>

      <div className="p-6">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {loading ? 'Loading…' : <><span className="font-semibold text-slate-800">{users.length}</span> registered users</>}
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-full" />Active</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-300 rounded-full" />Inactive</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['User', 'Email', 'Role', 'Status', 'Joined', 'Tickets', 'Actions'].map(h => (
                      <th key={h} className={`th ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className={`hover:bg-slate-50/70 transition-colors ${!u.is_active_user ? 'opacity-60' : ''}`}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarStyle(u.role)}`}>
                            {u.initials}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {u.username}
                              {u.id === me?.id && <span className="text-xs font-normal text-blue-500 ml-1">(you)</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="td text-slate-500 text-xs">{u.email}</td>
                      <td className="td">
                        {u.id !== me?.id ? (
                          <select value={u.role}
                            onChange={e => changeRole(u.id, e.target.value)}
                            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:border-blue-500 outline-none cursor-pointer">
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        ) : (
                          <RoleBadge role={u.role} roleLabel={u.role_label} />
                        )}
                      </td>
                      <td className="td">
                        {u.is_active_user
                          ? <span className="badge bg-blue-100 text-blue-700">Active</span>
                          : <span className="badge bg-red-100 text-red-600">Inactive</span>}
                      </td>
                      <td className="td text-xs text-slate-400">{fmt(u.created_at)}</td>
                      <td className="td text-xs text-slate-500">{u.tickets_created_count} created</td>
                      <td className="td text-right">
                        {u.id !== me?.id ? (
                          <div className="flex items-center justify-end gap-2">
                            {/* Reset Password */}
                            <button
                              onClick={() => resetPassword(u.id, u.username)}
                              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border
                                         text-blue-600 border-blue-200 hover:bg-blue-50 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                              Reset Password
                            </button>

                            {/* Activate / Deactivate */}
                            <button
                              onClick={() => toggleUser(u.id, u.is_active_user)}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors
                                ${u.is_active_user
                                  ? 'text-red-600 border-red-200 hover:bg-red-50'
                                  : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                              {u.is_active_user ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
