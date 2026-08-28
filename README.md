# TrustFlow Sentinel

**Evidence-gated B2B payment change verification for the DevNetwork [API + Cloud + AI] Hackathon 2026.**

> TrustFlow verifies sensitive supplier payment changes by turning documents and live web signals into auditable evidence, then applying deterministic policies before a change is approved, reviewed, or blocked.

## Why this exists

Enterprise teams already have ERP, vendor onboarding, KYB, bank validation, and fraud tools. The dangerous gap is the **decision boundary**: when a supplier asks to change the payee or payment destination, does the evidence actually authorize *this specific change for this specific transaction, right now*?

TrustFlow focuses on that narrow, high-value workflow instead of trying to replace SAP, Oracle, Coupa, Trustpair, or a bank network.

## The decision pipeline

```text
Payment change request
        |
        v
Nutrient DWS -> structured document evidence
        |
SerpApi -> live external consistency signals
        |
AI-assisted explanation (Ollama, optional)
        |
Deterministic policy engine
        |
   ALLOW / REVIEW / BLOCK
        |
Human review when required
        |
Full audit trail
```

## Sponsor integrations

- **Nutrient DWS** — core document extraction. In live mode the backend sends invoices, assignment notices, and bank letters to the schema-based Data Extraction API. Extracted values become evidence facts used by policy.
- **SerpApi** — live web evidence. TrustFlow checks whether submitted identity/domain signals are consistent with current search results. SerpApi is supporting evidence, not a legal registry.
- **Xano** — target hackathon backend for data model, APIs, workflow, auth, integrations and audit. This repository contains a fully runnable FastAPI reference backend so development/testing never blocks on cloud access; the Xano migration map is in `docs/XANO_BACKEND.md`.
- **AI** — local Ollama by default so the stack can remain $0. AI explains and normalizes evidence; deterministic policy owns the decision boundary.

## Demo cases

1. **Safe / ALLOW** — supplier remains the payee and bank destination is unchanged.
2. **Legitimate third-party payee / REVIEW** — supplier assigned receivables to a factor; evidence covers the invoice contract and dates.
3. **Suspicious change / BLOCK** — new payee + new bank + no valid assignment + conflicting external signal.

## Monorepo

```text
apps/
  api/                 FastAPI reference backend + policy engine + adapters
  web/                 React + Vite frontend
demo-data/              Synthetic PDF cases
docs/                   architecture, roadmap, security, Xano migration, demo script
scripts/                demo PDF generator
.github/workflows/      CI
```

## Quick start — $0 local mode

Requirements: Python 3.11+, Node 20+.

```bash
# API
cd apps/api
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:5173`. The default `.env.example` uses deterministic mocks, so the complete demo runs without any API key or payment method.

## Turn on the real sponsor APIs

### Nutrient DWS

Create the event/free account and set:

```env
TRUSTFLOW_USE_MOCK_NUTRIENT=false
TRUSTFLOW_NUTRIENT_API_KEY=...
```

The adapter calls `POST https://api.nutrient.io/extraction/extract` with a JSON Schema chosen by document type.

### SerpApi

```env
TRUSTFLOW_USE_MOCK_SERPAPI=false
TRUSTFLOW_SERPAPI_API_KEY=...
```

The adapter calls Google Search through SerpApi and returns a normalized `PASS / FAIL / UNKNOWN` external signal.

### Ollama

```bash
ollama pull qwen3:4b
```

Then:

```env
TRUSTFLOW_USE_MOCK_LLM=false
TRUSTFLOW_OLLAMA_MODEL=qwen3:4b
```

The LLM never overrides deterministic policy.

## Tests

```bash
cd apps/api
pytest -q
ruff check .

cd ../web
npm run build
npm run lint
```

## Hackathon MVP rule

No new feature is P0 unless it makes one of the three demo cases stronger. No real money is moved; no synthetic demo result is presented as independent bank/KYB verification.

## Budget

**Maximum project spend: `$0.00`.** Free sponsor credits / free tiers only. No paid domain, hosted LLM, bank API, or KYB subscription is required for the hackathon MVP.

## Status

The repository is structured so the local reference implementation can be developed and tested immediately, while the final hackathon deployment can move the backend workflow to Xano without changing the product contract.
