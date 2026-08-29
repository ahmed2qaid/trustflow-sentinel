import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, Check, CheckCircle2, CircleDashed, FileText, Globe2, Play, ShieldX } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api, type Evaluation, type PaymentRequest, type PolicyCheck } from '../lib/api'
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
  const decision = evaluation?.decision ?? request.final_decision
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

    <section className="workflow-bar">
      <WorkflowStep number="1" title="Extract documents" complete={evidence.length>0} busy={busy==='docs'} onClick={() => runStep('docs',()=>api.processDocuments(id))}/>
      <WorkflowStep number="2" title="Collect live signals" complete={signals.length>0} busy={busy==='web'} onClick={() => runStep('web',()=>api.enrich(id))}/>
      <WorkflowStep number="3" title="Evaluate policy" complete={Boolean(decision)} busy={busy==='eval'} onClick={() => runStep('eval',()=>api.evaluate(id))}/>
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
          <h3>{new Intl.NumberFormat('en-US',{style:'currency',currency:request.currency,maximumFractionDigits:0}).format(request.amount)}</h3>
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

function WorkflowStep({number,title,complete,busy,onClick}:{number:string;title:string;complete:boolean;busy:boolean;onClick:()=>void}) {
  return <button className={`workflow-step ${complete?'complete':''}`} onClick={onClick} disabled={busy}>
    <span className="workflow-icon">{busy?<CircleDashed className="spin" size={17}/>:complete?<Check size={17}/>:<Play size={15}/>}</span>
    <span><small>Step {number}</small><strong>{title}</strong></span>
  </button>
}
function CheckRow({check}:{check:PolicyCheck}) {
  const status = check.status ?? check.result ?? 'NOT_AVAILABLE'
  return <div className="check-row"><div className={`check-icon check-${status.toLowerCase()}`}>{status==='PASS'?<CheckCircle2 size={18}/>:status==='FAIL'?<ShieldX size={18}/>:<AlertCircle size={18}/>}</div><div><strong>{check.label ?? check.rule_code.replaceAll('_',' ')}</strong><p>{check.reason}</p></div><span className={`check-state state-${status.toLowerCase()}`}>{status.replaceAll('_',' ')}</span></div>
}
function Info({label,value,highlight=false}:{label:string;value:string;highlight?:boolean}) { return <div className="info-row"><span>{label}</span><strong className={highlight?'highlight-value':''}>{value}</strong></div> }
