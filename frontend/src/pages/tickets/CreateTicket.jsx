import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const CATEGORIES = ['General', 'Bug', 'Feature Request', 'Support', 'Security', 'Performance', 'Documentation', 'Other']

export default function CreateTicket() {
  const navigate     = useNavigate()
  const { user }    = useAuth()
  const { addToast } = useToast()
  const [form, setForm]       = useState({
    name: '',
    department_business_unit: '',
    issue: '',
    category: '',
  })
  const [screenshotFile, setScreenshotFile] = useState(null)
  const [saving, setSaving]    = useState(false)

  useEffect(() => {
    // Default creator to the logged-in user
    if (user?.username) {
      setForm(f => (f.name ? f : { ...f, name: user.username }))
    }
  }, [user?.username])

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async e => {
    e.preventDefault()
    if (!(form.name || '').trim()) {
      addToast('Name is required.', 'error')
      return
    }
    if (!(form.department_business_unit || '').trim()) {
      addToast('Department / Business Unit is required.', 'error')
      return
    }
    if (!(form.category || '').trim()) {
      addToast('Category is required.', 'error')
      return
    }
    if (!(form.issue || '').trim()) {
      addToast('Issue is required.', 'error')
      return
    }
    setSaving(true)
    try {
      const issue = (form.issue || '').trim()
      const firstLine = issue.split(/\r?\n/).map(s => s.trim()).find(Boolean) || 'Issue'
      const title = firstLine.length > 200 ? `${firstLine.slice(0, 197)}...` : firstLine

      const body = {
        title,
        description: issue,
        category: (form.category || '').trim(),
        department_business_unit: (form.department_business_unit || '').trim(),
        requester_name: (form.name || '').trim(),
      }
      const d = await api.post('/tickets', body)
      if (screenshotFile) {
        const fd = new FormData()
        fd.append('file', screenshotFile)
        await api.postForm(`/tickets/${d.ticket.ticket_id}/screenshot`, fd)
      }
      addToast(`Ticket ${d.ticket.ticket_id} created successfully.`, 'success')
      navigate(`/tickets/${d.ticket.ticket_id}`)
    } catch (err) {
      addToast(err.message, 'error')
    } finally { setSaving(false) }
  }

  return (
    <main className="flex-1 overflow-y-auto bg-slate-100">
      <div className="page-header">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Create New Ticket</h1>
          <p className="text-xs text-slate-400 mt-0.5">Submit a concern or issue for tracking</p>
        </div>
        <Link to="/tickets/create" className="btn-primary opacity-0 pointer-events-none">New Ticket</Link>
      </div>

      <div className="p-6">
        <div className="max-w-3xl card overflow-hidden">
          <div className="card-header bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">Ticket Information</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fill in the details below</p>
          </div>

          <form onSubmit={onSubmit} className="p-6 space-y-5">
            <div>
              <label className="label">Name <span className="text-red-500">*</span></label>
              <input
                name="name"
                type="text"
                required
                value={form.name}
                onChange={onChange}
                className="input"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Department / Business Unit <span className="text-red-500">*</span></label>
              <input
                name="department_business_unit"
                type="text"
                required
                value={form.department_business_unit}
                onChange={onChange}
                className="input"
                placeholder="e.g. Finance, HR, Operations"
              />
            </div>
            <div>
              <label className="label">Issue <span className="text-red-500">*</span></label>
              <textarea
                name="issue"
                required
                rows={8}
                value={form.issue}
                onChange={onChange}
                className="input resize-none"
                placeholder="Type the issue here (you can include both the title and details). The first line will be used as the ticket title."
              />
            </div>

            <div>
              <label className="label">Insert Screenshot</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-800 hover:file:bg-blue-100"
              />
              <p className="text-xs text-slate-400 mt-1">Optional. PNG/JPG/WEBP/GIF.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label">Category</label>
                <select name="category" value={form.category} onChange={onChange} className="select">
                  <option value="">Set Category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Priority guide */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-600 mb-3">Priority Guide</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  { p: 'Low', cls: 'bg-blue-100 text-blue-700', desc: 'Minor issue, no urgency' },
                  { p: 'Medium', cls: 'bg-blue-100 text-blue-700', desc: 'Workaround exists' },
                  { p: 'High', cls: 'bg-orange-100 text-orange-700', desc: 'Needs prompt action' },
                  { p: 'Critical', cls: 'bg-red-100 text-red-700', desc: 'System down / data loss' },
                ].map(({ p, cls, desc }) => (
                  <div key={p} className="flex items-start gap-2">
                    <span className={`badge ${cls} mt-0.5 flex-shrink-0`}>{p}</span>
                    <span className="text-slate-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Submitting…' : 'Submit Ticket'}
              </button>
              <Link to="/tickets" className="btn-secondary">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
