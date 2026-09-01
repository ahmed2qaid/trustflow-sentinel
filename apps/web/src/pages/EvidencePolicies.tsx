import { useEffect, useState } from 'react'
import { api, type PolicyResult } from '../lib/api'
import { AlertCircle } from 'lucide-react'

interface AggregatedRule {
  rule_code: string
  label: string
  severity: string
  reason: string
  evaluated: number
  pass: number
  fail: number
}

export function EvidencePolicies() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState<Record<string, AggregatedRule>>({})

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const reqs = await api.requests()
        const evaluatedReqs = reqs.filter(r => r.policy_decision || r.final_decision)
        
        const allResults = await Promise.all(
          evaluatedReqs.map(r => api.policyResults(String(r.id)).catch(() => [] as PolicyResult[]))
        )
        
        const aggregated: Record<string, AggregatedRule> = {}
        
        const rank: Record<string, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 }
        
        allResults.flat().forEach((pr: PolicyResult) => {
          const sev = (pr.severity || 'INFO').toUpperCase()
          if (!aggregated[pr.rule_code]) {
            aggregated[pr.rule_code] = {
              rule_code: pr.rule_code,
              label: pr.rule_code.replaceAll('_', ' '),
              severity: sev,
              reason: pr.reason,
              evaluated: 0,
              pass: 0,
              fail: 0
            }
          }
          const agg = aggregated[pr.rule_code]
          agg.evaluated++
          if (pr.result === 'PASS') agg.pass++
          if (pr.result === 'FAIL') agg.fail++
          
          if ((rank[sev] || 0) > (rank[agg.severity] || 0)) {
            agg.severity = sev
            agg.reason = pr.reason
          }
        })
        
        setRules(aggregated)
      } catch {
        setError('Failed to load policy results')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) return <div className="page"><div className="empty-state">Loading policy evaluations�</div></div>
  if (error) return <div className="page"><div className="error-banner"><AlertCircle size={18}/>{error}</div></div>

  const ruleList = Object.values(rules)

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">Governance</span>
          <h1>Evidence Policies</h1>
          <p>Deterministic payment-entitlement rules evaluated by Xano.</p>
        </div>
      </div>
      
      <section className="panel compact-panel">
        {ruleList.length === 0 ? (
          <div className="empty-state">No evaluated policies yet.</div>
        ) : (
          <div className="request-table">
            <div className="table-head">
              <span>Rule</span>
              <span>Highest Observed Severity</span>
              <span>Representative Reason</span>
              <span>Evaluations</span>
            </div>
            {ruleList.map(rule => (
              <div className="table-row" key={rule.rule_code} style={{ alignItems: 'flex-start' }}>
                <span>
                  <strong>{rule.label}</strong>
                  <small className="code-font" style={{ marginTop: '0.25rem', display: 'block' }}>{rule.rule_code}</small>
                </span>
                <span>
                  <span className={`badge`} style={{
                    fontSize: '0.65rem',
                    backgroundColor: rule.severity === 'CRITICAL' ? '#fee2e2' : rule.severity === 'WARNING' ? '#fef9c3' : '#f3f4f6',
                    color: rule.severity === 'CRITICAL' ? '#991b1b' : rule.severity === 'WARNING' ? '#854d0e' : '#374151'
                  }}>{rule.severity}</span>
                </span>
                <span style={{ maxWidth: '300px' }}>
                  <small style={{ color: '#4b5563', whiteSpace: 'normal', lineHeight: '1.4', display: 'block' }}>{rule.reason}</small>
                </span>
                <span>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1rem' }}>{rule.evaluated}</strong>
                      <small style={{ fontSize: '0.65rem' }}>Total</small>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#10b981' }}>
                      <strong>{rule.pass}</strong>
                      <small style={{ fontSize: '0.65rem' }}>Pass</small>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#ef4444' }}>
                      <strong>{rule.fail}</strong>
                      <small style={{ fontSize: '0.65rem' }}>Fail</small>
                    </div>
                  </div>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
