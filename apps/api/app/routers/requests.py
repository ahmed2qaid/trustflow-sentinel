import json
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..adapters.llm import LLMAdapter
from ..adapters.nutrient import NutrientAdapter
from ..adapters.serpapi import SerpApiAdapter
from ..config import get_settings
from ..db import db, utc_now
from ..schemas import EvaluationResponse, PaymentChangeCreate, ReviewCreate
from ..services.audit import audit
from ..services.evidence import persist_extraction
from ..services.policy_engine import PolicyContext, evaluate_policies

router = APIRouter(prefix="/requests", tags=["payment-change-requests"])


def _get_request(request_id: str) -> dict:
    item = db.fetch_one("SELECT * FROM payment_change_requests WHERE id = ?", (request_id,))
    if not item:
        raise HTTPException(404, "Request not found")
    return item


@router.get("")
def list_requests():
    return db.fetch_all(
        """
        SELECT r.*, v.legal_name AS vendor_name
        FROM payment_change_requests r
        JOIN vendors v ON v.id = r.vendor_id
        ORDER BY r.created_at DESC
        """
    )


@router.post("", status_code=201)
def create_request(payload: PaymentChangeCreate):
    if not db.fetch_one("SELECT id FROM vendors WHERE id = ?", (payload.vendor_id,)):
        raise HTTPException(404, "Vendor not found")
    now = utc_now()
    request_id = str(uuid4())
    db.insert(
        "payment_change_requests",
        {
            "id": request_id,
            **payload.model_dump(),
            "status": "draft",
            "policy_decision": None,
            "final_decision": None,
            "created_at": now,
            "updated_at": now,
        },
    )
    audit("request.created", request_id=request_id, actor_type="user", details=payload.model_dump())
    return _get_request(request_id)


@router.get("/{request_id}")
def get_request(request_id: str):
    item = _get_request(request_id)
    vendor = db.fetch_one("SELECT * FROM vendors WHERE id = ?", (item["vendor_id"],))
    item["vendor"] = vendor
    return item


@router.post("/{request_id}/documents", status_code=201)
def upload_document(
    request_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
):
    _get_request(request_id)
    if document_type not in {"invoice", "assignment", "bank_letter"}:
        raise HTTPException(400, "Unsupported document_type")
    settings = get_settings()
    document_id = str(uuid4())
    suffix = Path(file.filename or "document.pdf").suffix or ".pdf"
    path = Path(settings.upload_dir) / f"{document_id}{suffix}"
    with path.open("wb") as output:
        shutil.copyfileobj(file.file, output)
    db.insert(
        "documents",
        {
            "id": document_id,
            "request_id": request_id,
            "document_type": document_type,
            "filename": file.filename or path.name,
            "file_path": str(path),
            "processing_status": "uploaded",
            "extraction_json": None,
            "created_at": utc_now(),
        },
    )
    audit("document.uploaded", request_id=request_id, actor_type="user", details={"document_id": document_id, "type": document_type})
    return db.fetch_one("SELECT * FROM documents WHERE id = ?", (document_id,))


@router.post("/{request_id}/process-documents")
async def process_documents(request_id: str):
    _get_request(request_id)
    documents = db.fetch_all("SELECT * FROM documents WHERE request_id = ?", (request_id,))
    adapter = NutrientAdapter()
    processed = []
    for document in documents:
        extraction = await adapter.extract(document["file_path"], document["document_type"])
        db.execute("DELETE FROM evidence WHERE source_id = ?", (document["id"],))
        db.update(
            "documents",
            document["id"],
            {"processing_status": "processed", "extraction_json": extraction},
        )
        evidence_ids = persist_extraction(
            request_id,
            document["id"],
            document["document_type"],
            extraction,
        )
        processed.append({"document_id": document["id"], "extraction": extraction, "evidence_ids": evidence_ids})
    db.update("payment_change_requests", request_id, {"status": "evidence_ready", "updated_at": utc_now()})
    audit("documents.processed", request_id=request_id, details={"count": len(processed)})
    return {"processed": processed}


@router.post("/{request_id}/web-enrichment")
async def web_enrichment(request_id: str):
    item = _get_request(request_id)
    vendor = db.fetch_one("SELECT * FROM vendors WHERE id = ?", (item["vendor_id"],))
    adapter = SerpApiAdapter()
    signal = await adapter.company_signal(item["requested_payee_name"], item.get("request_domain"))
    db.execute("DELETE FROM external_signals WHERE request_id = ? AND signal_type = ?", (request_id, "domain_consistency"))
    signal_id = str(uuid4())
    db.insert(
        "external_signals",
        {
            "id": signal_id,
            "request_id": request_id,
            "signal_type": "domain_consistency",
            "query": signal["query"],
            "status": signal["status"],
            "value": signal.get("value"),
            "source_url": signal.get("source_url"),
            "metadata_json": signal.get("metadata", {}),
            "created_at": utc_now(),
        },
    )
    audit("web.enriched", request_id=request_id, details={"signal_id": signal_id, "status": signal["status"], "vendor": vendor["legal_name"] if vendor else None})
    return db.fetch_one("SELECT * FROM external_signals WHERE id = ?", (signal_id,))


@router.get("/{request_id}/evidence")
def get_evidence(request_id: str):
    _get_request(request_id)
    return db.fetch_all("SELECT * FROM evidence WHERE request_id = ? ORDER BY created_at", (request_id,))


@router.get("/{request_id}/documents")
def get_documents(request_id: str):
    _get_request(request_id)
    return db.fetch_all("SELECT * FROM documents WHERE request_id = ? ORDER BY created_at", (request_id,))


@router.get("/{request_id}/signals")
def get_signals(request_id: str):
    _get_request(request_id)
    return db.fetch_all("SELECT * FROM external_signals WHERE request_id = ? ORDER BY created_at", (request_id,))


@router.post("/{request_id}/evaluate", response_model=EvaluationResponse)
async def evaluate(request_id: str):
    item = _get_request(request_id)
    vendor = db.fetch_one("SELECT * FROM vendors WHERE id = ?", (item["vendor_id"],))
    evidence = db.fetch_all("SELECT * FROM evidence WHERE request_id = ?", (request_id,))
    signals = db.fetch_all("SELECT * FROM external_signals WHERE request_id = ?", (request_id,))
    context = PolicyContext(
        current_payee=vendor.get("current_payee_name") if vendor else None,
        current_bank=vendor.get("current_bank_account") if vendor else None,
        requested_payee=item["requested_payee_name"],
        requested_bank=item.get("requested_bank_account"),
        invoice_number=item["invoice_number"],
        contract_id=item.get("contract_id"),
        request_domain=item.get("request_domain"),
        evidence=evidence,
        external_signals=signals,
    )
    decision, checks, reasons = evaluate_policies(context)

    db.execute("DELETE FROM policy_results WHERE request_id = ?", (request_id,))
    for check in checks:
        db.insert(
            "policy_results",
            {
                "id": str(uuid4()),
                "request_id": request_id,
                "rule_code": check.rule_code,
                "result": check.status,
                "severity": check.severity,
                "reason": check.reason,
                "evidence_ids_json": [],
                "created_at": utc_now(),
            },
        )
    llm = LLMAdapter()
    explanation = await llm.explain(decision, reasons, [c.model_dump() for c in checks])
    db.update(
        "payment_change_requests",
        request_id,
        {
            "status": "evaluated",
            "policy_decision": decision,
            "final_decision": decision if decision in {"ALLOW", "BLOCK"} else None,
            "updated_at": utc_now(),
        },
    )
    audit("request.evaluated", request_id=request_id, details={"decision": decision, "reason_codes": reasons})
    return EvaluationResponse(
        request_id=request_id,
        decision=decision,
        checks=checks,
        reason_codes=reasons,
        human_review_required=decision == "REVIEW_REQUIRED",
        explanation=explanation,
    )


@router.get("/{request_id}/evaluation")
def get_evaluation(request_id: str):
    item = _get_request(request_id)
    checks = db.fetch_all("SELECT * FROM policy_results WHERE request_id = ? ORDER BY created_at", (request_id,))
    return {
        "decision": item.get("final_decision") or item.get("policy_decision"),
        "policy_decision": item.get("policy_decision"),
        "final_decision": item.get("final_decision"),
        "checks": checks,
    }


@router.post("/{request_id}/review")
def review(request_id: str, payload: ReviewCreate):
    item = _get_request(request_id)
    if item.get("policy_decision") != "REVIEW_REQUIRED":
        raise HTTPException(409, "Only REVIEW_REQUIRED cases can be manually decided; BLOCK cannot be overridden")
    review_id = str(uuid4())
    db.insert(
        "reviews",
        {
            "id": review_id,
            "request_id": request_id,
            **payload.model_dump(),
            "created_at": utc_now(),
        },
    )
    status_map = {
        "APPROVE": "approved",
        "REJECT": "rejected",
        "REQUEST_CLARIFICATION": "clarification_requested",
    }
    final_map = {"APPROVE": "ALLOW", "REJECT": "BLOCK", "REQUEST_CLARIFICATION": None}
    db.update(
        "payment_change_requests",
        request_id,
        {"status": status_map[payload.action], "final_decision": final_map[payload.action], "updated_at": utc_now()},
    )
    audit("review.completed", request_id=request_id, actor_type="human", actor_id=payload.reviewer_name, details=payload.model_dump())
    return db.fetch_one("SELECT * FROM reviews WHERE id = ?", (review_id,))


@router.get("/{request_id}/audit")
def get_audit(request_id: str):
    _get_request(request_id)
    rows = db.fetch_all("SELECT * FROM audit_events WHERE request_id = ? ORDER BY created_at", (request_id,))
    for row in rows:
        try:
            row["details"] = json.loads(row.pop("details_json"))
        except (json.JSONDecodeError, TypeError):
            row["details"] = {}
    return rows
