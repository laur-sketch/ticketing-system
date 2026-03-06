const STATUS_STYLES = {
  'Open':         'bg-blue-100 text-blue-700',
  'In Progress':  'bg-amber-100 text-amber-700',
  'Under Review': 'bg-purple-100 text-purple-700',
  'Resolved':     'bg-emerald-100 text-emerald-700',
  'Closed':       'bg-slate-100 text-slate-600',
}

const PRIORITY_STYLES = {
  Low:      'bg-blue-100 text-blue-700',
  Medium:   'bg-blue-100 text-blue-700',
  High:     'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status, large = false }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`badge ${cls} ${large ? 'text-sm px-3 py-1' : ''}`}>
      {status}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  const cls = PRIORITY_STYLES[priority] || 'bg-slate-100 text-slate-600'
  return <span className={`badge ${cls}`}>{priority}</span>
}

export function RoleBadge({ role, roleLabel }) {
  const styles = {
    admin:      'bg-indigo-100 text-indigo-700',
    it_support: 'bg-cyan-100 text-cyan-700',
    user:       'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`badge ${styles[role] || 'bg-slate-100 text-slate-600'}`}>
      {roleLabel || role}
    </span>
  )
}
