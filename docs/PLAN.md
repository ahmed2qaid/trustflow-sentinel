# Execution plan

## P0 — must work before submission

1. Repository + CI + environment templates.
2. Three synthetic demo cases.
3. Document upload and Nutrient DWS extraction.
4. Evidence normalization.
5. SerpApi live evidence.
6. Deterministic policy evaluation.
7. Human review action.
8. Audit trail.
9. Polished end-to-end UI.
10. Public setup instructions and a 2–4 minute demo video.

## P1 — winning quality

- Evidence source/provenance display.
- Low-confidence extraction checkpoint.
- Edge case: valid assignment that is expired or outside invoice scope.
- Xano live backend and static hosting.
- Test coverage + negative tests + API examples.
- Architecture diagram and clear build story.

## P2 — only after P0/P1

- Doctavian/Foxit document generation/signing.
- Real KYB provider adapter.
- Real bank-account ownership adapter.
- ERP connectors.
- Continuous monitoring and event-driven reverification.

## Definition of done

The project is done when a judge can run Case 1, 2 and 3 end-to-end and see exactly which evidence and rules caused the result, without a slide deck being necessary to understand the product.
