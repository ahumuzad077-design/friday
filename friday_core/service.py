"""Application services connecting goals, planning, invoices and verified revenue."""
from __future__ import annotations

from datetime import datetime, timezone
import json

from .config import Settings
from .invoices import InvoiceStore
from .ledger import RevenueLedger
from .llm import FreeFirstLLM
from .models import Goal, RevenueEvent
from .orchestrator import AutonomousOrchestrator
from .payments import PaddleGateway
from .providers import ProviderRouter


class FridayService:
    def __init__(self):
        self.settings = Settings()
        self.router = ProviderRouter()
        self.llm = FreeFirstLLM(self.router)
        self.ledger = RevenueLedger(self.settings.ledger_path)
        self.invoices = InvoiceStore(self.settings.ledger_path)
        self.paddle = PaddleGateway()
        self.orchestrator = AutonomousOrchestrator(
            self.settings, self.ledger, self.router
        )
        self.goal: Goal | None = None
        if self.settings.capital_target is not None:
            self.set_goal(
                self.settings.capital_target,
                self.settings.capital_currency,
                self.settings.capital_deadline,
            )

    def set_goal(self, target: float, currency: str = "USD", deadline: str | None = None) -> Goal:
        if target <= 0:
            raise ValueError("target must be greater than zero")
        self.goal = Goal(target=float(target), currency=currency.upper(), deadline=deadline)
        self.reconcile_goal()
        return self.goal

    def reconcile_goal(self):
        if self.goal:
            self.goal.verified_progress = self.ledger.verified_total(self.goal.currency)

    def portfolio(self):
        if not self.goal:
            raise ValueError("set a goal first")
        return self.orchestrator.build_portfolio(self.goal)

    def create_invoice(
        self,
        opportunity_id: str,
        description: str,
        amount: float,
        currency: str = "USD",
        customer_ref: str = "",
    ) -> dict:
        return self.invoices.create(
            opportunity_id, description, amount, currency, "paddle", customer_ref
        )

    def create_paddle_checkout(self, invoice: dict, price_id: str) -> dict:
        if not self.paddle.configured():
            raise RuntimeError("Paddle is not configured")
        result = self.paddle.create_checkout_transaction(
            [{"price_id": price_id, "quantity": 1}],
            custom_data={
                "friday_invoice_id": invoice["invoice_id"],
                "opportunity_id": invoice["opportunity_id"],
            },
            currency=invoice["currency"],
        )
        self.invoices.update_provider(
            invoice["invoice_id"], result.transaction_id, result.status.upper()
        )
        return {
            "invoice": invoice["invoice_id"],
            "transaction": result.transaction_id,
            "status": result.status,
            "checkout_url": result.checkout_url,
        }

    def handle_paddle_webhook(self, raw_body: bytes, signature: str) -> dict:
        if not self.paddle.verify_webhook(raw_body, signature):
            raise ValueError("invalid Paddle webhook signature")
        result = self.paddle.parse_paid_event(raw_body)
        if not result:
            return {"accepted": True, "revenue_recorded": False}

        event = json.loads(raw_body.decode("utf-8"))
        data = event.get("data") or {}
        custom = data.get("custom_data") or {}
        opportunity_id = custom.get("opportunity_id") or f"paddle:{result.transaction_id}"
        invoice_id = custom.get("friday_invoice_id")
        self.ledger.record(
            RevenueEvent(
                event_id=f"paddle:{result.transaction_id}",
                opportunity_id=opportunity_id,
                amount=result.amount,
                currency=result.currency,
                status="VERIFIED",
                evidence={
                    "provider": "paddle",
                    "transaction_id": result.transaction_id,
                    "invoice_number": result.invoice_number,
                },
                created_at=datetime.now(timezone.utc).isoformat(),
            )
        )
        if invoice_id:
            self.invoices.update_provider(invoice_id, result.transaction_id, "PAID")
        self.reconcile_goal()
        return {
            "accepted": True,
            "revenue_recorded": True,
            "transaction_id": result.transaction_id,
            "verified_amount": result.amount,
            "currency": result.currency,
        }

    def status(self):
        self.reconcile_goal()
        return {
            "live_mode": self.settings.live_mode,
            "payment_verification_required": self.settings.require_payment_verification,
            "providers": self.router.status(),
            "paddle_configured": self.paddle.configured(),
            "goal": None
            if not self.goal
            else {
                "target": self.goal.target,
                "currency": self.goal.currency,
                "verified_progress": self.goal.verified_progress,
                "remaining": max(self.goal.target - self.goal.verified_progress, 0),
                "deadline": self.goal.deadline,
            },
        }
