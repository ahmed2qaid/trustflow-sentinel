# Security and trust boundaries

- No real bank details are included in the repository.
- Demo data is synthetic and visibly labeled.
- API keys are environment variables and never committed.
- LLM output cannot directly produce an `ALLOW` result; deterministic policy does.
- SerpApi evidence is external context, not proof of legal registration.
- Uploaded bank letters are document evidence, not independent bank-account ownership verification.
- Human approval is required for the legitimate third-party-payee demo case.
- Audit events are append-oriented in the product workflow.

## Production roadmap controls

- OIDC/SSO + RBAC.
- Secret manager.
- Object-storage encryption and retention policy.
- Independent KYB/bank verification adapters.
- Signed webhook validation.
- Idempotency keys on state-changing APIs.
- Immutable audit storage / export.
- Rate limiting and abuse protection.
