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
  request_key?: string
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
  _evidence_ids?: number[]
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
const provider = import.meta.env.VITE_BACKEND_PROVIDER ?? 'fastapi'

export const backendProvider = provider

function apiPath(path: string) {
  if (provider === 'xano') {
    return path
  }
  return `/api${path}`
}

async function call<T>(path: string, init?: RequestInit, retries = 2): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  })

  if (response.status === 429 && retries > 0) {
    const retryAfter = response.headers.get('Retry-After')
    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000
    await new Promise(r => setTimeout(r, waitTime))
    return call<T>(path, init, retries - 1)
  }

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  const data = await response.json()
  return normalize(data) as T
}

function normalize(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(normalize)
  }
  if (data !== null && typeof data === 'object') {
    const normalized: Record<string, unknown> = {}
    for (const key in data) {
      const value = (data as Record<string, unknown>)[key]

      // ID normalization
      if ((key === 'id' || key.endsWith('_id')) && typeof value === 'number') {
        normalized[key] = String(value)
      }
      // Decision normalization
      else if ((key === 'final_decision' || key === 'policy_decision') && value === '') {
        normalized[key] = null
      }
      // Timestamp normalization
      else if ((key === 'created_at' || key === 'updated_at') && typeof value === 'number') {
        // Xano uses ms, but let's be safe. If > 1000000000000 it's ms, else seconds
        const ms = value > 1000000000000 ? value : value * 1000
        normalized[key] = new Date(ms).toISOString()
      }
      // Evidence mapping
      else if (key === 'evidence_type') {
        normalized['source_type'] = value
        normalized[key] = value
      } else if (key === 'field_name') {
        normalized['predicate'] = value
        normalized[key] = value
      } else if (key === 'value' && (data as Record<string, unknown>).evidence_type) {
        normalized['object_value'] = value
        normalized[key] = value
      }
      // Audit mapping
      else if (key === 'event_type') {
        normalized['action'] = value
        normalized[key] = value
      }
      else {
        normalized[key] = normalize(value)
      }
    }
    return normalized
  }
  return data
}

function ensureFeature(name: string): Promise<never> {
  return Promise.reject(new Error(`Feature '${name}' is not available until live integration is enabled in Xano.`))
}

export interface TrustCheckStage {
  status: 'success' | 'failed' | 'pending'
  documents_processed?: number
  evidence_created?: number
  searches_executed?: number
  signals_created?: number
  decision?: Decision
  error?: unknown
}

export interface TrustCheckResult {
  request_id: string
  orchestration: 'completed' | 'failed'
  failed_stage?: string
  stages?: {
    document_processing?: TrustCheckStage
    web_enrichment?: TrustCheckStage
    policy_evaluation?: TrustCheckStage
  }
  decision?: Decision
  requires_human_review?: boolean
}

export interface PolicyResult {
  id: string
  request_id: string
  rule_code: string
  result: string
  severity: string
  reason: string
  evidence_ids_json?: number[] | Record<string, unknown> | null
  created_at: string
}

export function safeFormatCurrency(amount: number, currency: string) {
  if (!currency) return String(amount)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return String(amount)
  }
}

export const api = {
  health: () => {
    if (provider === 'xano') return Promise.resolve({status: 'ok', integrations: {}})
    return call<{status: string; integrations: Record<string, string>}>('/health')
  },
  requests: () => call<PaymentRequest[]>(apiPath('/requests')),
  request: async (id: string) => {
    const req = await call<PaymentRequest>(apiPath(`/requests/${id}`))
    if (provider === 'xano' && req.vendor_id) {
      try {
        const vendor = await call<Vendor>(apiPath(`/vendors/${req.vendor_id}`))
        req.vendor = vendor
      } catch (e) {
        console.warn('Failed to hydrate vendor', e)
      }
    }
    return req
  },
  documents: (id: string) => call<Array<Record<string, unknown>>>(apiPath(`/requests/${id}/documents`)),
  evidence: (id: string) => call<Array<Record<string, unknown>>>(apiPath(`/requests/${id}/evidence`)),
  signals: (id: string) => call<Array<Record<string, unknown>>>(apiPath(`/requests/${id}/signals`)),
  audit: (id: string) => call<Array<Record<string, unknown>>>(apiPath(`/requests/${id}/audit`)),
  policyResults: (id: string) => call<PolicyResult[]>(apiPath(`/requests/${id}/policy-results`)),
  evaluation: async (id: string) => {
    if (provider === 'xano') {
      const [req, policyResults] = await Promise.all([
        api.request(id),
        api.policyResults(id).catch(() => [] as PolicyResult[])
      ])
      return {
        request_id: String(id),
        decision: req.policy_decision ?? null,
        checks: policyResults.map(pr => ({
          rule_code: pr.rule_code,
          result: pr.result,
          severity: (pr.severity ?? 'info').toLowerCase() as 'info' | 'warning' | 'critical',
          reason: pr.reason,
          _evidence_ids: Array.isArray(pr.evidence_ids_json) ? pr.evidence_ids_json : undefined
        }))
      } as Evaluation
    }
    return call<Evaluation>(apiPath(`/requests/${id}/evaluation`))
  },
  seed: () => call<{status: string}>(apiPath('/demo/seed'), {method: 'POST'}),
  reset: () => {
    if (provider === 'xano') return ensureFeature('Demo Reset')
    return call<{status: string}>(apiPath('/demo/reset'), {method: 'POST'})
  },
  processDocuments: (id: string) => call(apiPath(`/requests/${id}/process-documents`), {method: 'POST'}),
  enrich: (id: string) => call(apiPath(`/requests/${id}/web-enrichment`), {method: 'POST'}),
  evaluate: async (id: string) => {
    const res = await call<Record<string, unknown>>(apiPath(`/requests/${id}/evaluate`), {method: 'POST'})
    if (provider === 'xano') {
      return {
        request_id: String(id),
        decision: res.policy_decision ?? null,
        checks: []
      } as Evaluation
    }
    return res as unknown as Evaluation
  },
  review: (id: string, action: 'APPROVE'|'REJECT'|'REQUEST_CLARIFICATION', note: string) => {
    const body = provider === 'xano'
      ? JSON.stringify({reviewer_name: 'Hackathon Reviewer', action, notes: note})
      : JSON.stringify({reviewer_name: 'Hackathon Reviewer', action, note})

    return call(apiPath(`/requests/${id}/review`), {
      method: 'POST',
      body
    })
  },
  runTrustCheck: (id: string) => call<TrustCheckResult>(apiPath(`/requests/${id}/run-trust-check`), { method: 'POST' })
}
