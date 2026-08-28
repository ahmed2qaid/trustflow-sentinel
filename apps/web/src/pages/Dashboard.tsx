import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, CircleDollarSign, FileWarning, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, type PaymentRequest } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

export function Dashboard() {
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [integrations, setIntegrations] = useState<Record<string,string>>({})

  async function load() {
    setLoading(true)
    await api.seed().catch(() => null)
    const [items, health] = await Promise.all([api.requests(), api.health()])
    setRequests(items)
    setIntegrations(health.integrations)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const stats = useMemo(() => ({
    total: requests.length,
    allow: requests.filter(r => (r.final_decision ?? r.policy_decision) === 'ALLOW').length,
    review: requests.filter(r => !r.final_decision && r.policy_decision === 'REVIEW_REQUIRED').length,
    block: requests.filter(r => (r.final_decision ?? r.policy_decision) === 'BLOCK').length
  }), [requests])

  return (
    <div className="page">
      <section className="hero-grid">
        <div className="hero-copy">
          <span className="kicker"><Sparkles size={14}/> Evidence before action</span>
          <h1>Verify the payment change.<br/><em>Not just the vendor.</em></h1>
          <p>TrustFlow turns documents and live web signals into auditable evidence, then applies deterministic policy before a sensitive B2B payment change can be approved.</p>
          <div className="hero-actions">
            <Link className="primary-btn" to="/requests/case-2-legit-assignment">Run the hero case <ArrowRight size={16}/></Link>
            <button className="secondary-btn" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button>
          </div>
        </div>
        <div className="trust-card">
          <div className="trust-card-top"><span>Decision pipeline</span><span className="live-dot">LIVE READY</span></div>
          <div className="pipeline">
            {['Document evidence','Live web signals','AI-assisted analysis','Deterministic policy','Human review'].map((step, i) => (
              <div className="pipeline-row" key={step}>
                <span className="pipeline-index">0{i+1}</span><span>{step}</span><CheckCircle2 size={16}/>
              </div>
            ))}
          </div>
          <div className="integration-row">
            <span>Nutrient <b>{integrations.nutrient ?? '—'}</b></span>
            <span>SerpApi <b>{integrations.serpapi ?? '—'}</b></span>
            <span>LLM <b>{integrations.llm ?? '—'}</b></span>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <Stat icon={<CircleDollarSign/>} label="Demo cases" value={stats.total} note="Synthetic, audit-safe" />
        <Stat icon={<CheckCircle2/>} label="Allowed" value={stats.allow} note="No high-risk change" tone="good" />
        <Stat icon={<FileWarning/>} label="Needs review" value={stats.review} note="Human checkpoint" tone="warn" />
        <Stat icon={<ShieldAlert/>} label="Blocked" value={stats.block} note="Critical policy failure" tone="bad" />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">Verification queue</span><h2>Payment change requests</h2></div>
          <Link to="/requests" className="text-link">View all <ArrowRight size={15}/></Link>
        </div>
        {loading ? <div className="empty-state">Loading evidence cases…</div> : (
          <div className="request-table">
            <div className="table-head"><span>Vendor / invoice</span><span>Requested payee</span><span>Amount</span><span>Decision</span><span/></div>
            {requests.map(request => (
              <Link to={`/requests/${request.id}`} className="table-row" key={request.id}>
                <span><strong>{request.vendor_name}</strong><small>{request.invoice_number} · {request.contract_id}</small></span>
                <span><strong>{request.requested_payee_name}</strong><small>{request.request_domain}</small></span>
                <span><strong>{new Intl.NumberFormat('en-US',{style:'currency', currency: request.currency, maximumFractionDigits:0}).format(request.amount)}</strong></span>
                <span><StatusBadge decision={request.final_decision ?? request.policy_decision ?? null} status={request.status}/></span>
                <span className="row-arrow"><ArrowRight size={16}/></span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({icon,label,value,note,tone='neutral'}:{icon:ReactNode;label:string;value:number;note:string;tone?:string}) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>
}
