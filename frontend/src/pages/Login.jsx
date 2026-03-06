import { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTimeFormat } from '../context/TimeFormatContext'

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

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

const DAY   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function Login() {
  const { login }       = useAuth()
  const navigate        = useNavigate()
  const now             = useClock()
  const { is24h, toggle } = useTimeFormat()
  const [form, setForm]       = useState({ identifier: '', password: '', remember: false })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [pwVisible, setPwVisible] = useState(false)

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const showPw = useCallback(() => setPwVisible(true), [])
  const hidePw = useCallback(() => setPwVisible(false), [])

  const onSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.identifier, form.password, form.remember)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const hours   = now.getHours()
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const ampm    = hours >= 12 ? 'PM' : 'AM'
  const hour12  = String(hours % 12 || 12).padStart(2, '0')
  const hour24  = String(hours).padStart(2, '0')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 flex items-center justify-center px-4">
      <div className="w-full max-w-4xl flex gap-8 items-center">

        {/* ── Clock panel ──────────────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col flex-1 items-center justify-center text-center gap-6 py-8">
          {/* Analogue clock face */}
          <div className="relative w-52 h-52">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-white/10 bg-white/5 backdrop-blur-sm" />
            {/* Hour markers */}
            {[...Array(12)].map((_, i) => {
              const angle = (i * 30) * (Math.PI / 180)
              const r = 88
              const cx = 104 + r * Math.sin(angle)
              const cy = 104 - r * Math.cos(angle)
              return (
                <div
                  key={i}
                  className={`absolute rounded-full ${i % 3 === 0 ? 'w-2 h-2 bg-white/70' : 'w-1 h-1 bg-white/30'}`}
                  style={{ left: cx - (i % 3 === 0 ? 4 : 2), top: cy - (i % 3 === 0 ? 4 : 2) }}
                />
              )
            })}
            {/* Hour hand */}
            <div
              className="absolute left-1/2 bottom-1/2 w-1 bg-white rounded-full origin-bottom"
              style={{
                height: '52px',
                transform: `translateX(-50%) rotate(${(hours % 12) * 30 + now.getMinutes() * 0.5}deg)`,
              }}
            />
            {/* Minute hand */}
            <div
              className="absolute left-1/2 bottom-1/2 w-0.5 bg-blue-300 rounded-full origin-bottom"
              style={{
                height: '68px',
                transform: `translateX(-50%) rotate(${now.getMinutes() * 6}deg)`,
              }}
            />
            {/* Second hand */}
            <div
              className="absolute left-1/2 bottom-1/2 origin-bottom"
              style={{
                width: '1px',
                height: '76px',
                background: '#f87171',
                transform: `translateX(-50%) rotate(${now.getSeconds() * 6}deg)`,
              }}
            />
            {/* Centre dot */}
            <div className="absolute left-1/2 top-1/2 w-3 h-3 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow" />
          </div>

          {/* Digital time */}
          <div className="text-center">
            <p className="text-6xl font-bold text-white tabular-nums tracking-tight">
              {is24h ? hour24 : hour12}:{minutes}
              <span className="text-3xl text-white/60 ml-1">{seconds}</span>
            </p>
            {!is24h && (
              <p className="text-lg font-medium text-blue-300 mt-1 tracking-widest uppercase">{ampm}</p>
            )}

            {/* Format toggle */}
            <div className="mt-3 inline-flex items-center bg-white/10 rounded-full p-0.5">
              <button
                onClick={() => !is24h || toggle()}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  !is24h ? 'bg-blue-500 text-white shadow' : 'text-white/50 hover:text-white/80'
                }`}
              >
                12H
              </button>
              <button
                onClick={() => is24h || toggle()}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  is24h ? 'bg-blue-500 text-white shadow' : 'text-white/50 hover:text-white/80'
                }`}
              >
                24H
              </button>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <p className="text-2xl font-semibold text-white">
              {DAY[now.getDay()]}
            </p>
            <p className="text-slate-400 text-sm">
              {MONTH[now.getMonth()]} {now.getDate()}, {now.getFullYear()}
            </p>
          </div>

          {/* Branding */}
          <div className="mt-4 border-t border-white/10 pt-6 w-full">
            <p className="text-white/40 text-xs tracking-widest uppercase">TicketFlow System</p>
            <p className="text-white/25 text-[11px] mt-1">Issue Tracking &amp; Support</p>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="hidden lg:block w-px self-stretch bg-white/10 flex-shrink-0" />

        {/* ── Login card ───────────────────────────────────────────────────── */}
        <div className="w-full max-w-md flex-shrink-0">
          <div className="bg-blue-50 rounded-2xl shadow-2xl overflow-hidden border border-blue-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-8 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">TicketFlow</h1>
              <p className="text-blue-100 text-sm mt-1">Sign in to your account</p>
            </div>

            {/* Form */}
            <div className="px-8 py-8">
              {error && (
                <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <label className="label">Username or Email</label>
                  <input name="identifier" type="text" required autoFocus value={form.identifier} onChange={onChange}
                    className="input" placeholder="Enter your username or email" />
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input name="password" type={pwVisible ? 'text' : 'password'} required
                      value={form.password} onChange={onChange}
                      className="input pr-10" placeholder="Enter your password"
                      autoComplete="current-password" />
                    <button
                      type="button"
                      onMouseDown={showPw}
                      onMouseUp={hidePw}
                      onMouseLeave={hidePw}
                      onTouchStart={showPw}
                      onTouchEnd={hidePw}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors select-none"
                      aria-label="Hold to reveal password"
                    >
                      {pwVisible ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" name="remember" id="remember" checked={form.remember} onChange={onChange}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">Remember me</label>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm">
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">Create account</Link>
              </p>
            </div>
          </div>
          <p className="text-center text-slate-400 text-xs mt-6">&copy; 2026 TicketFlow. All rights reserved.</p>
        </div>

      </div>
    </div>
  )
}
