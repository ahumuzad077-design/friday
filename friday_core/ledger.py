"""SQLite ledger. Only VERIFIED revenue affects goal progress."""
import json
import sqlite3
from .models import RevenueEvent


class RevenueLedger:
    def __init__(self, path: str):
        self.path = path
        with sqlite3.connect(path) as db:
            db.execute("""CREATE TABLE IF NOT EXISTS revenue_events (
                event_id TEXT PRIMARY KEY,
                opportunity_id TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL,
                status TEXT NOT NULL,
                evidence TEXT NOT NULL,
                created_at TEXT NOT NULL
            )""")
            db.commit()

    def record(self, event: RevenueEvent) -> None:
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT OR IGNORE INTO revenue_events VALUES (?,?,?,?,?,?,?)", (
                event.event_id, event.opportunity_id, event.amount, event.currency,
                event.status, json.dumps(event.evidence), event.created_at))
            db.commit()

    def verified_total(self, currency: str = "USD") -> float:
        with sqlite3.connect(self.path) as db:
            row = db.execute("SELECT COALESCE(SUM(amount),0) FROM revenue_events WHERE status='VERIFIED' AND currency=?", (currency,)).fetchone()
            return float(row[0] or 0)

    def recent(self, limit: int = 50) -> list[dict]:
        with sqlite3.connect(self.path) as db:
            rows = db.execute("SELECT event_id,opportunity_id,amount,currency,status,evidence,created_at FROM revenue_events ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(zip(("event_id","opportunity_id","amount","currency","status","evidence","created_at"), r)) for r in rows]
