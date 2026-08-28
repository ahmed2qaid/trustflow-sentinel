export type Decision = 'ALLOW' | 'REVIEW_REQUIRED' | 'BLOCK' | null

export interface Vendor {
  id: string
  legal_name: string
  country: string
  registration_number?: string
  website?: string
  current_payee_name?: string
  current_bank_account?: string
}

export interface PaymentRequest {
  id: string
  vendor_id: string
  vendor_name?: string
  invoice_number: string
  contract_id?: string
  amount: number
  currency: string
  requested_payee_name: string
  requested_bank_account?: string
  request_domain?: string
  change_reason?: string
  status: string
  policy_decision?: Decision
  final_decision: Decision
  created_at: string
  vendor?: Vendor
}

export interface PolicyCheck {
  rule_code: string
  label?: string
  result?: string
  status?: string
  severity: 'info' | 'warning' | 'critical'
  reason: string
}

export interface Evaluation {
  request_id?: string
  decision: Decision
  checks: PolicyCheck[]
  reason_codes?: string[]
  human_review_required?: boolean
  explanation?: string
}

const base = import.meta.env.VITE_API_BASE_URL ?? ''

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => call<{status: string; integrations: Record<string, string>}>('/health'),
  requests: () => call<PaymentRequest[]>('/api/requests'),
  request: (id: string) => call<PaymentRequest>(`/api/requests/${id}`),
  documents: (id: string) => call<Array<Record<string, unknown>>>(`/api/requests/${id}/documents`),
  evidence: (id: string) => call<Array<Record<string, unknown>>>(`/api/requests/${id}/evidence`),
  signals: (id: string) => call<Array<Record<string, unknown>>>(`/api/requests/${id}/signals`),
  audit: (id: string) => call<Array<Record<string, unknown>>>(`/api/requests/${id}/audit`),
  evaluation: (id: string) => call<Evaluation>(`/api/requests/${id}/evaluation`),
  seed: () => call<{status: string}>('/api/demo/seed', {method: 'POST'}),
  reset: () => call<{status: string}>('/api/demo/reset', {method: 'POST'}),
  processDocuments: (id: string) => call(`/api/requests/${id}/process-documents`, {method: 'POST'}),
  enrich: (id: string) => call(`/api/requests/${id}/web-enrichment`, {method: 'POST'}),
  evaluate: (id: string) => call<Evaluation>(`/api/requests/${id}/evaluate`, {method: 'POST'}),
  review: (id: string, action: 'APPROVE'|'REJECT'|'REQUEST_CLARIFICATION', note: string) =>
    call(`/api/requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({reviewer_name: 'Hackathon Reviewer', action, note})
    })
}
