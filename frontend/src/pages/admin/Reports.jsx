import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'
import { useTimeFormat } from '../../context/TimeFormatContext'
import Spinner from '../../components/Spinner'

// ── colour maps ──────────────────────────────────────────────────────────────
const PRIORITY_COLOR = {
  Critical: { bar: 'bg-red-500',     badge: 'bg-red-100 text-red-700'       },
  High:     { bar: 'bg-orange-400',  badge: 'bg-orange-100 text-orange-700'  },
  Medium:   { bar: 'bg-blue-400', badge: 'bg-blue-100 text-blue-700' },
  Low:      { bar: 'bg-blue-400', badge: 'bg-blue-100 text-blue-700' },
}
const STATUS_COLOR = {
  'Open':          { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  'In Progress':   { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700'   },
  'Under Review':  { bar: 'bg-violet-400',  badge: 'bg-violet-100 text-violet-700' },
  'Resolved':      { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  'Closed':        { bar: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600'   },
}
const CAT_COLORS = [
  'bg-violet-500','bg-cyan-500','bg-pink-500','bg-blue-500',
  'bg-indigo-500','bg-blue-500','bg-rose-500','bg-lime-500',
]

// ── csv helper ────────────────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape  = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines   = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── horizontal bar row ────────────────────────────────────────────────────────
function BarRow({ label, count, max, barClass, badge }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        {badge
          ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>{label}</span>
          : <span className="text-xs font-medium text-slate-700 truncate max-w-[55%]">{label}</span>
        }
        <span className="text-xs font-semibold text-slate-500 tabular-nums flex-shrink-0">{count}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── column timeline chart ─────────────────────────────────────────────────────
function Timeline({ rows }) {
  if (!rows.length) return <p className="text-sm text-slate-500 italic py-4 text-center">No data</p>
  const max = Math.max(...rows.map(r => r.count))
  return (
    <div className="flex items-end gap-1.5 h-40 px-1">
      {rows.map(r => {
        const pct = max > 0 ? Math.round((r.count / max) * 100) : 0
        return (
          <div key={r.key} className="flex flex-col items-center gap-1 flex-1 min-w-0 group">
            <span className="text-[10px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
              {r.count}
            </span>
            <div className="w-full bg-slate-100 rounded-t-sm relative" style={{ height: '100px' }}>
              <div
                className="absolute bottom-0 w-full bg-blue-500 rounded-t-sm transition-all duration-500 group-hover:bg-blue-600"
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-500 truncate w-full text-center leading-tight">{r.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'blue' }) {
  const styles = {
    blue:   { wrap: 'border-blue-200 bg-blue-50', val: 'text-blue-700' },
    green:  { wrap: 'border-emerald-200 bg-emerald-50', val: 'text-emerald-700' },
    violet: { wrap: 'border-violet-200 bg-violet-50', val: 'text-violet-700' },
  }
  const s = styles[color] ?? styles.blue
  return (
    <div className={`rounded-xl border p-4 ${s.wrap}`}>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${s.val}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1 truncate">{sub}</p>}
    </div>
  )
}

// ── chart card wrapper ────────────────────────────────────────────────────────
function ChartCard({ title, sub, children }) {
  return (
    <div className="bg-blue-50/90 rounded-xl border border-blue-200/80 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
      </div>
      {children}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const { fmtDateTime } = useTimeFormat()
  const [period,  setPeriod]  = useState('month')     // 'week' | 'month'
  const [month,   setMonth]   = useState('')           // 'YYYY-MM' or ''
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ period })
    if (month) params.set('month', month)
    api.get(`/reports/tickets?${params}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period, month])

  useEffect(() => { load() }, [load])

  // ── derived ───────────────────────────────────────────────────────────────
  const resolvedCount  = data?.by_status?.find(s => s.status === 'Resolved')?.count ?? 0
  const closedCount    = data?.by_status?.find(s => s.status === 'Closed')?.count ?? 0
  const topCategory    = data?.by_category?.[0]
  const topPersonnel   = data?.by_personnel?.[0]

  // ── export handlers ────────────────────────────────────────────────────────
  const getMonthLabel = () =>
    month ? (data?.available_months?.find(m => m.value === month)?.label ?? month) : 'All Time'

  /** Export CSV: summary sections followed by full ticket records */
  const exportCSV = () => {
    if (!data) return
    const monthLabel   = getMonthLabel()
    const generatedAt  = fmtDateTime(new Date().toISOString())
    const resolvedTotal = (data.by_status?.find(s => s.status === 'Resolved')?.count ?? 0)
                        + (data.by_status?.find(s => s.status === 'Closed')?.count ?? 0)

    // Use a single-column approach so Excel opens it cleanly
    const e = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = []

    const header = (txt) => { lines.push(''); lines.push(e(txt)); lines.push('') }
    const row2   = (a, b)       => lines.push(`${e(a)},${e(b)}`)
    const row3   = (a, b, c)    => lines.push(`${e(a)},${e(b)},${e(c)}`)
    const row4   = (a, b, c, d) => lines.push(`${e(a)},${e(b)},${e(c)},${e(d)}`)

    // ── cover ──────────────────────────────────────────────────────────────
    lines.push(e('TICKETFLOW — TICKET REPORT'))
    row2('Period',       monthLabel)
    row2('Generated',   generatedAt)
    row2('Total Tickets', data.total)
    row2('Resolved + Closed', resolvedTotal)

    // ── by status ──────────────────────────────────────────────────────────
    header('BY STATUS')
    row2('Status', 'Count')
    data.by_status.forEach(r => row2(r.status, r.count))

    // ── by category ───────────────────────────────────────────────────────
    header('BY CATEGORY')
    row2('Category', 'Count')
    data.by_category.forEach(r => row2(r.category, r.count))

    // ── by priority ───────────────────────────────────────────────────────
    header('BY PRIORITY')
    row2('Priority', 'Count')
    data.by_priority.forEach(r => row2(r.priority, r.count))

    // ── resolved by personnel ─────────────────────────────────────────────
    header('RESOLVED BY PERSONNEL')
    row3('Name', 'Role', 'Resolved Tickets')
    data.by_personnel.forEach(r => row3(r.username, r.role_label, r.count))

    // ── by period ─────────────────────────────────────────────────────────
    header(`TICKETS ${period === 'week' ? 'PER WEEK' : 'PER MONTH'}`)
    row2('Period', 'Count')
    data.by_period.forEach(r => row2(r.label, r.count))

    // ── ticket records ────────────────────────────────────────────────────
    header('TICKET RECORDS')
    row4('Ticket ID', 'Title', 'Status', 'Category') // first half of columns
    lines[lines.length - 1] =   // extend the last line
      `${e('Ticket ID')},${e('Title')},${e('Status')},${e('Category')},${e('Priority')},${e('Assigned To')},${e('Created By')},${e('Created At')},${e('Last Updated')},${e('Archived')}`
    data.tickets.forEach(t => {
      lines.push(
        [t.ticket_id, t.title, t.status, t.category, t.priority,
         t.assigned_to, t.created_by, fmtDateTime(t.created_at),
         fmtDateTime(t.updated_at), t.is_archived ? 'Yes' : 'No'
        ].map(e).join(',')
      )
    })

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `ticket_report_${monthLabel.replace(/\s/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Export Summary: open a print-ready HTML page → user saves as PDF */
  const exportPDF = () => {
    if (!data) return
    const monthLabel    = getMonthLabel()
    const generatedAt   = fmtDateTime(new Date().toISOString())
    const resolvedTotal = (data.by_status?.find(s => s.status === 'Resolved')?.count ?? 0)
                        + (data.by_status?.find(s => s.status === 'Closed')?.count ?? 0)

    const tableRows = (rows, cols) =>
      rows.map(r => `<tr>${cols.map(c => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`).join('')

    const barRows = (rows, labelKey, valKey = 'count') => {
      const max = Math.max(...rows.map(r => r[valKey]), 1)
      return rows.map(r => {
        const pct = Math.round((r[valKey] / max) * 100)
        return `<tr>
          <td style="width:35%;font-weight:600">${r[labelKey]}</td>
          <td style="width:55%">
            <div style="background:#e2e8f0;border-radius:4px;height:10px;overflow:hidden">
              <div style="background:#3b82f6;height:100%;width:${pct}%;border-radius:4px"></div>
            </div>
          </td>
          <td style="width:10%;text-align:right;font-weight:700">${r[valKey]}</td>
        </tr>`
      }).join('')
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ticket Report — ${monthLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 32px; }
  h1   { font-size: 22px; font-weight: 700; color: #0f172a; }
  h2   { font-size: 14px; font-weight: 700; color: #1e40af; margin: 28px 0 10px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 2px solid #dbeafe; padding-bottom: 4px; }
  .meta { color: #64748b; font-size: 12px; margin-top: 4px; }
  .cards { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 20px 0; }
  .card  { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; background: #f8fafc; }
  .card-val  { font-size: 28px; font-weight: 800; color: #1d4ed8; margin-top: 4px; }
  .card-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
  table  { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { padding: 7px 10px; text-align: left; font-size: 12px; }
  thead tr { background: #eff6ff; }
  th  { font-weight: 700; color: #1e40af; font-size: 11px; text-transform: uppercase; letter-spacing:.05em; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  td  { border-bottom: 1px solid #f1f5f9; }
  .badge { display:inline-block; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:700; }
  .b-open   { background:#dbeafe; color:#1e40af }
  .b-prog   { background:#fef3c7; color:#92400e }
  .b-review { background:#ede9fe; color:#6d28d9 }
  .b-res    { background:#d1fae5; color:#065f46 }
  .b-closed { background:#f1f5f9; color:#475569 }
  .b-crit   { background:#fee2e2; color:#991b1b }
  .b-high   { background:#ffedd5; color:#9a3412 }
  .b-med    { background:#dbeafe; color:#1e40af }
  .b-low    { background:#d1fae5; color:#065f46 }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print {
    body { padding: 0; }
    @page { margin: 20mm; }
  }
</style>
</head>
<body>

<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <h1>TicketFlow &mdash; Ticket Report</h1>
    <p class="meta">Period: <strong>${monthLabel}</strong> &nbsp;|&nbsp; Generated: <strong>${generatedAt}</strong></p>
  </div>
  <div style="text-align:right;font-size:11px;color:#94a3b8">TicketFlow System<br>Issue Tracking &amp; Support</div>
</div>

<div class="cards">
  <div class="card"><div class="card-label">Total Tickets</div><div class="card-val">${data.total}</div></div>
  <div class="card"><div class="card-label">Resolved + Closed</div><div class="card-val">${resolvedTotal}</div></div>
  <div class="card"><div class="card-label">Top Category</div><div class="card-val" style="font-size:18px">${data.by_category[0]?.category ?? '—'}</div><div class="meta">${data.by_category[0]?.count ?? 0} tickets</div></div>
  <div class="card"><div class="card-label">Top Resolver</div><div class="card-val" style="font-size:18px">${data.by_personnel[0]?.username ?? '—'}</div><div class="meta">${data.by_personnel[0]?.count ?? 0} resolved</div></div>
</div>

<h2>Tickets by Status</h2>
<table>
  <thead><tr><th>Status</th><th>Distribution</th><th>Count</th></tr></thead>
  <tbody>${barRows(data.by_status, 'status')}</tbody>
</table>

<h2>Tickets by Category</h2>
<table>
  <thead><tr><th>Category</th><th>Distribution</th><th>Count</th></tr></thead>
  <tbody>${barRows(data.by_category, 'category')}</tbody>
</table>

<h2>Tickets by Priority</h2>
<table>
  <thead><tr><th>Priority</th><th>Distribution</th><th>Count</th></tr></thead>
  <tbody>${barRows(data.by_priority, 'priority')}</tbody>
</table>

<h2>Resolved Tickets by Assigned Personnel</h2>
<table>
  <thead><tr><th>#</th><th>Name</th><th>Role</th><th style="text-align:right">Resolved</th></tr></thead>
  <tbody>${data.by_personnel.map((p, i) => `
    <tr>
      <td style="color:#94a3b8;font-weight:600">#${i + 1}</td>
      <td style="font-weight:600">${p.username}</td>
      <td style="color:#64748b">${p.role_label}</td>
      <td style="text-align:right;font-weight:700">${p.count}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px">No resolved tickets</td></tr>'}
  </tbody>
</table>

<h2>Tickets ${period === 'week' ? 'per Week' : 'per Month'}</h2>
<table>
  <thead><tr><th>Period</th><th>Distribution</th><th>Count</th></tr></thead>
  <tbody>${barRows(data.by_period, 'label')}</tbody>
</table>

<div class="footer">TicketFlow &mdash; Ticket Report &mdash; ${monthLabel} &mdash; ${generatedAt}</div>

<script>window.onload = () => { window.print() }<\/script>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* page header */}
      <div className="flex-shrink-0 bg-blue-100/90 border-b border-blue-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Ticket Reports</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Analytics across all tickets
              {month && data
                ? ` · ${data.available_months?.find(m => m.value === month)?.label ?? month}`
                : ' · All Time'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">

            {/* month picker */}
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <select
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400 cursor-pointer"
              >
                <option value="">All Time</option>
                {(data?.available_months ?? []).map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* period toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {['week', 'month'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    period === p
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {p === 'week' ? 'By Week' : 'By Month'}
                </button>
              ))}
            </div>

            {/* export buttons */}
            <button
              onClick={exportPDF}
              disabled={!data || loading}
              title="Opens a print-ready summary — save as PDF from the print dialog"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Export Summary
            </button>
            <button
              onClick={exportCSV}
              disabled={!data || loading}
              title="Downloads one CSV file: summary breakdown + all ticket records"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto bg-blue-50/50 p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : !data ? (
          <p className="text-center text-slate-500 py-20">Failed to load report data.</p>
        ) : (
          <>
            {/* ── summary cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard color="blue"   label="Total Tickets"         value={data.total} />
              <StatCard color="green"  label="Resolved + Closed"     value={resolvedCount + closedCount} />
              <StatCard color="blue"  label="Top Category"          value={topCategory?.count ?? 0}   sub={topCategory?.category} />
              <StatCard color="violet" label="Top Resolver"          value={topPersonnel?.count ?? 0}  sub={topPersonnel?.username} />
            </div>

            {/* ── by status + by category ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Tickets by Status" sub={`${data.by_status.length} statuses`}>
                {data.by_status.length === 0
                  ? <p className="text-sm text-slate-500 italic py-4 text-center">No data</p>
                  : (() => {
                    const max = Math.max(...data.by_status.map(r => r.count))
                    return (
                      <div className="space-y-2.5">
                        {data.by_status.map(r => {
                          const c = STATUS_COLOR[r.status] ?? { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' }
                          return (
                            <BarRow key={r.status} label={r.status} count={r.count}
                              max={max} barClass={c.bar} badge={c.badge} />
                          )
                        })}
                      </div>
                    )
                  })()
                }
              </ChartCard>

              <ChartCard title="Tickets by Category" sub={`${data.by_category.length} categories`}>
                {data.by_category.length === 0
                  ? <p className="text-sm text-slate-500 italic py-4 text-center">No data</p>
                  : (() => {
                    const max = Math.max(...data.by_category.map(r => r.count))
                    return (
                      <div className="space-y-2.5">
                        {data.by_category.map((r, i) => (
                          <BarRow key={r.category} label={r.category} count={r.count}
                            max={max} barClass={CAT_COLORS[i % CAT_COLORS.length]} />
                        ))}
                      </div>
                    )
                  })()
                }
              </ChartCard>
            </div>

            {/* ── by priority ─────────────────────────────────────────────── */}
            <ChartCard title="Tickets by Priority" sub={`${data.by_priority.length} levels`}>
              {data.by_priority.length === 0
                ? <p className="text-sm text-slate-500 italic py-4 text-center">No data</p>
                : (() => {
                  const max = Math.max(...data.by_priority.map(r => r.count))
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {data.by_priority.map(r => {
                        const c   = PRIORITY_COLOR[r.priority] ?? { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' }
                        const pct = max > 0 ? Math.round((r.count / max) * 100) : 0
                        return (
                          <div key={r.priority} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${c.badge}`}>{r.priority}</span>
                            <p className="text-3xl font-bold text-slate-800 tabular-nums">{r.count}</p>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
              }
            </ChartCard>

            {/* ── resolved by personnel ───────────────────────────────────── */}
            <div className="bg-blue-50/90 rounded-xl border border-blue-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Resolved Tickets by Assigned Personnel</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Counts Resolved &amp; Closed tickets per assignee</p>
                </div>
                <span className="text-xs text-slate-500">{data.by_personnel.length} personnel</span>
              </div>
              {data.by_personnel.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-8 text-center">No resolved tickets assigned yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="th text-left px-5 py-3">Rank</th>
                      <th className="th text-left px-5 py-3">Personnel</th>
                      <th className="th text-left px-5 py-3">Role</th>
                      <th className="th text-right px-5 py-3">Resolved</th>
                      <th className="th text-left px-5 py-3 w-44">Share of resolved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.by_personnel.map((p, i) => {
                      const resolvedTotal = resolvedCount + closedCount
                      const pct = resolvedTotal > 0 ? Math.round((p.count / resolvedTotal) * 100) : 0
                      return (
                        <tr key={p.username} className="hover:bg-slate-50 transition-colors">
                          <td className="td px-5 py-3 text-slate-500 font-semibold tabular-nums">#{i + 1}</td>
                          <td className="td px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {p.username.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="font-medium text-slate-800">{p.username}</span>
                            </div>
                          </td>
                          <td className="td px-5 py-3 text-slate-500 text-xs">{p.role_label}</td>
                          <td className="td px-5 py-3 text-right font-semibold text-slate-800 tabular-nums">{p.count}</td>
                          <td className="td px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-slate-500 tabular-nums w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── by period timeline ──────────────────────────────────────── */}
            <div className="bg-blue-50/90 rounded-xl border border-blue-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-slate-800">
                  Total Tickets {period === 'week' ? 'per Week' : 'per Month'}
                </h2>
                <span className="text-xs text-slate-500">{data.by_period.length} periods</span>
              </div>
              {data.by_period.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-4 text-center">No data</p>
              ) : (
                <>
                  <Timeline rows={data.by_period} />
                  <div className="mt-4 border-t border-slate-100 pt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {data.by_period.map(r => (
                      <div key={r.key} className="text-center p-2 bg-slate-50 rounded-lg">
                        <p className="text-[11px] text-slate-500 leading-tight">{r.label}</p>
                        <p className="text-lg font-bold text-blue-600 tabular-nums">{r.count}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── all tickets table ───────────────────────────────────────── */}
            <div className="bg-blue-50/90 rounded-xl border border-blue-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">All Tickets</h2>
                <span className="text-xs text-slate-500">{data.tickets.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="th text-left px-4 py-3">Ticket ID</th>
                      <th className="th text-left px-4 py-3">Title</th>
                      <th className="th text-left px-4 py-3">Status</th>
                      <th className="th text-left px-4 py-3">Category</th>
                      <th className="th text-left px-4 py-3">Priority</th>
                      <th className="th text-left px-4 py-3">Assigned To</th>
                      <th className="th text-left px-4 py-3">Created By</th>
                      <th className="th text-left px-4 py-3">Created At</th>
                      <th className="th text-left px-4 py-3">Archived</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.tickets.map(t => {
                      const pc = PRIORITY_COLOR[t.priority] ?? { badge: 'bg-slate-100 text-slate-700' }
                      const sc = STATUS_COLOR[t.status]    ?? { badge: 'bg-slate-100 text-slate-600' }
                      return (
                        <tr key={t.ticket_id} className={`hover:bg-slate-50 transition-colors ${t.is_archived ? 'bg-blue-50/40' : ''}`}>
                          <td className="td px-4 py-2.5 font-mono text-xs text-blue-600 font-semibold">{t.ticket_id}</td>
                          <td className="td px-4 py-2.5 text-slate-800 max-w-xs truncate" title={t.title}>{t.title}</td>
                          <td className="td px-4 py-2.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.badge}`}>{t.status}</span>
                          </td>
                          <td className="td px-4 py-2.5 text-slate-600 text-xs">{t.category}</td>
                          <td className="td px-4 py-2.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pc.badge}`}>{t.priority}</span>
                          </td>
                          <td className="td px-4 py-2.5 text-slate-700 text-xs">{t.assigned_to}</td>
                          <td className="td px-4 py-2.5 text-slate-500 text-xs">{t.created_by}</td>
                          <td className="td px-4 py-2.5 text-slate-500 text-xs tabular-nums whitespace-nowrap">
                            {fmtDateTime(t.created_at)}
                          </td>
                          <td className="td px-4 py-2.5">
                            {t.is_archived
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Archived</span>
                              : <span className="text-xs text-slate-300">—</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
