import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useToast } from '../../context/ToastContext'

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const CATEGORIES = ['General', 'Bug', 'Feature Request', 'Support', 'Security', 'Performance', 'Documentation', 'Other']

export default function CreateTicket() {
  const navigate    = useNavigate()
  const { addToast } = useToast()
  const [form, setForm]         = useState({ title: '', description: '', priority: 'Medium', category: 'General', assigned_to_id: '' })
  const [assignees, setAssignees] = useState([])
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    api.get('/utils/assignees').then(d => setAssignees(d.assignees)).catch(() => {})
  }, [])

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { ...form, assigned_to_id: form.assigned_to_id ? parseInt(form.assigned_to_id) : null }
      const d    = await api.post('/tickets', body)
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
              <label className="label">Title <span className="text-red-500">*</span></label>
              <input name="title" type="text" required maxLength={200} value={form.title} onChange={onChange}
                className="input" placeholder="Brief, descriptive title of the issue" />
            </div>
            <div>
              <label className="label">Description <span className="text-red-500">*</span></label>
              <textarea name="description" required rows={6} value={form.description} onChange={onChange}
                className="input resize-none"
                placeholder="Describe the issue in detail. Include steps to reproduce, expected behavior, and actual behavior…" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label">Priority</label>
                <select name="priority" value={form.priority} onChange={onChange} className="select">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1">Select the urgency level</p>
              </div>
              <div>
                <label className="label">Category</label>
                <select name="category" value={form.category} onChange={onChange} className="select">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {assignees.length > 0 && (
              <div>
                <label className="label">Assign to IT Personnel <span className="text-slate-400 font-normal">(optional)</span></label>
                <select name="assigned_to_id" value={form.assigned_to_id} onChange={onChange} className="select">
                  <option value="">— Unassigned —</option>
                  {assignees.map(a => <option key={a.id} value={a.id}>{a.username} ({a.role_label})</option>)}
                </select>
              </div>
            )}

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
