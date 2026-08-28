from dataclasses import dataclass
from datetime import date
from typing import Iterable

from ..schemas import PolicyCheck


@dataclass(frozen=True)
class PolicyContext:
    current_payee: str | None
    current_bank: str | None
    requested_payee: str
    requested_bank: str | None
    invoice_number: str
    contract_id: str | None
    request_domain: str | None
    evidence: list[dict]
    external_signals: list[dict]


def _norm(value: str | None) -> str:
    return " ".join((value or "").lower().replace(".", " ").replace(",", " ").split())


def _find(evidence: Iterable[dict], predicate: str) -> list[dict]:
    return [item for item in evidence if item.get("predicate") == predicate]


def _any_match(items: Iterable[dict], value: str | None) -> bool:
    target = _norm(value)
    if not target:
        return False
    return any(_norm(item.get("object_value")) == target for item in items)


def evaluate_policies(ctx: PolicyContext) -> tuple[str, list[PolicyCheck], list[str]]:
    checks: list[PolicyCheck] = []
    reasons: list[str] = []

    payee_changed = _norm(ctx.current_payee) != _norm(ctx.requested_payee)
    bank_changed = bool(ctx.requested_bank) and _norm(ctx.current_bank) != _norm(ctx.requested_bank)

    checks.append(
        PolicyCheck(
            rule_code="PAYEE_CHANGE",
            label="Requested payee",
            status="REVIEW" if payee_changed else "PASS",
            severity="warning" if payee_changed else "info",
            reason="Requested payee differs from the vendor master record."
            if payee_changed
            else "Requested payee matches the vendor master record.",
        )
    )
    if payee_changed:
        reasons.append("PAYEE_CHANGED")

    checks.append(
        PolicyCheck(
            rule_code="BANK_CHANGE",
            label="Bank details",
            status="REVIEW" if bank_changed else "PASS",
            severity="warning" if bank_changed else "info",
            reason="Requested bank details are new for this vendor."
            if bank_changed
            else "No new bank destination detected.",
        )
    )
    if bank_changed:
        reasons.append("BANK_CHANGED")

    assignment_payees = _find(ctx.evidence, "assignment.assignee")
    assignment_present = _any_match(assignment_payees, ctx.requested_payee)
    assignment_needed = payee_changed

    if assignment_needed:
        checks.append(
            PolicyCheck(
                rule_code="ASSIGNMENT_EVIDENCE",
                label="Third-party entitlement evidence",
                status="PASS" if assignment_present else "FAIL",
                severity="critical" if not assignment_present else "info",
                reason="Assignment evidence names the requested payee."
                if assignment_present
                else "No assignment evidence authorizes the requested payee.",
            )
        )
        reasons.append("VALID_ASSIGNMENT_FOUND" if assignment_present else "ASSIGNMENT_MISSING")
    else:
        checks.append(
            PolicyCheck(
                rule_code="ASSIGNMENT_EVIDENCE",
                label="Third-party entitlement evidence",
                status="NOT_AVAILABLE",
                severity="info",
                reason="Not required because the payee did not change.",
            )
        )

    scope_items = _find(ctx.evidence, "assignment.scope.contract_id")
    scope_match = not assignment_needed or (ctx.contract_id and _any_match(scope_items, ctx.contract_id))
    if assignment_needed:
        checks.append(
            PolicyCheck(
                rule_code="ASSIGNMENT_SCOPE",
                label="Assignment scope",
                status="PASS" if scope_match else "FAIL",
                severity="critical" if not scope_match else "info",
                reason="Assignment scope covers the invoice contract."
                if scope_match
                else "Assignment scope does not cover the invoice contract.",
            )
        )
        reasons.append("INVOICE_SCOPE_MATCH" if scope_match else "ASSIGNMENT_SCOPE_MISMATCH")

    valid_to_items = _find(ctx.evidence, "assignment.valid_to")
    expired = False
    today = date.today()
    for item in valid_to_items:
        value = item.get("object_value")
        if value:
            try:
                expired = date.fromisoformat(value) < today
            except ValueError:
                expired = True
    if assignment_needed:
        checks.append(
            PolicyCheck(
                rule_code="ASSIGNMENT_VALIDITY",
                label="Assignment validity",
                status="FAIL" if expired else ("PASS" if assignment_present else "REVIEW"),
                severity="critical" if expired else "info",
                reason="Assignment has expired." if expired else "No expired assignment detected.",
            )
        )
        if expired:
            reasons.append("ASSIGNMENT_EXPIRED")

    bank_doc_items = _find(ctx.evidence, "bank.account")
    bank_doc_match = not ctx.requested_bank or _any_match(bank_doc_items, ctx.requested_bank)
    checks.append(
        PolicyCheck(
            rule_code="BANK_DOCUMENT_MATCH",
            label="Bank evidence",
            status="PASS" if bank_doc_match else "FAIL",
            severity="critical" if not bank_doc_match else "info",
            reason="Requested bank account matches document evidence."
            if bank_doc_match
            else "Requested bank account conflicts with uploaded document evidence.",
        )
    )
    if not bank_doc_match:
        reasons.append("BANK_DOCUMENT_MISMATCH")

    domain_signals = [s for s in ctx.external_signals if s.get("signal_type") == "domain_consistency"]
    external_fail = any(s.get("status") == "FAIL" for s in domain_signals)
    external_pass = any(s.get("status") == "PASS" for s in domain_signals)
    checks.append(
        PolicyCheck(
            rule_code="EXTERNAL_SIGNALS",
            label="Live external signals",
            status="FAIL" if external_fail else ("PASS" if external_pass else "NOT_AVAILABLE"),
            severity="warning" if external_fail else "info",
            reason="Live web evidence conflicts with submitted identity signals."
            if external_fail
            else "Live web evidence is consistent with submitted identity signals."
            if external_pass
            else "No live external signal has been collected yet.",
        )
    )
    if external_fail:
        reasons.append("EXTERNAL_SIGNAL_MISMATCH")
    elif external_pass:
        reasons.append("EXTERNAL_SIGNALS_CONSISTENT")

    low_confidence = any(
        item.get("confidence") is not None and float(item["confidence"]) < 0.75
        for item in ctx.evidence
    )
    checks.append(
        PolicyCheck(
            rule_code="EVIDENCE_CONFIDENCE",
            label="Evidence confidence",
            status="REVIEW" if low_confidence else "PASS",
            severity="warning" if low_confidence else "info",
            reason="At least one extracted evidence field has low confidence."
            if low_confidence
            else "No low-confidence evidence fields detected.",
        )
    )
    if low_confidence:
        reasons.append("LOW_EXTRACTION_CONFIDENCE")

    critical_fail = any(c.status == "FAIL" and c.severity == "critical" for c in checks)
    warning_fail = any(c.status == "FAIL" for c in checks)
    needs_review = payee_changed or bank_changed or low_confidence or warning_fail

    if critical_fail:
        decision = "BLOCK"
    elif needs_review:
        decision = "REVIEW_REQUIRED"
    else:
        decision = "ALLOW"

    return decision, checks, reasons
