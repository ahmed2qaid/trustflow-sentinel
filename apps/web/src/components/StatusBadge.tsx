import type { Decision } from '../lib/api'

export function StatusBadge({decision, status}: {decision?: Decision; status?: string}) {
  const key = decision ?? status ?? 'draft'
  const label = key === 'REVIEW_REQUIRED' ? 'Review required' : key.replaceAll('_', ' ').toLowerCase()
  return <span className={`status-badge status-${key.toLowerCase()}`}>{label}</span>
}
