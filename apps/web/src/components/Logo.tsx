import { ShieldCheck } from 'lucide-react'

export function Logo({compact = false}: {compact?: boolean}) {
  return (
    <div className="logo-wrap">
      <div className="logo-mark"><ShieldCheck size={20} strokeWidth={2.2} /></div>
      {!compact && <div><strong>TrustFlow</strong><span>Sentinel</span></div>}
    </div>
  )
}
