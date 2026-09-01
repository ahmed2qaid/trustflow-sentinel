import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { AlertCircle, ArrowRight } from 'lucide-react'

interface AuditEvent {
  id: string | number
  request_id: string | number
  request_key: string
  invoice_number: string
  action: string
  details_json?: unknown
  created_at: string
}

export function AuditActivity() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<AuditEvent[]>([])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const reqs = await api.requests()
        const audits = await Promise.all(
          reqs.map(async r => {
            const history = await api.audit(String(r.id)).catch(() => [])
            return history.map(h => ({
              ...h,
              request_key: r.request_key || String(r.id),
              invoice_number: r.invoice_number
            } as unknown as AuditEvent))
          })
        )
        const combined = audits.flat().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setEvents(combined as AuditEvent[])
      } catch {
        setError('Failed to load audit activity')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) return <div className="page"><div className="empty-state">Loading global audit log�</div></div>
  if (error) return <div className="page"><div className="error-banner"><AlertCircle size={18}/>{error}</div></div>

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">Governance</span>
          <h1>Audit Activity</h1>
          <p>Global timeline of evaluations, web intelligence, and decisions.</p>
        </div>
      </div>

      <section className="panel compact-panel">
        {events.length === 0 ? (
          <div className="empty-state">No audit activity found.</div>
        ) : (
          <div className="request-table">
            <div className="table-head">
              <span>Time</span>
              <span>Request</span>
              <span>Action</span>
              <span>Details</span>
              <span/>
            </div>
            {events.map((ev, i) => {
              const details = ev.details_json as Record<string, unknown> | undefined
              const summaryFragments = []
              if (details?.decision) summaryFragments.push(`Decision: ${String(details.decision)}`)
              if (details?.failed_stage) summaryFragments.push(`Failed: ${String(details.failed_stage)}`)
              if (details?.status) summaryFragments.push(`Status: ${String(details.status)}`)
              
              return (
                <div className="table-row" key={`${ev.id}-${i}`} style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>{new Date(ev.created_at).toLocaleString()}</span>
                  <span>
                    <strong>{ev.request_key}</strong>
                    <small>{ev.invoice_number}</small>
                  </span>
                  <span>
                    <strong style={{ fontSize: '0.9rem' }}>{ev.action}</strong>
                  </span>
                  <span>
                    {summaryFragments.length > 0 ? (
                      <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                        {summaryFragments.join(' | ')}
                      </span>
                    ) : (
                      <small style={{ color: '#9ca3af' }}>�</small>
                    )}
                  </span>
                  <Link to={`/requests/${ev.request_id}#activity`} className="row-arrow"><ArrowRight size={16}/></Link>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
