"""Execution adapters with explicit safety gates.

The agent may prepare and execute legitimate business actions, but outbound
communication is disabled by default and capped. Money-out/wallet transfers
are intentionally not exposed here.
"""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from datetime import datetime, timezone


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
        with smtplib.SMTP(os.getenv("SMTP_SERVER", "smtp.gmail.com"), int(os.getenv("SMTP_PORT", "587")), timeout=30) as smtp:
            smtp.starttls()
            smtp.login(sender, password)
            smtp.send_message(message)
        self.guard.sent_today += 1
        return {"sent": True, "recipient": recipient}


class RevenueExecutionPipeline:
    """State machine for a legitimate commercial opportunity.

    It prepares work in deterministic stages. Payment credentials and money-out
    actions never enter this pipeline. Customer-facing sends remain guarded by
    SMTPExecutor/approval policy.
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

    def __init__(self):
        self.states: dict[str, dict] = {}

    def create(self, opportunity_id: str, offer: dict) -> dict:
        self.states[opportunity_id] = {
            "opportunity_id": opportunity_id,
            "stage": "research",
            "offer": offer,
            "payment_verified": False,
            "delivered": False,
            "history": [],
        }
        return self.snapshot(opportunity_id)

    def advance(self, opportunity_id: str, stage: str, evidence: dict | None = None) -> dict:
        state = self.states.get(opportunity_id)
        if not state:
            raise KeyError(opportunity_id)
        if stage not in self.STAGES:
            raise ValueError(f"unknown stage: {stage}")
        current = self.STAGES.index(state["stage"])
        target = self.STAGES.index(stage)
        if target < current:
            raise ValueError("pipeline cannot move backwards")
        if stage == "delivery" and not state["payment_verified"]:
            raise ValueError("delivery requires verified payment")
        state["stage"] = stage
        state["history"].append({
            "stage": stage,
            "at": datetime.now(timezone.utc).isoformat(),
            "evidence": evidence or {},
        })
        return self.snapshot(opportunity_id)

    def mark_payment_verified(self, opportunity_id: str, evidence: dict) -> dict:
        state = self.states.get(opportunity_id)
        if not state:
            raise KeyError(opportunity_id)
        state["payment_verified"] = True
        state["history"].append({
            "stage": "payment_verification",
            "at": datetime.now(timezone.utc).isoformat(),
            "evidence": evidence,
        })
        state["stage"] = "payment_verification"
        return self.snapshot(opportunity_id)

    def snapshot(self, opportunity_id: str) -> dict:
        state = self.states.get(opportunity_id)
        if not state:
            raise KeyError(opportunity_id)
        return {
            "opportunity_id": state["opportunity_id"],
            "stage": state["stage"],
            "payment_verified": state["payment_verified"],
            "delivered": state["delivered"],
            "history_count": len(state["history"]),
            "offer": state["offer"],
        }
