import { useEffect, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, safeFormatCurrency, type PaymentRequest } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

export function RequestsPage() {
  const [items, setItems] = useState<PaymentRequest[]>([])
  const [query, setQuery] = useState('')
  useEffect(() => { api.requests().then(setItems) }, [])
  const filtered = items.filter(i => `${i.vendor_name} ${i.invoice_number} ${i.requested_payee_name}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page">
    <div className="page-title"><div><span className="eyebrow">Operations</span><h1>Payment change requests</h1><p>Every sensitive change is evidence-backed, policy-evaluated and auditable.</p></div></div>
    <div className="toolbar"><label className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search vendor, invoice or payee"/></label></div>
    <section className="panel compact-panel">
      <div className="request-table">
        <div className="table-head"><span>Vendor / invoice</span><span>Requested payee</span><span>Amount</span><span>Decision</span><span/></div>
        {filtered.map(item => <Link to={`/requests/${item.id}`} className="table-row" key={item.id}>
          <span><strong>{item.vendor_name}</strong><small>{item.invoice_number} · {item.contract_id}</small></span>
          <span><strong>{item.requested_payee_name}</strong><small>{item.requested_bank_account}</small></span>
          <span><strong>{safeFormatCurrency(item.amount, item.currency)}</strong></span>
          <span><StatusBadge decision={item.final_decision ?? item.policy_decision ?? null} status={item.status}/></span>
          <span className="row-arrow"><ArrowRight size={16}/></span>
        </Link>)}
      </div>
    </section>
  </div>
}
