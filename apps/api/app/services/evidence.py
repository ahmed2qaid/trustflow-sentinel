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
    """Persist extraction results as individual evidence facts.

    ``extraction`` may be a *structured* adapter response::

        {"data": {...}, "metadata": {...}, "provider": "nutrient", "mode": "..."}

    or a legacy *flat* dict (backward-compatible).  Per-field confidence
    and provenance (bounding box, page, grounding score) are taken from
    ``metadata`` when available — no values are invented.
    """
    ids: list[str] = []

    # Structured format — {"data": ..., "metadata": ...}
    if "data" in extraction and isinstance(extraction.get("data"), dict):
        data = extraction["data"]
        metadata = extraction.get("metadata", {})
    else:
        # Legacy flat format
        data = extraction
        metadata = {}

    for field, value in data.items():
        if field.startswith("_") or value in (None, ""):
            continue
        evidence_type, predicate = FIELD_MAP.get(field, (document_type, f"{document_type}.{field}"))
        if field == "contract_id" and document_type != "assignment":
            predicate = f"{document_type}.contract_id"

        # Per-field provenance from Nutrient metadata
        field_meta = metadata.get(field) if isinstance(metadata, dict) else None
        confidence = (
            field_meta.get("confidence")
            if isinstance(field_meta, dict)
            else None
        )
        provenance_info: dict = {"field": field}
        if isinstance(field_meta, dict) and field_meta:
            provenance_info["provenance"] = field_meta

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
                "confidence": confidence,
                "valid_from": None,
                "valid_to": None,
                "verification_status": "extracted",
                "metadata_json": provenance_info,
                "created_at": utc_now(),
            },
        )
        ids.append(evidence_id)
    return ids
