"""Invoice records for F.R.I.D.A.Y. business operations."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone


class InvoiceStore:
    def __init__(self, path: str):
        self.path = path
        with sqlite3.connect(path) as db:
            db.execute("""CREATE TABLE IF NOT EXISTS invoices (
                invoice_id TEXT PRIMARY KEY,
                opportunity_id TEXT NOT NULL,
                customer_ref TEXT,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL,
                provider TEXT NOT NULL,
                provider_id TEXT,
                status TEXT NOT NULL,
                metadata TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )""")
            db.commit()

    def create(self, opportunity_id: str, description: str, amount: float, currency: str,
               provider: str, customer_ref: str = "", metadata=None) -> dict:
        if amount <= 0:
            raise ValueError("invoice amount must be positive")
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "invoice_id": f"FRI-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:8].upper()}",
            "opportunity_id": opportunity_id,
            "customer_ref": customer_ref,
            "description": description,
            "amount": float(amount),
            "currency": currency.upper(),
            "provider": provider,
            "provider_id": "",
            "status": "DRAFT",
            "metadata": metadata or {},
            "created_at": now,
            "updated_at": now,
        }
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT INTO invoices VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (
                record["invoice_id"], record["opportunity_id"], record["customer_ref"],
                record["description"], record["amount"], record["currency"], record["provider"],
                record["provider_id"], record["status"], json.dumps(record["metadata"]),
                record["created_at"], record["updated_at"]))
            db.commit()
        return record

    def update_provider(self, invoice_id: str, provider_id: str, status: str):
        with sqlite3.connect(self.path) as db:
            db.execute("UPDATE invoices SET provider_id=?,status=?,updated_at=? WHERE invoice_id=?",
                       (provider_id, status, datetime.now(timezone.utc).isoformat(), invoice_id))
            db.commit()
