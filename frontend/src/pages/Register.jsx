import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)
const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
)

function PasswordInput({ name, value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false)

  const show = useCallback(() => setVisible(true), [])
  const hide = useCallback(() => setVisible(false), [])

  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? 'text' : 'password'}
        required
        value={value}
        onChange={onChange}
        className="input pr-10"
        placeholder={placeholder}
        autoComplete={name === 'password' ? 'new-password' : 'new-password'}
      />
      <button
        type="button"
        onMouseDown={show}
        onMouseUp={hide}
        onMouseLeave={hide}
        onTouchStart={show}
        onTouchEnd={hide}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors select-none"
        aria-label="Hold to reveal password"
      >
        {visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ username: '', email: '', role: '', password: '', confirm_password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/register', form)
      navigate('/login', { state: { message: 'Account created. Please sign in.' } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-blue-50 rounded-2xl shadow-2xl overflow-hidden border border-blue-200">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-7 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Create Account</h1>
            <p className="text-blue-100 text-sm mt-1">Join TicketFlow today</p>
          </div>

          <div className="px-8 py-8">
            {error && (
              <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">Username <span className="text-red-500">*</span></label>
                <input name="username" type="text" required autoFocus
                  value={form.username} onChange={onChange}
                  className="input" placeholder="Choose a username" />
              </div>

              <div>
                <label className="label">Email Address <span className="text-red-500">*</span></label>
                <input name="email" type="email" required
                  value={form.email} onChange={onChange}
                  className="input" placeholder="you@example.com" />
              </div>

              <div>
                <label className="label">Role <span className="text-red-500">*</span></label>
                <select name="role" required value={form.role} onChange={onChange} className="select">
                  <option value="" disabled>— Select your role —</option>
                  <option value="user">User</option>
                  <option value="it_support">IT Personnel</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Choose the role that matches your responsibilities.</p>
              </div>

              <div>
                <label className="label">Password <span className="text-red-500">*</span></label>
                <PasswordInput name="password" value={form.password} onChange={onChange}
                  placeholder="Min. 6 characters" />
              </div>

              <div>
                <label className="label">Confirm Password <span className="text-red-500">*</span></label>
                <PasswordInput name="confirm_password" value={form.confirm_password} onChange={onChange}
                  placeholder="Repeat your password" />
              </div>

              <div className="pt-1 bg-slate-100 rounded-lg px-3 py-2 border border-slate-200 text-xs text-slate-600">
                The <strong>first account</strong> created automatically receives{' '}
                <span className="text-blue-600 font-medium">Administrator</span> privileges regardless of role selected.
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm mt-2">
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
