import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, backendProvider, safeFormatCurrency, type PaymentRequest, type Evaluation, type PolicyCheck, type PolicyResult, type TrustCheckResult, type TrustCheckStage } from '../lib/api'
import { AlertCircle, ArrowLeft, Check, CheckCircle2, CircleDashed, ExternalLink, FileText, Globe2, Play, Scale, ShieldCheck, ShieldX } from 'lucide-react'
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
  const [policyResults, setPolicyResults] = useState<PolicyResult[]>([])
  const [trustCheck, setTrustCheck] = useState<TrustCheckResult|null>(null)
  const [busy, setBusy] = useState<string|null>(null)
  const [error, setError] = useState<string|null>(null)

  const refresh = useCallback(async () => {
    try {
      const [req, docs, ev, sig, aud, policyData] = await Promise.all([
        api.request(id),
        api.documents(id),
        api.evidence(id),
        api.signals(id),
        api.audit(id),
        api.policyResults(id).catch(() => [] as PolicyResult[])
      ])
      const evalData = backendProvider === 'xano'
        ? evaluationFromPolicyResults(id, req, policyData)
        : await api.evaluation(id).catch(() => null)
      setRequest(req)
      setDocuments(docs)
      setEvidence(ev)
      setSignals(sig)
      setAudit(aud)
      setEvaluation(evalData)
      setPolicyResults(policyData)
    } catch (e) {
      console.error(e)
    }
  }, [id])

  useEffect(() => { void refresh() }, [refresh])

  async function runStep(label:string, action:()=>Promise<unknown>) {
    setBusy(label); setError(null)
    try { await action(); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed') }
    finally { setBusy(null) }
  }

  if (!request) return <div className="page"><div className="empty-state">Loading case...</div></div>
  const decision = request.final_decision ?? trustCheck?.decision ?? evaluation?.decision ?? request.policy_decision ?? null
  const checks = evaluation?.checks ?? policyResults.map(toPolicyCheck)
  const runningTrustCheck = busy === 'trust-check'
  const execution = buildExecutionSummary({
    documents,
    evidence,
    signals,
    audit,
    checks,
    policyResults,
    trustCheck,
    decision,
    running: runningTrustCheck
  })

  return <div className="page detail-page">
    <Link to="/requests" className="back-link"><ArrowLeft size={15}/> Payment changes</Link>
    <div className="detail-heading">
      <div><span className="eyebrow">{request.invoice_number} - {request.contract_id}</span><h1>{request.vendor?.legal_name}</h1><p>{request.change_reason}</p></div>
      <div className="detail-decision"><StatusBadge decision={decision} status={request.status}/></div>
    </div>

    {error && <div className="error-banner"><AlertCircle size={18}/>{error}</div>}

    <section className="execution-panel">
      <div className="execution-top">
        <div>
          <span className="eyebrow">Observable backend workflow</span>
          <h2>Trust Check Execution</h2>
          {runningTrustCheck && <p><CircleDashed className="spin" size={14}/> Trust Check running...</p>}
        </div>
        <button
          className="btn-primary"
          onClick={() => runStep('trust-check', async () => {
            const res = await api.runTrustCheck(id)
            setTrustCheck(res)
            if (res.orchestration === 'failed') {
              throw new Error(`Trust Check failed at stage: ${res.failed_stage || 'unknown'}`)
            }
          })}
          disabled={runningTrustCheck}
        >
          {runningTrustCheck ? <CircleDashed className="spin" size={17}/> : <Play size={15}/>}
          {runningTrustCheck ? 'Running Trust Check...' : 'Run Trust Check'}
        </button>
      </div>

      <div className="execution-flow">
        <ExecutionStage stage={execution.documents} icon={<FileText size={18}/>} />
        <ExecutionStage stage={execution.nutrient} icon={<FileText size={18}/>} />
        <ExecutionStage stage={execution.serpApi} icon={<Globe2 size={18}/>} />
        <ExecutionStage stage={execution.xanoPolicy} icon={<Scale size={18}/>} />
        <ExecutionStage stage={execution.finalDecision} icon={<ShieldCheck size={18}/>} />
        <ExecutionStage stage={execution.humanReview} icon={<CheckCircle2 size={18}/>} />
      </div>

      <div className="execution-grid">
        <div className="execution-card">
          <div className="execution-card-heading"><span>Input Documents</span><strong>{documents.length}</strong></div>
          {documents.length ? <div className="execution-documents">{documents.map(doc => {
            const safeUrl = safeDocumentUrl(doc.file_url)
            return <div className="execution-document" key={String(doc.id ?? doc.filename)}>
              <div>
                <strong>{String(doc.filename ?? 'Untitled document')}</strong>
                <span>{formatLabel(doc.document_type)} - {documentStatus(doc)}</span>
              </div>
              {safeUrl && <a href={safeUrl} target="_blank" rel="noreferrer" className="icon-action" aria-label={`View source ${String(doc.filename ?? 'document')}`}><ExternalLink size={14}/></a>}
            </div>
          })}</div> : <div className="mini-empty">No source documents found.</div>}
        </div>

        <div className="execution-card">
          <div className="execution-card-heading"><span>Nutrient</span><strong>{execution.nutrient.status}</strong></div>
          <Metric label="Provider" value="Nutrient" />
          <Metric label="Documents processed" value={String(stageNumber(trustCheck?.stages?.document_processing, 'documents_processed') ?? (evidence.length ? documents.length : 0))} />
          <Metric label="Evidence extracted" value={String(stageNumber(trustCheck?.stages?.document_processing, 'evidence_created') ?? evidence.length)} />
          <Metric label="Evidence confidence" value={evidence.some(item => item.confidence !== undefined && item.confidence !== null) ? 'Available' : 'Not available'} />
          <Metric label="Provenance" value={evidence.some(hasProvenance) ? 'Available' : 'Not available'} />
          <Metric label="Pages" value={evidence.some(hasPage) ? 'Available' : 'Not available'} />
          <button className="inline-action" onClick={() => scrollToSection('evidence')}>View extracted evidence</button>
        </div>

        <div className="execution-card">
          <div className="execution-card-heading"><span>SerpApi</span><strong>{execution.serpApi.status}</strong></div>
          <Metric label="Provider" value="SerpApi" />
          <Metric label="Searches executed" value={String(stageNumber(trustCheck?.stages?.web_enrichment, 'searches_executed') ?? signals.length)} />
          <Metric label="Signals created" value={String(stageNumber(trustCheck?.stages?.web_enrichment, 'signals_created') ?? signals.length)} />
          <Metric label="Supplier" value={signalStatus(signals, 'supplier')} />
          <Metric label="Requested payee" value={signalStatus(signals, 'payee')} />
          <p className="execution-note">Supplemental intelligence only. Payment authorization remains policy-driven.</p>
          <button className="inline-action" onClick={() => scrollToSection('signals')}>View live intelligence</button>
        </div>

        <div className="execution-card">
          <div className="execution-card-heading"><span>Xano Policy</span><strong>{execution.xanoPolicy.status}</strong></div>
          <Metric label="Provider" value="Xano" />
          <Metric label="Role" value="Orchestration + Deterministic Policy" />
          <Metric label="Policy checks" value={String(policyResults.length || checks.length)} />
          {checks.slice(0, 2).map((check, idx) => <div className="policy-proof" key={`${check.rule_code}-${idx}`}>
            <strong>{check.rule_code}</strong>
            <span>{String(check.status ?? check.result ?? 'NOT_AVAILABLE')} / {(check.severity ?? 'info').toUpperCase()}</span>
            <p>{check.reason}</p>
          </div>)}
          <button className="inline-action" onClick={() => scrollToSection('policy-checks')}>View all policy checks</button>
        </div>
      </div>

      <div className="execution-footer">
        <details>
          <summary>Execution Details</summary>
          <div className="execution-details">
            <Metric label="Backend" value="Xano Live" />
            <Metric label="Orchestration" value={`POST /requests/${id}/run-trust-check`} />
            <Metric label="Document processing" value="Nutrient" />
            <Metric label="Live web intelligence" value="SerpApi" />
            <Metric label="Policy" value="Xano deterministic rules" />
            <Metric label="Audit" value={execution.auditRecorded ? 'Recorded' : 'Not recorded yet'} />
          </div>
        </details>
        {execution.auditRecorded && <button className="audit-proof" onClick={() => scrollToSection('activity')}>Audit recorded <Check size={13}/></button>}
      </div>
    </section>

    <section className="workflow-bar">
      <WorkflowStep number="1" title="Document Evidence" sponsor="Nutrient" complete={execution.nutrient.complete} />
      <WorkflowStep number="2" title="Live Web Intelligence" sponsor="SerpApi" complete={execution.serpApi.complete} />
      <WorkflowStep number="3" title="Policy Decision" sponsor="Xano" complete={execution.xanoPolicy.complete} />
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
              <thead><tr><th>Source</th><th>Field</th><th>Extracted Value</th></tr></thead>
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

        <section className="panel" id="policy-checks">
          <div className="panel-heading"><div><span className="eyebrow">Why this decision</span><h2>Policy checks</h2></div><span className="policy-count">{checks.length} checks</span></div>
          {checks.length ? <div className="checks-list">{checks.map((check,idx)=><CheckRow check={check} key={`${check.rule_code}-${idx}`}/>)}</div> : <div className="empty-state">Run policy evaluation to see explainable checks.</div>}
        </section>

        <section className="panel" id="evidence">
          <div className="panel-heading"><div><span className="eyebrow">Machine-readable evidence</span><h2>Evidence ledger</h2></div><span className="policy-count">{evidence.length} facts</span></div>
          {evidence.length ? <div className="evidence-grid">{evidence.map((item)=>{
            const prov = item.provenance_json as Record<string,unknown> | undefined
            const pageStr = prov?.pageIndex !== undefined ? ` - Page ${Number(prov.pageIndex) + 1}` : ''
            return <div className="evidence-card" key={String(item.id)}>
            <div className="evidence-top">
              <span className="source-pill"><FileText size={13}/>{String(item.source_type)}{pageStr}</span>
              <span className="confidence">{item.confidence ? `${Math.round(Number(item.confidence)*100)}%` : '-'}</span>
            </div>
            <strong>{String(item.predicate)}</strong><p>{String(item.object_value ?? '-')}</p>
          </div>
          })}</div> : <div className="empty-state">No extracted evidence yet.</div>}
        </section>
      </div>

      <aside className="detail-side">
        <section className="side-card">
          <span className="eyebrow">Payment intent</span>
          <h3>{safeFormatCurrency(request.amount, request.currency)}</h3>
          <Info label="Current payee" value={request.vendor?.current_payee_name ?? '-'}/>
          <Info label="Requested payee" value={request.requested_payee_name} highlight={request.vendor?.current_payee_name !== request.requested_payee_name}/>
          <Info label="Current bank" value={request.vendor?.current_bank_account ?? '-'}/>
          <Info label="Requested bank" value={request.requested_bank_account ?? '-'} highlight={request.vendor?.current_bank_account !== request.requested_bank_account}/>
        </section>

        <section className="side-card">
          <span className="eyebrow">Documents</span><h3 className="small-heading">Evidence package</h3>
          <div className="doc-list">{documents.map(doc=><div className="doc-row" key={String(doc.id)}><FileText size={16}/><div><strong>{String(doc.document_type)}</strong><small>{String(doc.filename)}</small></div><span className={`tiny-status ${documentStatus(doc)==='READY'?'done':''}`}>{documentStatus(doc)}</span></div>)}</div>
        </section>

        <section className="side-card" id="signals">
          <span className="eyebrow">Live intelligence</span><h3 className="small-heading">External signals</h3>
          {signals.length ? signals.map(signal=><div className="signal-row" key={String(signal.id)}><Globe2 size={17}/><div><strong>{String(signal.signal_type)}</strong><small>{String(signal.value ?? signal.query)}</small></div><span className={`signal-${String(signal.status).toLowerCase()}`}>{String(signal.status)}</span></div>) : <div className="mini-empty">No external signal yet.</div>}
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'right' }}>Powered by SerpApi</div>
        </section>

        <section className="side-card" id="activity">
          <span className="eyebrow">Audit trail</span><h3 className="small-heading">Case timeline</h3>
          <div className="timeline">{audit.slice().reverse().slice(0,8).map((item,idx)=><div className="timeline-row" key={String(item.id)}><span className="timeline-dot"/><div><strong>{String(item.action)}</strong><small>{new Date(String(item.created_at)).toLocaleString()}</small></div>{idx===0 && <span className="latest">latest</span>}</div>)}</div>
        </section>
      </aside>
    </div>
  </div>
}

function WorkflowStep({number,title,sponsor,complete}:{number:string;title:string;sponsor?:string;complete:boolean}) {
  return <div className={`workflow-step ${complete?'complete':''}`}>
    <span className="workflow-icon">{complete?<Check size={17}/>:<CircleDashed size={15}/>}</span>
    <span>
      <small>Stage {number}</small>
      <strong>{title}</strong>
      {sponsor && <small>Powered by {sponsor}</small>}
    </span>
  </div>
}

function CheckRow({check}:{check:PolicyCheck}) {
  const status = check.status ?? check.result ?? 'NOT_AVAILABLE'
  const evIds = check._evidence_ids && check._evidence_ids.length > 0 ? check._evidence_ids : null
  return <div className="check-row">
    <div className={`check-icon check-${status.toLowerCase()}`}>{status==='PASS'?<CheckCircle2 size={18}/>:status==='FAIL'?<ShieldX size={18}/>:<AlertCircle size={18}/>}</div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <strong>{check.label ?? check.rule_code.replaceAll('_',' ')}</strong>
        <span className="badge" style={{
          fontSize: '0.65rem',
          backgroundColor: check.severity === 'critical' ? '#fee2e2' : check.severity === 'warning' ? '#fef9c3' : '#f3f4f6',
          color: check.severity === 'critical' ? '#991b1b' : check.severity === 'warning' ? '#854d0e' : '#374151'
        }}>{(check.severity ?? 'INFO').toUpperCase()}</span>
      </div>
      <p style={{ margin: 0 }}>{check.reason}</p>
      {evIds && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Supporting evidence: #{evIds.join(', #')}</div>}
    </div>
    <span className={`check-state state-${status.toLowerCase()}`}>{status.replaceAll('_',' ')}</span>
  </div>
}

function Info({label,value,highlight=false}:{label:string;value:string;highlight?:boolean}) { return <div className="info-row"><span>{label}</span><strong className={highlight?'highlight-value':''}>{value}</strong></div> }

type ExecutionStageView = {
  title: string
  provider?: string
  status: string
  detail: string
  complete: boolean
  tone?: 'ready' | 'running' | 'waiting' | 'failed' | 'decision'
}

function ExecutionStage({stage, icon}:{stage:ExecutionStageView; icon:ReactNode}) {
  return <div className={`execution-stage stage-${stage.tone ?? 'waiting'} ${stage.complete ? 'complete' : ''}`}>
    <span className="execution-stage-icon">{icon}</span>
    <span>
      <small>{stage.provider ?? 'Stage'}</small>
      <strong>{stage.title}</strong>
      <em>{stage.detail}</em>
    </span>
    <b>{stage.status}</b>
  </div>
}

function Metric({label, value}:{label:string; value:string}) {
  return <div className="execution-metric"><span>{label}</span><strong>{value}</strong></div>
}

function buildExecutionSummary({
  documents,
  evidence,
  signals,
  audit,
  checks,
  policyResults,
  trustCheck,
  decision,
  running
}: {
  documents: Array<Record<string, unknown>>
  evidence: Array<Record<string, unknown>>
  signals: Array<Record<string, unknown>>
  audit: Array<Record<string, unknown>>
  checks: PolicyCheck[]
  policyResults: PolicyResult[]
  trustCheck: TrustCheckResult | null
  decision: string | null
  running: boolean
}) {
  const docStage = trustCheck?.stages?.document_processing
  const webStage = trustCheck?.stages?.web_enrichment
  const policyStage = trustCheck?.stages?.policy_evaluation
  const hasPolicy = policyResults.length > 0 || checks.length > 0 || Boolean(decision)
  const auditRecorded = audit.some(item => {
    const action = String(item.action ?? '').toLowerCase()
    return ['trust', 'policy', 'evaluation', 'evidence', 'signal', 'document', 'orchestration', 'allow', 'block', 'review'].some(token => action.includes(token))
  })

  const nutrientComplete = isStageSuccess(docStage) || (!trustCheck && evidence.length > 0)
  const serpApiComplete = isStageSuccess(webStage) || (!trustCheck && signals.length > 0)
  const policyComplete = isStageSuccess(policyStage) || (!trustCheck && hasPolicy)

  return {
    documents: {
      title: 'Input Documents',
      provider: 'Documents',
      status: documents.length ? 'READY' : 'MISSING',
      detail: `${documents.length} source document${documents.length === 1 ? '' : 's'}`,
      complete: documents.length > 0,
      tone: documents.length ? 'ready' : 'waiting'
    } as ExecutionStageView,
    nutrient: stageView('Nutrient - Document Extraction', 'Nutrient', docStage, nutrientComplete, running ? 'RUNNING' : 'WAITING', `${evidence.length} evidence facts`),
    serpApi: stageView('SerpApi - Live Web Intelligence', 'SerpApi', webStage, serpApiComplete, running ? 'QUEUED' : 'WAITING', `${signals.length} live signals`),
    xanoPolicy: stageView('Xano - Deterministic Policy', 'Xano', policyStage, policyComplete, running ? 'QUEUED' : 'WAITING', `${policyResults.length || checks.length} policy checks`),
    finalDecision: {
      title: 'Final Decision',
      provider: 'Decision',
      status: decision ? decision.replaceAll('_', ' ') : running ? 'WAITING' : 'NOT EVALUATED',
      detail: decision ? 'Effective decision' : 'No policy result yet',
      complete: Boolean(decision),
      tone: decision ? 'decision' : 'waiting'
    } as ExecutionStageView,
    humanReview: {
      title: 'Human Review',
      provider: 'Review',
      status: humanReviewStatus(decision),
      detail: humanReviewDetail(decision),
      complete: decision === 'ALLOW' || decision === 'BLOCK',
      tone: decision === 'REVIEW_REQUIRED' ? 'running' : decision ? 'ready' : 'waiting'
    } as ExecutionStageView,
    auditRecorded
  }
}

function stageView(title: string, provider: string, stage: TrustCheckStage | undefined, persistedComplete: boolean, waitingStatus: string, detail: string): ExecutionStageView {
  if (stage?.status === 'failed') {
    return {title, provider, status: 'FAILED', detail: String(stage.error ?? 'Stage failed'), complete: false, tone: 'failed'}
  }
  if (stage?.status === 'success' || persistedComplete) {
    return {title, provider, status: 'COMPLETED', detail, complete: true, tone: 'ready'}
  }
  return {title, provider, status: waitingStatus, detail, complete: false, tone: waitingStatus === 'RUNNING' ? 'running' : 'waiting'}
}

function isStageSuccess(stage: TrustCheckStage | undefined) {
  return stage?.status === 'success'
}

function stageNumber(stage: TrustCheckStage | undefined, key: keyof TrustCheckStage) {
  const value = stage?.[key]
  return typeof value === 'number' ? value : null
}

function safeDocumentUrl(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const trimmed = value.trim()
  if (trimmed.startsWith('/')) return trimmed
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function documentStatus(doc: Record<string, unknown>) {
  const raw = String(doc.processing_status ?? doc.status ?? 'UNKNOWN')
  if (['processed', 'ready', 'success', 'completed'].includes(raw.toLowerCase())) return 'READY'
  return raw.replaceAll('_', ' ').toUpperCase()
}

function formatLabel(value: unknown) {
  if (value === undefined || value === null || value === '') return 'Unknown'
  return String(value).replaceAll('_', ' ')
}

function hasProvenance(item: Record<string, unknown>) {
  return Boolean(item.provenance_json || item.provenance || item.document_id || item.source_document_id)
}

function hasPage(item: Record<string, unknown>) {
  const provenance = item.provenance_json as Record<string, unknown> | undefined
  return item.page !== undefined || item.page_number !== undefined || provenance?.pageIndex !== undefined || provenance?.page !== undefined
}

function signalStatus(signals: Array<Record<string, unknown>>, token: string) {
  const found = signals.find(signal => `${String(signal.signal_type ?? '')} ${String(signal.query ?? '')}`.toLowerCase().includes(token))
  return found ? String(found.status ?? found.value ?? 'AVAILABLE').toUpperCase() : 'UNKNOWN'
}

function humanReviewStatus(decision: string | null) {
  if (decision === 'ALLOW') return 'NOT REQUIRED'
  if (decision === 'BLOCK') return 'AUTO BLOCKED'
  if (decision === 'REVIEW_REQUIRED') return 'AWAITING'
  return 'WAITING'
}

function humanReviewDetail(decision: string | null) {
  if (decision === 'ALLOW') return 'Human review not required'
  if (decision === 'BLOCK') return 'Automatically blocked by deterministic policy'
  if (decision === 'REVIEW_REQUIRED') return 'Awaiting human review'
  return 'No review state yet'
}

function toPolicyCheck(pr: PolicyResult): PolicyCheck {
  return {
    rule_code: pr.rule_code,
    result: pr.result,
    severity: (pr.severity ?? 'info').toLowerCase() as 'info' | 'warning' | 'critical',
    reason: pr.reason,
    _evidence_ids: Array.isArray(pr.evidence_ids_json) ? pr.evidence_ids_json : undefined
  }
}

function evaluationFromPolicyResults(id: string, request: PaymentRequest, policyResults: PolicyResult[]): Evaluation {
  return {
    request_id: String(id),
    decision: request.policy_decision ?? null,
    checks: policyResults.map(toPolicyCheck)
  }
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'})
}
