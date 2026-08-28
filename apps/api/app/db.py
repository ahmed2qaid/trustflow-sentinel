import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator

from .config import get_settings


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  country TEXT NOT NULL,
  registration_number TEXT,
  website TEXT,
  current_payee_name TEXT,
  current_bank_account TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_change_requests (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  contract_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  requested_payee_name TEXT NOT NULL,
  requested_bank_account TEXT,
  request_domain TEXT,
  change_reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  policy_decision TEXT,
  final_decision TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'uploaded',
  extraction_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(request_id) REFERENCES payment_change_requests(id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  subject TEXT,
  predicate TEXT NOT NULL,
  object_value TEXT,
  confidence REAL,
  valid_from TEXT,
  valid_to TEXT,
  verification_status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(request_id) REFERENCES payment_change_requests(id)
);

CREATE TABLE IF NOT EXISTS external_signals (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  query TEXT NOT NULL,
  status TEXT NOT NULL,
  value TEXT,
  source_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(request_id) REFERENCES payment_change_requests(id)
);

CREATE TABLE IF NOT EXISTS policy_results (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  result TEXT NOT NULL,
  severity TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY(request_id) REFERENCES payment_change_requests(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(request_id) REFERENCES payment_change_requests(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
"""


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class Database:
    def __init__(self, path: str | None = None):
        self.path = path or get_settings().database_path
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.init_schema()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init_schema(self) -> None:
        with self.connection() as conn:
            conn.executescript(SCHEMA)
            columns = {row[1] for row in conn.execute('PRAGMA table_info(payment_change_requests)').fetchall()}
            if 'policy_decision' not in columns:
                conn.execute('ALTER TABLE payment_change_requests ADD COLUMN policy_decision TEXT')

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        with self.connection() as conn:
            conn.execute(sql, params)

    def fetch_one(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        with self.connection() as conn:
            row = conn.execute(sql, params).fetchone()
            return dict(row) if row else None

    def fetch_all(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self.connection() as conn:
            return [dict(row) for row in conn.execute(sql, params).fetchall()]

    def insert(self, table: str, data: dict[str, Any]) -> None:
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        values = tuple(self._serialize(v) for v in data.values())
        self.execute(f"INSERT INTO {table} ({columns}) VALUES ({placeholders})", values)

    def update(self, table: str, entity_id: str, data: dict[str, Any]) -> None:
        setters = ", ".join(f"{key} = ?" for key in data)
        values = tuple(self._serialize(v) for v in data.values()) + (entity_id,)
        self.execute(f"UPDATE {table} SET {setters} WHERE id = ?", values)

    @staticmethod
    def _serialize(value: Any) -> Any:
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return value


db = Database()
