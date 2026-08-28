from typing import Literal

from pydantic import BaseModel, Field

Decision = Literal["ALLOW", "REVIEW_REQUIRED", "BLOCK"]
CheckStatus = Literal["PASS", "FAIL", "REVIEW", "NOT_AVAILABLE"]


class VendorCreate(BaseModel):
    legal_name: str
    country: str = "US"
    registration_number: str | None = None
    website: str | None = None
    current_payee_name: str | None = None
    current_bank_account: str | None = None


class PaymentChangeCreate(BaseModel):
    vendor_id: str
    invoice_number: str
    contract_id: str | None = None
    amount: float = Field(gt=0)
    currency: str = "USD"
    requested_payee_name: str
    requested_bank_account: str | None = None
    request_domain: str | None = None
    change_reason: str | None = None


class EvidenceOut(BaseModel):
    id: str
    evidence_type: str
    source_type: str
    source_id: str | None = None
    subject: str | None = None
    predicate: str
    object_value: str | None = None
    confidence: float | None = None
    valid_from: str | None = None
    valid_to: str | None = None
    verification_status: str


class PolicyCheck(BaseModel):
    rule_code: str
    label: str
    status: CheckStatus
    severity: Literal["info", "warning", "critical"]
    reason: str


class EvaluationResponse(BaseModel):
    request_id: str
    decision: Decision
    checks: list[PolicyCheck]
    reason_codes: list[str]
    human_review_required: bool
    explanation: str


class ReviewCreate(BaseModel):
    reviewer_name: str
    action: Literal["APPROVE", "REJECT", "REQUEST_CLARIFICATION"]
    note: str | None = None
