# Synthetic demo data

These documents are intentionally fictional and contain no real company, bank, or payment data.

- **Case 1 — Safe:** the vendor remains the payee and no destination change is requested.
- **Case 2 — Legitimate assignment:** the supplier assigns receivables for `CF-2026-04` to a factor. This should require human review, not be blindly blocked.
- **Case 3 — Suspicious change:** a new payee and bank account appear without valid assignment evidence and with conflicting web signals.

Run `python scripts/generate_demo_pdfs.py` to regenerate the PDFs.
