import { Database, FileText, Globe2, ShieldCheck, Lock } from 'lucide-react'

export function Settings() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'Local / relative'
  const mode = import.meta.env.VITE_BACKEND_PROVIDER === 'xano' ? 'Live Xano API' : 'Local FastAPI'

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">Configuration overview</span>
          <h1>System Settings</h1>
          <p>TrustFlow Sentinel architecture and provider configuration.</p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          
          <section className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">System</span><h2>Backend Provider</h2></div>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Database size={24} style={{ color: '#6366f1' }}/>
              <div>
                <strong>{mode}</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563', fontSize: '0.9rem' }}>{baseUrl}</p>
              </div>
            </div>
          </section>
          
          <section className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">Document Evidence</span><h2>Nutrient</h2></div>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <FileText size={24} style={{ color: '#10b981' }}/>
              <div>
                <strong>Document extraction, confidence and provenance</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563', fontSize: '0.9rem' }}>Analyzes invoices and contracts to extract machine-readable facts and assignment details.</p>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">Live Web Intelligence</span><h2>SerpApi</h2></div>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Globe2 size={24} style={{ color: '#3b82f6' }}/>
              <div>
                <strong>External web consistency signals</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563', fontSize: '0.9rem' }}>Performs live intelligence gathering to detect discrepancies or confirm known entities.</p>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">Policy & Audit</span><h2>Xano</h2></div>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <ShieldCheck size={24} style={{ color: '#8b5cf6' }}/>
              <div>
                <strong>Orchestration, deterministic policy, human review and audit</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563', fontSize: '0.9rem' }}>Evaluates gathered evidence against strict business rules. Handles approval workflows and maintains the global audit ledger.</p>
              </div>
            </div>
          </section>

        </div>

        <aside className="detail-side">
          <section className="side-card">
            <span className="eyebrow">Demo Safety</span>
            <h3 className="small-heading">Read-only Configuration</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Lock size={16} style={{ color: '#10b981', flexShrink: 0 }}/>
                <small style={{ color: '#374151', lineHeight: '1.4' }}>Secrets stored server-side</small>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Lock size={16} style={{ color: '#10b981', flexShrink: 0 }}/>
                <small style={{ color: '#374151', lineHeight: '1.4' }}>Browser does not receive provider API keys</small>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Lock size={16} style={{ color: '#10b981', flexShrink: 0 }}/>
                <small style={{ color: '#374151', lineHeight: '1.4' }}>Deterministic policy is separate from web intelligence</small>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
