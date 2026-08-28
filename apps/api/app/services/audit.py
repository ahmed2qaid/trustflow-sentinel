from uuid import uuid4

from ..db import Database, db, utc_now


def audit(
    action: str,
    *,
    request_id: str | None = None,
    actor_type: str = "system",
    actor_id: str | None = None,
    details: dict | None = None,
    database: Database = db,
) -> None:
    database.insert(
        "audit_events",
        {
            "id": str(uuid4()),
            "request_id": request_id,
            "actor_type": actor_type,
            "actor_id": actor_id,
            "action": action,
            "details_json": details or {},
            "created_at": utc_now(),
        },
    )
