# Build story

## What software are we rebuilding?

The most painful part of a traditional procurement/AP workflow: approving sensitive supplier payment changes when evidence is scattered across PDFs, web signals, vendor records, and human inboxes.

## Why this workflow?

A different payee can be legitimate (for example, a receivables assignment) or dangerous (impersonation, compromised vendor communication, or unsupported bank changes). A binary “payee mismatch = fraud” rule is too crude, while a generic AI risk score is too hard to audit.

## What TrustFlow changes

TrustFlow compiles documents and external signals into evidence facts, evaluates deterministic policies, and brings a human in only when evidence supports a legitimate exception but an approval checkpoint is still required.

## AI use

AI helps with extraction-adjacent normalization, entity matching and concise explanations. It does **not** have unilateral authority to approve a high-risk payment change.

## What would have taken longer without AI + API-first tooling?

- Normalizing unstructured assignment/bank/invoice documents.
- Summarizing evidence for a reviewer.
- Matching entities across differently formatted data.
- Producing concise, human-readable reason explanations.
- Connecting a live external-data signal into the workflow.

The deterministic policy layer remains ordinary code so it is testable and auditable.
