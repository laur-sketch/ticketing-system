import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useSocket } from '../../context/SocketContext'
import { StatusBadge, PriorityBadge } from '../../components/Badge'
import Spinner from '../../components/Spinner'
import ConfirmModal from '../../components/ConfirmModal'
import { useTimeFormat } from '../../context/TimeFormatContext'

const STATUSES = ['Open', 'In Progress', 'Under Review', 'Resolved', 'Closed']
const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function TicketDetail() {
  const { ticketId }         = useParams()
  const { user }             = useAuth()
  const { addToast }         = useToast()
  const socket               = useSocket()
  const navigate             = useNavigate()
  const { search }           = useLocation()
  const { fmtDateTime, fmtTime } = useTimeFormat()
  const fromArchive          = search.includes('from=archive')
  const [data, setData]         = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [comment, setComment]   = useState('')
  const [saving, setSaving]     = useState(false)
  const myCommentIds            = useRef(new Set())
  const [statusSaving, setStatusSaving] = useState(false)
  const [deleteModal, setDeleteModal]     = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [restoreModal, setRestoreModal]   = useState(false)
  const [restoring, setRestoring]         = useState(false)

  const load = () => {
    setLoading(true)
    api.get(`/tickets/${ticketId}`)
      .then(d => { setData(d); setComments(d.comments ?? []) })
      .catch(() => navigate('/tickets'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [ticketId])

  // Join / leave the socket room for this ticket
  useEffect(() => {
    if (!socket || !ticketId) return
    socket.emit('join_ticket', { ticket_id: ticketId })
    return () => socket.emit('leave_ticket', { ticket_id: ticketId })
  }, [socket, ticketId])

  // Real-time comment streaming
  useEffect(() => {
    if (!socket) return
    const onNewComment = (c) => {
      // Skip if we already added it locally from our own POST response
      if (myCommentIds.current.has(c.id)) {
        myCommentIds.current.delete(c.id)
        return
      }
      setComments(prev => [...prev, c])
    }
    socket.on('new_comment', onNewComment)
    return () => socket.off('new_comment', onNewComment)
  }, [socket])

  const ticket = data?.ticket

  const isAdmin    = user?.role === 'admin'
  const isSupport  = ['it_support', 'admin'].includes(user?.role)
  const isOwner    = ticket && user?.id === ticket.created_by?.id
  const canEdit    = ticket && !ticket.is_archived && (isOwner || isSupport)
  const canClaim   = isSupport && ticket && !ticket.assigned_to && !ticket.is_archived
  const canDelete  = ticket && !ticket.is_archived && (
    isAdmin || (isOwner && ['Open', 'In Progress'].includes(ticket.status))
  )
  const submitComment = async e => {
    e.preventDefault()
    if (!comment.trim()) return
    setSaving(true)
    try {
      const res = await api.post(`/tickets/${ticketId}/comments`, { content: comment })
      // Track ID so the socket echo doesn't double-add it
      myCommentIds.current.add(res.comment.id)
      setComments(prev => [...prev, res.comment])
      setComment('')
      addToast('Comment posted.', 'success')
    } catch (err) { addToast(err.message, 'error') }
    finally { setSaving(false) }
  }

  const updateStatus = async (status) => {
    setStatusSaving(true)
    try {
      await api.patch(`/tickets/${ticketId}/status`, { status })
      addToast(`Status updated to "${status}".`, 'success')
      load()
    } catch (err) { addToast(err.message, 'error') }
    finally { setStatusSaving(false) }
  }

  const claim = async () => {
    try {
      await api.post(`/tickets/${ticketId}/claim`, {})
      addToast('Ticket claimed and assigned to you.', 'success')
      load()
    } catch (err) { addToast(err.message, 'error') }
  }

  const deleteTicket = async () => {
    setDeleting(true)
    try {
      await api.delete(`/tickets/${ticketId}`)
      addToast('Ticket deleted successfully.', 'info')
      navigate('/tickets/my')
    } catch (err) {
      addToast(err.message, 'error')
      setDeleteModal(false)
    } finally { setDeleting(false) }
  }

  const restoreTicket = async () => {
    setRestoring(true)
    try {
      const res = await api.post(`/tickets/${ticketId}/restore`, {})
      addToast('Ticket restored from archive.', 'success')
      setRestoreModal(false)
      setData(prev => ({ ...prev, ticket: res.ticket }))
    } catch (err) {
      addToast(err.message, 'error')
      setRestoreModal(false)
    } finally { setRestoring(false) }
  }

  if (loading) return <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center"><Spinner size="lg" /></main>
  if (!ticket) return null

  return (
    <main className="flex-1 overflow-y-auto bg-slate-100">
      {ticket.is_archived && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <div>
              <span className="text-sm font-semibold text-blue-800">Archived Ticket</span>
              <span className="text-sm text-blue-700 ml-2">This ticket is read-only. Restore it to allow edits.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {fromArchive && (
              <Link to="/admin/archive"
                className="text-xs font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2">
                ← Back to Archive
              </Link>
            )}
            {isAdmin && (
              <button onClick={() => setRestoreModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restore Ticket
              </button>
            )}
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="text-base font-semibold text-slate-800">{ticket.ticket_id}</h1>
          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-lg">{ticket.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {canClaim && (
            <button onClick={claim}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 border border-blue-300 bg-blue-50 rounded-lg px-4 py-2 hover:bg-blue-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
              Claim Ticket
            </button>
          )}
          {canEdit && (
            <Link to={`/tickets/${ticketId}/edit`} className="btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit
            </Link>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left */}
          <div className="lg:col-span-2 space-y-5">
            {/* Body */}
            <div className="card">
              <div className="card-header">
                <h1 className="text-lg font-semibold text-slate-900 leading-tight">{ticket.title}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge status={ticket.status} large />
                  <PriorityBadge priority={ticket.priority} />
                  <span className="text-xs text-slate-400">{ticket.category}</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Description</h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </div>

            {/* Quick status (IT Support — hidden for archived tickets) */}
            {isSupport && !ticket.is_archived && (
              <div className="card p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Status Update</h3>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map(s => (
                    <button key={s} disabled={statusSaving} onClick={() => updateStatus(s)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all disabled:opacity-60
                        ${ticket.status === s
                          ? { Open: 'bg-emerald-100 text-emerald-700 border-emerald-200 ring-2 ring-emerald-400 ring-offset-1', 'In Progress': 'bg-amber-100 text-amber-700 border-amber-200 ring-2 ring-amber-400 ring-offset-1', 'Under Review': 'bg-purple-100 text-purple-700 border-purple-200 ring-2 ring-purple-400 ring-offset-1', Resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200 ring-2 ring-emerald-400 ring-offset-1', Closed: 'bg-slate-100 text-slate-700 border-slate-200 ring-2 ring-slate-400 ring-offset-1' }[s]
                          : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-slate-800">
                  Comments <span className="ml-2 text-xs font-normal text-slate-400">{comments.length}</span>
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {comments.map(c => (
                  <div key={c.id} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 text-xs font-bold mt-0.5">
                        {c.author.initials}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-slate-800">{c.author.username}</span>
                          <span className="text-xs text-slate-400">{fmtDateTime(c.created_at)}</span>
                          {['it_support', 'admin'].includes(c.author.role) && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{c.author.role_label}</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 mt-1.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!comments.length && (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm text-slate-400">
                      {ticket.is_archived ? 'No comments were added to this ticket.' : 'No comments yet. Be the first to respond.'}
                    </p>
                  </div>
                )}
              </div>
              {ticket.is_archived ? (
                <div className="px-6 py-4 bg-blue-50 border-t border-blue-200 rounded-b-xl flex items-center gap-3">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-xs text-blue-700 font-medium">This ticket is archived and read-only. New comments are not allowed.</p>
                </div>
              ) : (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-xl">
                  <form onSubmit={submitComment}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 text-xs font-bold mt-0.5">
                        {user?.initials}
                      </div>
                      <div className="flex-1">
                        <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} required
                          placeholder="Add a comment or update…"
                          className="input resize-none" />
                        <div className="flex justify-end mt-2">
                          <button type="submit" disabled={saving} className="btn-primary">
                            {saving ? 'Posting…' : 'Post Comment'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Details */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Ticket Details</h3>
              <dl className="space-y-3.5 text-sm">
                {[
                  { label: 'Ticket ID', val: <span className="font-mono font-bold text-blue-600">{ticket.ticket_id}</span> },
                  { label: 'Status', val: <StatusBadge status={ticket.status} /> },
                  { label: 'Priority', val: <PriorityBadge priority={ticket.priority} /> },
                  { label: 'Category', val: <span className="text-slate-700">{ticket.category}</span> },
                  { label: 'Department/Business Unit', val: <span className="text-slate-700">{ticket.department_business_unit || '—'}</span> },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-400 mb-1">{label}</dt>
                    <dd>{val}</dd>
                  </div>
                ))}
                <div className="pt-1 border-t border-slate-100">
                  <dt className="text-xs text-slate-400 mb-1">Submitted By</dt>
                  <dd className="flex items-center gap-2">
                    {(() => {
                      const name = ticket.requester_name || ticket.created_by?.username || ''
                      const initials = name
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map(part => part[0]?.toUpperCase() || '')
                        .join('') || '??'
                      return (
                        <>
                          <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                            {initials}
                          </span>
                          <span className="text-slate-700 font-medium">{name}</span>
                        </>
                      )
                    })()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400 mb-1">Assigned To</dt>
                  <dd>
                    {ticket.assigned_to
                      ? <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">{ticket.assigned_to.initials}</span>
                          <span className="text-slate-700 font-medium">{ticket.assigned_to.username}</span>
                        </div>
                      : <span className="text-slate-400 italic">Unassigned</span>}
                  </dd>
                </div>
                <div className="pt-1 border-t border-slate-100">
                  <dt className="text-xs text-slate-400 mb-1">Created</dt>
                  <dd className="text-slate-700 leading-snug">
                    {fmt(ticket.created_at)}
                    <span className="block text-xs text-slate-500 tabular-nums mt-0.5">
                      {fmtTime(ticket.created_at)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400 mb-1">Last Updated</dt>
                  <dd className="text-slate-700 leading-snug">
                    {fmt(ticket.updated_at)}
                    <span className="block text-xs text-slate-500 tabular-nums mt-0.5">
                      {fmtTime(ticket.updated_at)}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Activity log */}
            {data?.logs?.length > 0 && (
              <div className="card p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Activity Log</h3>
                <div className="space-y-3">
                  {data.logs.slice(0, 10).map(log => (
                    <div key={log.id} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 text-slate-500" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>
                      </div>
                      <div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          <span className="font-medium">{log.user.username}</span> — {log.action}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger zone */}
            {canDelete && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Danger Zone</h3>
                <p className="text-xs text-red-500 mb-3">
                  {isAdmin
                    ? 'Admins can delete any ticket. This action cannot be undone.'
                    : 'You can delete this ticket because it is still Open or In Progress. This cannot be undone.'}
                </p>
                <button onClick={() => setDeleteModal(true)} className="w-full btn-danger justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Ticket
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={deleteTicket}
        loading={deleting}
        title="Delete Ticket"
        message={`Are you sure you want to delete ticket ${ticket.ticket_id}? This action cannot be undone and the ticket will be permanently removed.`}
        confirmLabel="Yes, Delete Ticket"
        confirmClass="btn-danger"
      />
      <ConfirmModal
        isOpen={restoreModal}
        onClose={() => setRestoreModal(false)}
        onConfirm={restoreTicket}
        loading={restoring}
        title="Restore Ticket"
        message={`Restore ticket ${ticket.ticket_id} from the archive? It will become active again and editable.`}
        confirmLabel="Yes, Restore Ticket"
        confirmClass="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      />
    </main>
  )
}
