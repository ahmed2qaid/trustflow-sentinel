# 2–4 minute judge demo

## 0:00–0:25 — problem

“Supplier payment changes are legitimate sometimes — factoring is a real example — but the same workflow is exploited by impersonation and bank-change fraud. Existing tools verify pieces of the problem. TrustFlow gates the transaction-specific change using evidence.”

## 0:25–0:50 — architecture

Show the small pipeline: Nutrient -> evidence -> SerpApi -> policy -> human review -> audit.

## 0:50–1:15 — Case 1

Open Case 1, process/enrich/evaluate. Result: **ALLOW**. Point out that no new payee or bank was introduced.

## 1:15–2:10 — Hero Case 2

Open Case 2. Nutrient extracts the assignment, including assignee, contract scope and dates. SerpApi adds a current external consistency signal. Policy sees `Supplier != Payee` but does not label it fraud; instead it validates scope and requires **human review**. Approve it and show the audit event.

## 2:10–2:50 — Case 3

Open Case 3. New payee, new bank, no assignment, conflicting bank document and external domain signal. Policy returns **BLOCK** with concrete reason codes.

## 2:50–3:20 — why it matters

“AI explains and helps normalize evidence; it cannot override payment policy. TrustFlow can sit beside an ERP instead of replacing it. Today the demo uses sponsor/free APIs and synthetic data; production adapters can add KYB and independent bank ownership verification.”
