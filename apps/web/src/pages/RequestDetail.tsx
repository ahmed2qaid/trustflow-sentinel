import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type PaymentRequest, type Evaluation, type PolicyCheck, type TrustCheckResult } from '../lib/api'
import { AlertCircle, ArrowLeft, Check, CheckCircle2, CircleDashed, FileText, Globe2, Play, ShieldX } from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { DecisionIcon } from '../components/DecisionIcon'

export function RequestDetail() {
  const {id = ''} = useParams()
  const [request, setRequest] = useState<PaymentRequest|null>(null)
  const [evaluation, setEvaluation] = useState<Evaluation|null>(null)
  const [documents, setDocuments] = useState<Array<Record<string,unknown>>>([])
  const [evidence, setEvidence] = useState<Array<Record<string,unknown>>>([])
  const [signals, setSignals] = useState<Array<Record<string,unknown>>>([])
  const [audit, setAudit] = useState<Array<Record<string,unknown>>>([])
  const [trustCheck, setTrustCheck] = useState<TrustCheckResult|null>(null)
  const [busy, setBusy] = useState<string|null>(null)
  const [error, setError] = useState<string|null>(null)

  const refresh = async () => {
    try {
      const [req, docs, ev, sig, aud, evalData] = await Promise.all([
        api.request(id), api.documents(id), api.evidence(id), api.signals(id), api.audit(id), api.evaluation(id).catch(() => null)
      ])
      setRequest(req); setDocuments(docs); setEvidence(ev); setSignals(sig); setAudit(aud); setEvaluation(evalData)
    } catch (e) {
      console.error(e)
    }
  }
  useEffect(() => { void refresh() }, [id])

  async function runStep(label:string, action:()=>Promise<unknown>) {
    setBusy(label); setError(null)
    try { await action(); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed') }
    finally { setBusy(null) }
  }

  if (!request) return <div className="page"><div className="empty-state">Loading case…</div></div>
  const decision = request.final_decision ?? evaluation?.decision ?? request.policy_decision ?? null
  const checks = evaluation?.checks ?? []
  function safeFormatCurrency(amount: number, currency: string) {
    if (!currency) return String(amount)
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
    } catch {
      return String(amount)
    }
  }

  return <div className="page detail-page">
    <Link to="/requests" className="back-link"><ArrowLeft size={15}/> Payment changes</Link>
    <div className="detail-heading">
      <div><span className="eyebrow">{request.invoice_number} · {request.contract_id}</span><h1>{request.vendor?.legal_name}</h1><p>{request.change_reason}</p></div>
      <div className="detail-decision"><StatusBadge decision={decision} status={request.status}/></div>
    </div>

    {error && <div className="error-banner"><AlertCircle size={18}/>{error}</div>}

    <section className="workflow-bar" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <button
          className="btn-primary"
          style={{ padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '1rem', width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
          onClick={() => runStep('trust-check', async () => {
            const res = await api.runTrustCheck(id)
            setTrustCheck(res)
            if (res.orchestration === 'failed') {
              throw new Error(`Trust Check failed at stage: ${res.failed_stage || 'unknown'}`)
            }
          })}
          disabled={busy === 'trust-check'}
        >
          {busy === 'trust-check' ? <CircleDashed className="spin" size={17} style={{ marginRight: '0.5rem' }}/> : <Play size={15} style={{ marginRight: '0.5rem' }}/>}
          {busy === 'trust-check' ? 'Running Trust Check...' : 'Run Trust Check'}
        </button>

        <div className="workflow-stages" style={{ display: 'flex', gap: '0.5rem' }}>
          <WorkflowStep number="1" title="Document Evidence" complete={documents.length>0 && documents.some(d=>d.processing_status==='processed')} />
          <WorkflowStep number="2" title="Live Web Intelligence" complete={signals.length>0} />
          <WorkflowStep number="3" title="Policy Decision" complete={Boolean(request.policy_decision)} />
        </div>
      </div>

      {trustCheck && (
        <div className="trust-check-summary" style={{ flex: 1, backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', fontSize: '0.9rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Latest Trust Check Run</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', color: '#4b5563' }}>
            <span>Document Evidence</span>
            <strong style={{ color: '#10b981' }}>Success</strong>
            <span>Web Intelligence</span>
            <strong style={{ color: '#10b981' }}>Success</strong>
            <span>Policy Evaluation</span>
            <strong>{trustCheck.decision ? trustCheck.decision.replace('_', ' ') : (trustCheck.orchestration === 'failed' ? 'Failed' : 'Success')}</strong>
          </div>
        </div>
      )}
    </section>

    <div className="detail-grid">
      <div className="detail-main">
        <section className={`decision-panel decision-${(decision ?? 'pending').toLowerCase()}`}>
          <div className="decision-title">
            <div className="decision-symbol"><DecisionIcon decision={decision}/></div>
            <div><span className="eyebrow">Policy decision</span><h2>{decision ? decision.replaceAll('_',' ') : 'Not evaluated'}</h2></div>
          </div>
          <p>{evaluation?.explanation ?? 'Process document evidence, collect live signals, then evaluate the request against deterministic policy.'}</p>
          {decision === 'REVIEW_REQUIRED' && <div className="review-actions">
            <button className="btn-outline" onClick={() => runStep('review',()=>api.review(id, 'REQUEST_CLARIFICATION', 'Need more info'))}>Request Clarification</button>
            <button className="btn-outline" onClick={() => runStep('review',()=>api.review(id, 'REJECT', 'Rejected during manual review'))}>Reject</button>
            <button className="btn-primary" onClick={() => runStep('review',()=>api.review(id, 'APPROVE', 'Approved manually'))}>Approve</button>
          </div>}
        </section>

        <section className="detail-section">
          <h3>Payment Details</h3>
          <div className="data-grid">
            <div className="data-col">
              <h4>Amount</h4>
              <p className="data-amount">{safeFormatCurrency(request.amount, request.currency)}</p>
            </div>
            <div className="data-col">
              <h4>Requested Payee</h4>
              <p>{request.requested_payee_name}</p>
              <p className="data-sub">{request.requested_bank_account}</p>
            </div>
            <div className="data-col">
              <h4>Current Vendor Record</h4>
              <p>{request.vendor?.current_payee_name}</p>
              <p className="data-sub">{request.vendor?.current_bank_account}</p>
            </div>
          </div>
        </section>

        <section className="detail-section">
          <h3>Evidence</h3>
          {evidence.length === 0 ? <p className="empty-text">No evidence extracted yet.</p> :
            <table className="data-table">
              <thead><tr><th>Source</th><th>Predicate</th><th>Value</th></tr></thead>
              <tbody>
                {evidence.map((e, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-neutral">{e.source_type as string}</span></td>
                    <td className="code-font">{e.predicate as string}</td>
                    <td>{e.object_value as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Why this decision</span><h2>Policy checks</h2></div><span className="policy-count">{checks.length} checks</span></div>
          {checks.length ? <div className="checks-list">{checks.map((check,idx)=><CheckRow check={check} key={`${check.rule_code}-${idx}`}/>)}</div> : <div className="empty-state">Run policy evaluation to see explainable checks.</div>}
        </section>

        <section className="panel" id="evidence">
          <div className="panel-heading"><div><span className="eyebrow">Machine-readable evidence</span><h2>Evidence ledger</h2></div><span className="policy-count">{evidence.length} facts</span></div>
          {evidence.length ? <div className="evidence-grid">{evidence.map((item)=><div className="evidence-card" key={String(item.id)}>
            <div className="evidence-top"><span className="source-pill"><FileText size={13}/>{String(item.source_type)}</span><span className="confidence">{item.confidence ? `${Math.round(Number(item.confidence)*100)}%` : '—'}</span></div>
            <strong>{String(item.predicate)}</strong><p>{String(item.object_value ?? '—')}</p>
          </div>)}</div> : <div className="empty-state">No extracted evidence yet.</div>}
        </section>
      </div>

      <aside className="detail-side">
        <section className="side-card">
          <span className="eyebrow">Payment intent</span>
          <h3>{safeFormatCurrency(request.amount, request.currency)}</h3>
          <Info label="Current payee" value={request.vendor?.current_payee_name ?? '—'}/>
          <Info label="Requested payee" value={request.requested_payee_name} highlight={request.vendor?.current_payee_name !== request.requested_payee_name}/>
          <Info label="Current bank" value={request.vendor?.current_bank_account ?? '—'}/>
          <Info label="Requested bank" value={request.requested_bank_account ?? '—'} highlight={request.vendor?.current_bank_account !== request.requested_bank_account}/>
        </section>

        <section className="side-card">
          <span className="eyebrow">Documents</span><h3 className="small-heading">Evidence package</h3>
          <div className="doc-list">{documents.map(doc=><div className="doc-row" key={String(doc.id)}><FileText size={16}/><div><strong>{String(doc.document_type)}</strong><small>{String(doc.filename)}</small></div><span className={`tiny-status ${doc.processing_status==='processed'?'done':''}`}>{String(doc.processing_status)}</span></div>)}</div>
        </section>

        <section className="side-card">
          <span className="eyebrow">Live intelligence</span><h3 className="small-heading">External signals</h3>
          {signals.length ? signals.map(signal=><div className="signal-row" key={String(signal.id)}><Globe2 size={17}/><div><strong>{String(signal.signal_type)}</strong><small>{String(signal.value ?? signal.query)}</small></div><span className={`signal-${String(signal.status).toLowerCase()}`}>{String(signal.status)}</span></div>) : <div className="mini-empty">No external signal yet.</div>}
        </section>

        <section className="side-card" id="activity">
          <span className="eyebrow">Audit trail</span><h3 className="small-heading">Case timeline</h3>
          <div className="timeline">{audit.slice().reverse().slice(0,8).map((item,idx)=><div className="timeline-row" key={String(item.id)}><span className="timeline-dot"/><div><strong>{String(item.action)}</strong><small>{new Date(String(item.created_at)).toLocaleString()}</small></div>{idx===0 && <span className="latest">latest</span>}</div>)}</div>
        </section>
      </aside>
    </div>
  </div>
}

function WorkflowStep({number,title,complete}:{number:string;title:string;complete:boolean}) {
  return <div className={`workflow-step ${complete?'complete':''}`} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', flex: 1, backgroundColor: complete ? '#f0fdf4' : 'white', opacity: complete ? 1 : 0.6 }}>
    <span className="workflow-icon" style={{ marginRight: '0.5rem', color: complete ? '#10b981' : '#9ca3af' }}>{complete?<Check size={17}/>:<CircleDashed size={15}/>}</span>
    <span style={{ display: 'flex', flexDirection: 'column' }}><small style={{ fontSize: '0.7rem', color: '#6b7280' }}>Stage {number}</small><strong style={{ fontSize: '0.85rem' }}>{title}</strong></span>
  </div>
}
function CheckRow({check}:{check:PolicyCheck}) {
  const status = check.status ?? check.result ?? 'NOT_AVAILABLE'
  return <div className="check-row"><div className={`check-icon check-${status.toLowerCase()}`}>{status==='PASS'?<CheckCircle2 size={18}/>:status==='FAIL'?<ShieldX size={18}/>:<AlertCircle size={18}/>}</div><div><strong>{check.label ?? check.rule_code.replaceAll('_',' ')}</strong><p>{check.reason}</p></div><span className={`check-state state-${status.toLowerCase()}`}>{status.replaceAll('_',' ')}</span></div>
}
function Info({label,value,highlight=false}:{label:string;value:string;highlight?:boolean}) { return <div className="info-row"><span>{label}</span><strong className={highlight?'highlight-value':''}>{value}</strong></div> }
