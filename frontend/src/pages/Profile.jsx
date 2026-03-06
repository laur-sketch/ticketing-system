import { useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

function Section({ title, children }) {
  return (
    <div className="card">
      <div className="card-header bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export default function Profile() {
  const { user, updateUser } = useAuth()
  const { addToast }         = useToast()

  const [info, setInfo]     = useState({ username: user?.username || '', email: user?.email || '' })
  const [pwd, setPwd]       = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)

  const onInfoChange = e => setInfo(f => ({ ...f, [e.target.name]: e.target.value }))
  const onPwdChange  = e => setPwd(f => ({ ...f, [e.target.name]: e.target.value }))

  const saveInfo = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const d = await api.patch('/profile/info', info)
      updateUser(d.user)
      addToast('Profile updated.', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setSaving(false) }
  }

  const savePwd = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch('/profile/password', pwd)
      setPwd({ old_password: '', new_password: '', confirm_password: '' })
      addToast('Password changed successfully.', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setSaving(false) }
  }

  return (
    <main className="flex-1 overflow-y-auto bg-slate-100">
      <div className="page-header">
        <div>
          <h1 className="text-base font-semibold text-slate-800">My Profile</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage your account settings</p>
        </div>
      </div>

      <div className="p-6 max-w-2xl space-y-5">
        {/* Profile card */}
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-8">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                {user?.initials}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{user?.username}</h2>
                <p className="text-indigo-200 text-sm">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white">{user?.role_label}</span>
                  <span className="text-xs text-indigo-200">
                    Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Update info */}
        <Section title="Account Information">
          <form onSubmit={saveInfo} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input name="username" type="text" required value={info.username} onChange={onInfoChange} className="input" />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input name="email" type="email" required value={info.email} onChange={onInfoChange} className="input" />
            </div>
            <div className="flex justify-end pt-1">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Update Profile'}
              </button>
            </div>
          </form>
        </Section>

        {/* Change password */}
        <Section title="Change Password">
          <form onSubmit={savePwd} className="space-y-4">
            {[
              { name: 'old_password', label: 'Current Password', placeholder: 'Enter current password' },
              { name: 'new_password', label: 'New Password', placeholder: 'Min. 6 characters' },
              { name: 'confirm_password', label: 'Confirm New Password', placeholder: 'Repeat new password' },
            ].map(f => (
              <div key={f.name}>
                <label className="label">{f.label}</label>
                <input name={f.name} type="password" required value={pwd[f.name]} onChange={onPwdChange}
                  className="input" placeholder={f.placeholder} />
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm">
                {saving ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </form>
        </Section>
      </div>
    </main>
  )
}
