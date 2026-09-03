# TrustFlow Sentinel

TrustFlow Sentinel verifies sensitive supplier payment changes by turning documents and live web signals into auditable evidence.

## Problem
Supplier identity alone does not prove who is entitled to receive payment.

## Core Concept
TrustFlow verifies supplier-to-payee entitlement and preserves evidence explaining the decision.

## Architecture

Upstream Procurement System
→ TrustFlow Sentinel
→ Nutrient DWS
→ SerpApi
→ Xano deterministic policy
→ ALLOW / REVIEW_REQUIRED / BLOCK
→ Human Review
→ Audit Trail

## Technologies

- **React**
- **TypeScript**
- **Vite**
- **Xano**: backend, orchestration, persistence, policy, review, audit
- **Nutrient DWS**: document extraction + confidence + provenance
- **SerpApi**: live external web intelligence

## Explanations

- **Nutrient**: Extracts structured document evidence with confidence scores and provenance.
- **SerpApi**: Provides live external web intelligence to check whether submitted identity/domain signals are consistent with current search results.
- **Xano**: Acts as the backend for data modeling, orchestration, persistence, deterministic policy execution, human review workflow, and audit trails.

**Note**: Supplier != Payee does NOT automatically mean fraud. A legitimate assignment/factoring relationship can require human review.

## Demo Data

The `demo-data/` directory contains synthetic PDFs representing:
1. **Standard payment**: Supplier remains the payee and bank destination is unchanged.
2. **Legitimate factoring**: Supplier assigned receivables to a factor.
3. **Unauthorized destination change**: New payee + new bank + no valid assignment.

These PDFs are used to demonstrate the system's ability to extract and verify documents.

## Setup Instructions

### Prerequisites
- Node.js (v20+)
- npm
- (Optional) Python 3.11+ if running the local FastAPI reference backend

### Frontend Setup

1. Navigate to the web application directory:
   ```bash
   cd apps/web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Environment Configuration:
   Create `.env.local` based on `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
   (Ensure `VITE_BACKEND_PROVIDER=xano` is set if using the Xano backend)

4. Development:
   ```bash
   npm run dev
   ```

5. Production Build:
   ```bash
   npm run build
   ```

## Companion Demo Application

A separate Acme Procurement Demo simulates an upstream enterprise procurement system submitting requests into TrustFlow.
See [Acme Procurement Demo](https://github.com/ahmed2qaid/trustflow-procurement-demo) (Link will be updated).
