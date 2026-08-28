from uuid import uuid4

from fastapi import APIRouter, HTTPException

from ..db import db, utc_now
from ..schemas import VendorCreate
from ..services.audit import audit

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("")
def list_vendors():
    return db.fetch_all("SELECT * FROM vendors ORDER BY created_at DESC")


@router.post("", status_code=201)
def create_vendor(payload: VendorCreate):
    vendor_id = str(uuid4())
    row = {
        "id": vendor_id,
        **payload.model_dump(),
        "current_payee_name": payload.current_payee_name or payload.legal_name,
        "status": "active",
        "created_at": utc_now(),
    }
    db.insert("vendors", row)
    audit("vendor.created", actor_type="user", details={"vendor_id": vendor_id})
    return db.fetch_one("SELECT * FROM vendors WHERE id = ?", (vendor_id,))


@router.get("/{vendor_id}")
def get_vendor(vendor_id: str):
    vendor = db.fetch_one("SELECT * FROM vendors WHERE id = ?", (vendor_id,))
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    return vendor
