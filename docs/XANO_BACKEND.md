# Xano backend migration map

The local FastAPI backend is a reference implementation of the exact workflow that should be reproduced in the hackathon Xano instance. This avoids blocking development before Xano authentication is available.

## Xano tables

Create the following tables with UUID/string IDs and timestamps:

- `vendors`
- `payment_change_requests`
- `documents`
- `evidence`
- `external_signals`
- `policy_results`
- `reviews`
- `audit_events`

Field definitions mirror `apps/api/app/db.py`.

## Xano API groups

### Vendors
- `GET /vendors`
- `POST /vendors`
- `GET /vendors/{id}`

### Payment change verification
- `GET /requests`
- `POST /requests`
- `GET /requests/{id}`
- `POST /requests/{id}/documents`
- `POST /requests/{id}/process-documents`
- `POST /requests/{id}/web-enrichment`
- `POST /requests/{id}/evaluate`
- `POST /requests/{id}/review`
- `GET /requests/{id}/evidence`
- `GET /requests/{id}/audit`

## Business logic to implement in Xano

1. Persist request.
2. Store uploaded document reference.
3. External API request -> Nutrient extraction.
4. Normalize output into `evidence` rows.
5. External API request -> SerpApi.
6. Apply policy rules as Functions/Function Stack steps.
7. Persist each rule result.
8. Return `ALLOW | REVIEW_REQUIRED | BLOCK`.
9. Write audit event after every state transition.

## Why Xano is meaningful here

Xano is not a passive database. It becomes the runtime for the product's API, workflow, integrations, policy execution, state transitions and audit data. The frontend should only talk to the TrustFlow/Xano API surface.
