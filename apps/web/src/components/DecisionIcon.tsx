import { AlertTriangle, CheckCircle2, ShieldX } from 'lucide-react'
import type { Decision } from '../lib/api'

export function DecisionIcon({decision, size = 22}: {decision: Decision; size?: number}) {
  if (decision === 'ALLOW') return <CheckCircle2 size={size}/>
  if (decision === 'BLOCK') return <ShieldX size={size}/>
  return <AlertTriangle size={size}/>
}
