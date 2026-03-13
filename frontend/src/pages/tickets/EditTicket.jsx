import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Spinner from '../../components/Spinner'

const STATUSES   = ['Open', 'In Progress', 'Under Review', 'Resolved', 'Closed']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const CATEGORIES = ['General', 'Bug', 'Feature Request', 'Support', 'Security', 'Performance', 'Documentation', 'Other']

export default function EditTicket() {
  const { ticketId }    = useParams()
  const { user }        = useAuth()
  const { addToast }    = useToast()
  const navigate        = useNavigate()
  const [ticket, setTicket] = useState(null)
  const [form, setForm]     = useState({})
  const [assignees, setAssignees] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    Promise.all([
      api.get(`/tickets/${ticketId}`),
      api.get('/utils/assignees'),
    ]).then(([d, a]) => {
      setTicket(d.ticket)
      setForm({
        requester_name: d.ticket.requester_name || d.ticket.created_by?.username || '',
        department_business_unit: d.ticket.department_business_unit || '',
        title:          d.ticket.title,
        description:    d.ticket.description,
        priority:       d.ticket.priority,
        category:       d.ticket.category,
        status:         d.ticket.status,
        assigned_to_id: d.ticket.assigned_to?.id?.toString() || '',
      })
      setAssignees(a.assignees)
    }).catch(() => navigate('/tickets')).finally(() => setLoading(false))
  }, [ticketId])

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        ...form,
        assigned_to_id: form.assigned_to_id ? parseInt(form.assigned_to_id) : null,
      }
      await api.put(`/tickets/${ticketId}`, body)
      addToast('Ticket updated successfully.', 'success')
      navigate(`/tickets/${ticketId}`)
    } catch (err) { addToast(err.message, 'error') }
    finally { setSaving(false) }
  }

  const isSupport = ['it_support', 'admin'].includes(user?.role)

  if (loading) return <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center"><Spinner size="lg" /></main>

  return (
    <main className="flex-1 overflow-y-auto bg-slate-100">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={`/tickets/${ticketId}`} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div>
            <h1 className="text-base font-semibold text-white">Edit Ticket</h1>
            <p className="text-xs text-slate-400 mt-0.5">{ticketId}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-3xl card overflow-hidden">
          <div className="card-header bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">Edit Ticket</h2>
            <p className="text-xs text-slate-500">Update the ticket information below</p>
          </div>

          <form onSubmit={onSubmit} className="p-6 space-y-5">
            <div>
              <label className="label">Name <span className="text-red-500">*</span></label>
              <input name="requester_name" type="text" required value={form.requester_name || ''} onChange={onChange} className="input" placeholder="Submitter name" />
            </div>
            <div>
              <label className="label">Department/Business Unit <span className="text-red-500">*</span></label>
              <input name="department_business_unit" type="text" required value={form.department_business_unit || ''} onChange={onChange} className="input" placeholder="e.g. Finance, HR, IT" />
            </div>
            <div>
              <label className="label">Title <span className="text-red-500">*</span></label>
              <input name="title" type="text" required maxLength={200} value={form.title || ''} onChange={onChange} className="input" />
            </div>
            <div>
              <label className="label">Description <span className="text-red-500">*</span></label>
              <textarea name="description" required rows={7} value={form.description || ''} onChange={onChange} className="input resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label">Category</label>
                <select name="category" value={form.category || ''} onChange={onChange} className="select">
                  {!form.category && <option value="">Set Category</option>}
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {isSupport && (
              <div className="pt-4 border-t border-slate-200">
                <label className="label">
                  Status <span className="text-xs text-blue-600 font-normal ml-1">(IT Support / Admin only)</span>
                </label>
                <select name="status" value={form.status || ''} onChange={onChange} className="select max-w-xs">
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {user?.role === 'admin' && (
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div>
                  <label className="label">
                    Priority <span className="text-xs text-blue-600 font-normal ml-1">(Admin only — set before assigning)</span>
                  </label>
                  <select name="priority" value={form.priority || ''} onChange={onChange} className="select max-w-xs">
                    {!form.priority && <option value="">Set Priority Level</option>}
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">
                    Assign to IT Personnel <span className="text-xs text-blue-600 font-normal ml-1">(Admin only)</span>
                  </label>
                  <select name="assigned_to_id" value={form.assigned_to_id || ''} onChange={onChange} className="select max-w-xs">
                    <option value="">— Unassigned —</option>
                    {assignees.map(a => <option key={a.id} value={a.id}>{a.username} ({a.role_label})</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <Link to={`/tickets/${ticketId}`} className="btn-secondary">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
