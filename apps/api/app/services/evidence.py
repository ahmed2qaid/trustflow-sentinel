from uuid import uuid4

from ..db import Database, db, utc_now


FIELD_MAP = {
    "assignor": ("assignment", "assignment.assignor"),
    "assignee": ("assignment", "assignment.assignee"),
    "contract_id": ("document_field", "assignment.scope.contract_id"),
    "valid_from": ("assignment", "assignment.valid_from"),
    "valid_to": ("assignment", "assignment.valid_to"),
    "account_holder": ("bank", "bank.account_holder"),
    "bank_account": ("bank", "bank.account"),
    "supplier_name": ("invoice", "invoice.supplier_name"),
    "invoice_number": ("invoice", "invoice.number"),
    "payee_name": ("invoice", "invoice.payee_name"),
    "amount": ("invoice", "invoice.amount"),
    "currency": ("invoice", "invoice.currency"),
}


def persist_extraction(
    request_id: str,
    document_id: str,
    document_type: str,
    extraction: dict,
    *,
    database: Database = db,
) -> list[str]:
    ids: list[str] = []
    default_confidence = extraction.get("_confidence")
    for field, value in extraction.items():
        if field.startswith("_") or value in (None, ""):
            continue
        evidence_type, predicate = FIELD_MAP.get(field, (document_type, f"{document_type}.{field}"))
        if field == "contract_id" and document_type != "assignment":
            predicate = f"{document_type}.contract_id"
        evidence_id = str(uuid4())
        database.insert(
            "evidence",
            {
                "id": evidence_id,
                "request_id": request_id,
                "evidence_type": evidence_type,
                "source_type": "document",
                "source_id": document_id,
                "subject": document_type,
                "predicate": predicate,
                "object_value": str(value),
                "confidence": default_confidence,
                "valid_from": None,
                "valid_to": None,
                "verification_status": "extracted",
                "metadata_json": {"field": field},
                "created_at": utc_now(),
            },
        )
        ids.append(evidence_id)
    return ids
