from app.services.policy_engine import PolicyContext, evaluate_policies


def context(**overrides):
    base = dict(
        current_payee="ABC Manufacturing Inc.",
        current_bank="US-ABC-1008",
        requested_payee="ABC Manufacturing Inc.",
        requested_bank="US-ABC-1008",
        invoice_number="INV-1008",
        contract_id="CF-2026-01",
        request_domain="abcmfg.example",
        evidence=[
            {"predicate": "bank.account", "object_value": "US-ABC-1008", "confidence": 0.98},
        ],
        external_signals=[{"signal_type": "domain_consistency", "status": "PASS"}],
    )
    base.update(overrides)
    return PolicyContext(**base)


def test_safe_case_allows():
    decision, checks, reasons = evaluate_policies(context())
    assert decision == "ALLOW"
    assert not any(c.status == "FAIL" for c in checks)
    assert "EXTERNAL_SIGNALS_CONSISTENT" in reasons


def test_legitimate_assignment_requires_review():
    evidence = [
        {"predicate": "assignment.assignee", "object_value": "NorthStar Finance LLC", "confidence": 0.96},
        {"predicate": "assignment.scope.contract_id", "object_value": "CF-2026-04", "confidence": 0.96},
        {"predicate": "assignment.valid_to", "object_value": "2027-07-31", "confidence": 0.96},
        {"predicate": "bank.account", "object_value": "US-NSF-7821", "confidence": 0.95},
    ]
    decision, _, reasons = evaluate_policies(
        context(
            requested_payee="NorthStar Finance LLC",
            requested_bank="US-NSF-7821",
            contract_id="CF-2026-04",
            evidence=evidence,
        )
    )
    assert decision == "REVIEW_REQUIRED"
    assert "VALID_ASSIGNMENT_FOUND" in reasons
    assert "INVOICE_SCOPE_MATCH" in reasons


def test_missing_assignment_blocks():
    decision, checks, reasons = evaluate_policies(
        context(
            requested_payee="GlobalPay Holdings",
            requested_bank="US-GPH-9911",
            evidence=[{"predicate": "bank.account", "object_value": "US-DIF-1000", "confidence": 0.92}],
            external_signals=[{"signal_type": "domain_consistency", "status": "FAIL"}],
        )
    )
    assert decision == "BLOCK"
    assert "ASSIGNMENT_MISSING" in reasons
    assert any(c.rule_code == "BANK_DOCUMENT_MATCH" and c.status == "FAIL" for c in checks)


def test_expired_assignment_blocks():
    evidence = [
        {"predicate": "assignment.assignee", "object_value": "NorthStar Finance LLC", "confidence": 0.96},
        {"predicate": "assignment.scope.contract_id", "object_value": "CF-2026-04", "confidence": 0.96},
        {"predicate": "assignment.valid_to", "object_value": "2025-01-01", "confidence": 0.96},
        {"predicate": "bank.account", "object_value": "US-NSF-7821", "confidence": 0.95},
    ]
    decision, _, reasons = evaluate_policies(
        context(
            requested_payee="NorthStar Finance LLC",
            requested_bank="US-NSF-7821",
            contract_id="CF-2026-04",
            evidence=evidence,
        )
    )
    assert decision == "BLOCK"
    assert "ASSIGNMENT_EXPIRED" in reasons
