# Architecture

## Design principles

1. **Evidence before action.** Every high-impact policy check should point back to a source.
2. **AI assists; policy gates.** LLM output is never the sole authority for a financial control.
3. **Provider-neutral adapters.** Document, web, KYB and bank-verification providers sit behind narrow interfaces.
4. **Auditable by default.** Upload, extraction, enrichment, evaluation and human review create audit events.
5. **Hackathon-realistic.** The MVP does not claim legal identity or bank ownership unless an independent provider is actually connected.

## Components

```text
React/Vite UI
    |
    v
TrustFlow API contract
    |
    +-- Request workflow
    +-- Evidence service
    +-- Policy engine
    +-- Human review
    +-- Audit service
    |
    +-- NutrientAdapter --> Nutrient DWS Data Extraction
    +-- SerpApiAdapter  --> SerpApi Google Search API
    +-- LLMAdapter      --> Ollama (local)
```

## Core entities

- Vendor
- PaymentChangeRequest
- Document
- Evidence
- ExternalSignal
- PolicyResult
- Review
- AuditEvent

A graph database is intentionally unnecessary for the MVP. Relationship semantics are represented as normalized evidence predicates such as `assignment.assignee` and `assignment.scope.contract_id`.

## Decision semantics

- **ALLOW** — no high-risk change and no critical rule failure.
- **REVIEW_REQUIRED** — a sensitive change is present but evidence may support it; a human checkpoint is required.
- **BLOCK** — a critical deterministic rule failed (for example, a changed payee with no valid assignment or a bank-document mismatch).
