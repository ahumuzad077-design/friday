"""Cloud-aware revenue ledger. Only VERIFIED revenue affects goal progress.

Local SQLite remains a fast cache, while Supabase can be used as the durable
source of verified revenue so progress survives Railway container restarts.
"""
from __future__ import annotations

import json
import os
import sqlite3
import urllib.error
import urllib.request
from .models import RevenueEvent


class RevenueLedger:
    def __init__(self, path: str):
        self.path = path
        self.cloud_enabled = bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SECRET_KEY"))
        self.supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.supabase_key = os.getenv("SUPABASE_SECRET_KEY", "")
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

    def _cloud_request(self, method: str, query: str = "", payload=None):
        if not self.cloud_enabled:
            return None
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.supabase_url}/rest/v1/revenue_events" + (f"?{query}" if query else ""),
            data=body,
            headers={
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Prefer": "resolution=merge-duplicates,return=representation",
            },
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except (urllib.error.HTTPError, urllib.error.URLError):
            return None

    @staticmethod
    def _cloud_row(event: RevenueEvent) -> dict:
        evidence = dict(event.evidence or {})
        provider = str(evidence.get("provider") or "friday")
        transaction_id = str(evidence.get("transaction_id") or event.event_id)
        return {
            "provider": provider,
            "transaction_id": transaction_id,
            "amount": float(event.amount),
            "currency": event.currency.upper(),
            "verified": event.status.upper() == "VERIFIED",
            "metadata": {
                "event_id": event.event_id,
                "opportunity_id": event.opportunity_id,
                "status": event.status,
                "evidence": evidence,
            },
            "created_at": event.created_at,
        }

    def record(self, event: RevenueEvent) -> None:
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT OR IGNORE INTO revenue_events VALUES (?,?,?,?,?,?,?)", (
                event.event_id, event.opportunity_id, event.amount, event.currency,
                event.status, json.dumps(event.evidence), event.created_at))
            db.commit()

        if self.cloud_enabled:
            self._cloud_request(
                "POST",
                "on_conflict=provider,transaction_id",
                [self._cloud_row(event)],
            )

    def verified_total(self, currency: str = "USD") -> float:
        if self.cloud_enabled:
            rows = self._cloud_request(
                "GET",
                f"select=amount,currency,verified&currency=eq.{currency.upper()}&verified=eq.true",
            )
            if isinstance(rows, list):
                return float(sum(float(row.get("amount", 0) or 0) for row in rows))

        with sqlite3.connect(self.path) as db:
            row = db.execute(
                "SELECT COALESCE(SUM(amount),0) FROM revenue_events "
                "WHERE status='VERIFIED' AND currency=?",
                (currency,),
            ).fetchone()
            return float(row[0] or 0)

    def recent(self, limit: int = 50) -> list[dict]:
        if self.cloud_enabled:
            rows = self._cloud_request(
                "GET",
                f"select=provider,transaction_id,amount,currency,verified,metadata,created_at"
                f"&order=created_at.desc&limit={max(1, min(limit, 200))}",
            )
            if isinstance(rows, list):
                result = []
                for row in rows:
                    meta = row.get("metadata") or {}
                    evidence = meta.get("evidence") or {}
                    result.append({
                        "event_id": meta.get("event_id") or f"{row.get('provider')}:{row.get('transaction_id')}",
                        "opportunity_id": meta.get("opportunity_id") or f"provider:{row.get('provider')}",
                        "amount": float(row.get("amount", 0) or 0),
                        "currency": str(row.get("currency", "USD")).upper(),
                        "status": "VERIFIED" if row.get("verified") else "PENDING",
                        "evidence": json.dumps(evidence),
                        "created_at": row.get("created_at"),
                    })
                return result

        with sqlite3.connect(self.path) as db:
            rows = db.execute(
                "SELECT event_id,opportunity_id,amount,currency,status,evidence,created_at "
                "FROM revenue_events ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [
            dict(zip(
                ("event_id","opportunity_id","amount","currency","status","evidence","created_at"),
                r
            ))
            for r in rows
        ]
