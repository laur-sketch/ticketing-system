export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.pages <= 1) return null
  const { page, pages, has_prev, has_next, prev_num, next_num } = pagination

  const range = []
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) range.push(i)

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
      <p className="text-xs text-slate-500">Page {page} of {pages}</p>
      <div className="flex items-center gap-1">
        {has_prev && (
          <button onClick={() => onPageChange(prev_num)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            ← Prev
          </button>
        )}
        {1 < range[0] && <span className="px-2 text-slate-400 text-xs">…</span>}
        {range.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
              ${p === page
                ? 'bg-indigo-600 text-white border border-indigo-600'
                : 'text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>
            {p}
          </button>
        ))}
        {range[range.length - 1] < pages && <span className="px-2 text-slate-400 text-xs">…</span>}
        {has_next && (
          <button onClick={() => onPageChange(next_num)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
