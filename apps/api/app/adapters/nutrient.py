import json
from pathlib import Path
from typing import Any

import httpx

from ..config import Settings, get_settings


EXTRACTION_SCHEMAS: dict[str, dict[str, Any]] = {
    "invoice": {
        "type": "object",
        "properties": {
            "supplier_name": {"type": "string"},
            "invoice_number": {"type": "string"},
            "contract_id": {"type": "string"},
            "amount": {"type": "number"},
            "currency": {"type": "string"},
            "payee_name": {"type": "string"},
            "bank_account": {"type": "string"},
        },
    },
    "assignment": {
        "type": "object",
        "properties": {
            "assignor": {"type": "string"},
            "assignee": {"type": "string"},
            "contract_id": {"type": "string"},
            "valid_from": {"type": "string"},
            "valid_to": {"type": "string"},
        },
    },
    "bank_letter": {
        "type": "object",
        "properties": {
            "account_holder": {"type": "string"},
            "bank_account": {"type": "string"},
            "bank_name": {"type": "string"},
        },
    },
}


class NutrientAdapter:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    async def extract(self, file_path: str, document_type: str) -> dict[str, Any]:
        if self.settings.use_mock_nutrient or not self.settings.nutrient_api_key:
            return self._mock_extract(Path(file_path), document_type)

        schema = EXTRACTION_SCHEMAS.get(document_type, {"type": "object", "properties": {}})
        headers = {"Authorization": f"Bearer {self.settings.nutrient_api_key}"}
        async with httpx.AsyncClient(timeout=90) as client:
            with open(file_path, "rb") as file_handle:
                response = await client.post(
                    self.settings.nutrient_api_url,
                    headers=headers,
                    files={"file": (Path(file_path).name, file_handle, "application/pdf")},
                    data={"schema": json.dumps(schema)},
                )
        response.raise_for_status()
        return response.json()

    def _mock_extract(self, file_path: Path, document_type: str) -> dict[str, Any]:
        name = file_path.name.lower()
        if "case2" in name:
            if document_type == "invoice":
                return {
                    "supplier_name": "ABC Manufacturing Inc.",
                    "invoice_number": "INV-7812",
                    "contract_id": "CF-2026-04",
                    "amount": 175000,
                    "currency": "USD",
                    "payee_name": "NorthStar Finance LLC",
                    "bank_account": "US-NSF-7821",
                    "_confidence": 0.97,
                }
            if document_type == "assignment":
                return {
                    "assignor": "ABC Manufacturing Inc.",
                    "assignee": "NorthStar Finance LLC",
                    "contract_id": "CF-2026-04",
                    "valid_from": "2026-08-01",
                    "valid_to": "2027-07-31",
                    "_confidence": 0.96,
                }
            if document_type == "bank_letter":
                return {
                    "account_holder": "NorthStar Finance LLC",
                    "bank_account": "US-NSF-7821",
                    "bank_name": "NorthStar Commercial Bank",
                    "_confidence": 0.95,
                }
        if "case3" in name:
            if document_type == "invoice":
                return {
                    "supplier_name": "ABC Manufacturing Inc.",
                    "invoice_number": "INV-9001",
                    "contract_id": "CF-2026-04",
                    "amount": 420000,
                    "currency": "USD",
                    "payee_name": "GlobalPay Holdings",
                    "bank_account": "US-GPH-9911",
                    "_confidence": 0.95,
                }
            if document_type == "bank_letter":
                return {
                    "account_holder": "Different Entity LLC",
                    "bank_account": "US-DIF-1000",
                    "bank_name": "Unknown Bank",
                    "_confidence": 0.92,
                }
        return {
            "supplier_name": "ABC Manufacturing Inc.",
            "invoice_number": "INV-1008",
            "contract_id": "CF-2026-01",
            "amount": 24500,
            "currency": "USD",
            "payee_name": "ABC Manufacturing Inc.",
            "bank_account": "US-ABC-1008",
            "_confidence": 0.98,
        }
