"""Execution adapters with explicit safety gates.

The agent may prepare and execute legitimate business actions, but outbound
communication is disabled by default and capped. Money-out/wallet transfers are
intentionally not exposed here.
"""
from __future__ import annotations

import json
import os
import smtplib
import sqlite3
from datetime import datetime, timezone
from email.message import EmailMessage


class Guard:
    def __init__(self):
        self.enabled = os.getenv("ALLOW_AUTONOMOUS_EMAIL", "false").lower() in {"1", "true", "yes", "on"}
        self.max_per_day = int(os.getenv("MAX_AUTONOMOUS_EMAILS_PER_DAY", "20"))
        self.sent_today = 0
        self.day = datetime.now(timezone.utc).date()

    def allow_email(self) -> bool:
        now_day = datetime.now(timezone.utc).date()
        if now_day != self.day:
            self.day, self.sent_today = now_day, 0
        return self.enabled and self.sent_today < self.max_per_day


class SMTPExecutor:
    def __init__(self, guard: Guard | None = None):
        self.guard = guard or Guard()

    def send(self, recipient: str, subject: str, body: str) -> dict:
        if not self.guard.allow_email():
            return {"sent": False, "reason": "autonomous email is disabled or daily cap reached"}
        sender = os.getenv("SENDER_EMAIL")
        password = os.getenv("SENDER_PASSWORD")
        if not sender or not password:
            return {"sent": False, "reason": "email credentials are not configured"}
        if not recipient or "@" not in recipient:
            return {"sent": False, "reason": "invalid recipient"}
        message = EmailMessage()
        message["From"] = sender
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        with smtplib.SMTP(
            os.getenv("SMTP_SERVER", "smtp.gmail.com"),
            int(os.getenv("SMTP_PORT", "587")),
            timeout=30,
        ) as smtp:
            smtp.starttls()
            smtp.login(sender, password)
            smtp.send_message(message)
        self.guard.sent_today += 1
        return {"sent": True, "recipient": recipient}


class RevenueExecutionPipeline:
    """Durable commercial state machine.

    Pipeline state is persisted in the same SQLite database as the revenue
    ledger, so a restart does not erase opportunities or payment state.
    This class never creates or verifies money by itself; provider-backed
    FridayService payment verification is the only source of verified money.
    """

    STAGES = (
        "research",
        "qualify",
        "offer",
        "landing_page",
        "checkout",
        "customer_action",
        "payment_verification",
        "delivery",
        "measurement",
        "iteration",
    )

    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or os.getenv("FRIDAY_LEDGER_DB", "friday_ledger.sqlite3")
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                """CREATE TABLE IF NOT EXISTS revenue_pipeline (
                    opportunity_id TEXT PRIMARY KEY,
                    stage TEXT NOT NULL,
                    offer TEXT NOT NULL,
                    payment_verified INTEGER NOT NULL DEFAULT 0,
                    delivered INTEGER NOT NULL DEFAULT 0,
                    history TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )"""
            )
            db.commit()

    def _row(self, opportunity_id: str):
        with sqlite3.connect(self.db_path) as db:
            return db.execute(
                "SELECT opportunity_id,stage,offer,payment_verified,delivered,history FROM revenue_pipeline WHERE opportunity_id=?",
                (opportunity_id,),
            ).fetchone()

    def create(self, opportunity_id: str, offer: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        history = json.dumps([{"stage": "research", "at": now, "evidence": {}}])
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                """INSERT INTO revenue_pipeline
                   (opportunity_id,stage,offer,payment_verified,delivered,history,updated_at)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(opportunity_id) DO UPDATE SET
                     offer=excluded.offer, updated_at=excluded.updated_at""",
                (opportunity_id, "research", json.dumps(offer or {}), 0, 0, history, now),
            )
            db.commit()
        return self.snapshot(opportunity_id)

    def advance(self, opportunity_id: str, stage: str, evidence: dict | None = None) -> dict:
        row = self._row(opportunity_id)
        if not row:
            raise KeyError(opportunity_id)
        if stage not in self.STAGES:
            raise ValueError(f"unknown stage: {stage}")
        current = self.STAGES.index(row[1])
        target = self.STAGES.index(stage)
        if target < current:
            raise ValueError("pipeline cannot move backwards")
        if stage == "delivery" and not bool(row[3]):
            raise ValueError("delivery requires verified payment")
        now = datetime.now(timezone.utc).isoformat()
        history = json.loads(row[5] or "[]")
        history.append({"stage": stage, "at": now, "evidence": evidence or {}})
        delivered = 1 if stage == "delivery" else int(row[4])
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                "UPDATE revenue_pipeline SET stage=?, delivered=?, history=?, updated_at=? WHERE opportunity_id=?",
                (stage, delivered, json.dumps(history), now, opportunity_id),
            )
            db.commit()
        return self.snapshot(opportunity_id)

    def mark_payment_verified(self, opportunity_id: str, evidence: dict) -> dict:
        row = self._row(opportunity_id)
        if not row:
            raise KeyError(opportunity_id)
        now = datetime.now(timezone.utc).isoformat()
        history = json.loads(row[5] or "[]")
        history.append({"stage": "payment_verification", "at": now, "evidence": evidence})
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                "UPDATE revenue_pipeline SET stage=?, payment_verified=1, history=?, updated_at=? WHERE opportunity_id=?",
                ("payment_verification", json.dumps(history), now, opportunity_id),
            )
            db.commit()
        return self.snapshot(opportunity_id)

    def snapshot(self, opportunity_id: str) -> dict:
        row = self._row(opportunity_id)
        if not row:
            raise KeyError(opportunity_id)
        return {
            "opportunity_id": row[0],
            "stage": row[1],
            "payment_verified": bool(row[3]),
            "delivered": bool(row[4]),
            "history_count": len(json.loads(row[5] or "[]")),
            "offer": json.loads(row[2] or "{}"),
        }
