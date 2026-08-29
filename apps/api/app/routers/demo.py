import shutil
from uuid import uuid4

from fastapi import APIRouter

from ..config import get_settings, PROJECT_ROOT
from ..db import db, utc_now
from ..services.audit import audit

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/reset")
def reset_demo():
    for table in [
        "audit_events",
        "reviews",
        "policy_results",
        "external_signals",
        "evidence",
        "documents",
        "payment_change_requests",
        "vendors",
    ]:
        db.execute(f"DELETE FROM {table}")
    return seed_demo()


@router.post("/seed")
def seed_demo():
    existing = db.fetch_one("SELECT id FROM vendors LIMIT 1")
    if existing:
        return {"status": "already_seeded", "requests": db.fetch_all("SELECT id FROM payment_change_requests")}

    vendor_id = "vendor-abc"
    db.insert(
        "vendors",
        {
            "id": vendor_id,
            "legal_name": "ABC Manufacturing Inc.",
            "country": "US",
            "registration_number": "US-NY-ABC-204",
            "website": "https://abcmfg.example",
            "current_payee_name": "ABC Manufacturing Inc.",
            "current_bank_account": "US-ABC-1008",
            "status": "active",
            "created_at": utc_now(),
        },
    )

    settings = get_settings()
    upload_dir = settings.resolve_upload_dir()
    demo_data_dir = PROJECT_ROOT / "demo-data" / "generated"

    cases = [
        {
            "id": "case-1-safe",
            "invoice": "INV-1008",
            "contract": "CF-2026-01",
            "amount": 24500,
            "payee": "ABC Manufacturing Inc.",
            "bank": "US-ABC-1008",
            "domain": "abcmfg.example",
            "reason": "Routine invoice; no payment destination change.",
            "docs": [("invoice", "case1_invoice.pdf")],
        },
        {
            "id": "case-2-legit-assignment",
            "invoice": "INV-7812",
            "contract": "CF-2026-04",
            "amount": 175000,
            "payee": "NorthStar Finance LLC",
            "bank": "US-NSF-7821",
            "domain": "northstarfinance.com",
            "reason": "Supplier assigned receivables to a factoring company.",
            "docs": [
                ("invoice", "case2_invoice.pdf"),
                ("assignment", "case2_assignment.pdf"),
                ("bank_letter", "case2_bank_letter.pdf"),
            ],
        },
        {
            "id": "case-3-suspicious",
            "invoice": "INV-9001",
            "contract": "CF-2026-04",
            "amount": 420000,
            "payee": "GlobalPay Holdings",
            "bank": "US-GPH-9911",
            "domain": "globalpay-payments.co",
            "reason": "Urgent email requested a new payee and new bank account.",
            "docs": [
                ("invoice", "case3_invoice.pdf"),
                ("bank_letter", "case3_bank_letter.pdf"),
            ],
        },
    ]

    for case in cases:
        now = utc_now()
        db.insert(
            "payment_change_requests",
            {
                "id": case["id"],
                "vendor_id": vendor_id,
                "invoice_number": case["invoice"],
                "contract_id": case["contract"],
                "amount": case["amount"],
                "currency": "USD",
                "requested_payee_name": case["payee"],
                "requested_bank_account": case["bank"],
                "request_domain": case["domain"],
                "change_reason": case["reason"],
                "status": "draft",
                "policy_decision": None,
                "final_decision": None,
                "created_at": now,
                "updated_at": now,
            },
        )
        for doc_type, filename in case["docs"]:
            source = demo_data_dir / filename
            destination = upload_dir / filename

            if not source.exists():
                raise ValueError(f"Missing demo PDF file: {source}")
            
            with open(source, "rb") as f:
                if not f.read(5).startswith(b"%PDF-"):
                    raise ValueError(f"Demo file is not a valid PDF: {source}")

            shutil.copy2(source, destination)

            db.insert(
                "documents",
                {
                    "id": str(uuid4()),
                    "request_id": case["id"],
                    "document_type": doc_type,
                    "filename": filename,
                    "file_path": str(destination),
                    "processing_status": "uploaded",
                    "extraction_json": None,
                    "created_at": now,
                },
            )
        audit("demo.case_seeded", request_id=case["id"], details={"label": case["reason"]})
    return {"status": "seeded", "requests": [case["id"] for case in cases]}
