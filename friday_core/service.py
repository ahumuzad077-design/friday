"""Application services connecting goals, planning, invoices and verified revenue."""
from __future__ import annotations

from datetime import datetime, timezone
import os
import json

from .autopilot import AutonomousWorkLoop
from .config import Settings
from .invoices import InvoiceStore
from .ledger import RevenueLedger
from .llm import FreeFirstLLM
from .models import Goal, RevenueEvent
from .orchestrator import AutonomousOrchestrator
from .payments import PaddleGateway, PaymentResult
from .providers import ProviderRouter
from .integrations import ExternalAPIError, MarketDiscovery
from .mission_engine import MissionEngine


class FridayService:
    def __init__(self):
        self.settings = Settings()
        self.router = ProviderRouter()
        self.llm = FreeFirstLLM(self.router)
        self.ledger = RevenueLedger(self.settings.ledger_path)
        self.invoices = InvoiceStore(self.settings.ledger_path)
        self.paddle = PaddleGateway()
        self.orchestrator = AutonomousOrchestrator(self.settings, self.ledger, self.router)
        self.discovery = MarketDiscovery()
        self.mission_engine = MissionEngine(self.settings, self.ledger)
        self.goal: Goal | None = None
        self.last_discovery: dict = {"count": 0, "status": "not_run"}
        self.autopilot = AutonomousWorkLoop(self)

        # A temporary mission target overrides the long-run hourly/capital goal.
        # Example: MISSION_TARGET_AMOUNT=100000 with MISSION_TARGET_DEADLINE=2026-09-20.
        if self.settings.mission_target is not None:
            self.set_goal(
                self.settings.mission_target,
                self.settings.mission_currency,
                self.settings.mission_deadline,
            )
        elif self.settings.hourly_target is not None:
            self.set_goal(
                self.settings.hourly_target * 24 * 61,
                self.settings.hourly_target_currency,
                self.settings.hourly_target_deadline,
            )
        elif self.settings.capital_target is not None:
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
        return self.orchestrator.build_portfolio(self.goal, self._discover_opportunities())

    def _discover_opportunities(self):
        try:
            candidates = self.discovery.discover(limit=self.settings.max_parallel)
        except Exception as exc:
            self.last_discovery = {"count": 0, "status": "error", "error": f"{type(exc).__name__}: {exc}"}
            return []
        discovered = []
        for candidate in candidates:
            website = candidate.website
            evidence = candidate.evidence
            if website:
                try:
                    page = self.discovery.browser.inspect(website)
                    title = str(page.get("title") or "")
                    snippet = str(page.get("text") or "")[:1500]
                    evidence = (evidence + "\nBrowser evidence: " + title + "\n" + snippet)[:3000]
                except Exception as exc:
                    evidence = (evidence + f"\nBrowser inspection unavailable: {type(exc).__name__}: {exc}")[:3000]
            from .models import Opportunity
            opportunity = Opportunity(
                id=f"discovered-{candidate.external_ref}",
                strategy="services",
                description=(
                    f"Potential customer {candidate.company or 'unknown business'}: "
                    f"offer a fixed-scope website/customer-automation service. "
                    f"Evidence: {evidence}"
                ),
                expected_value=float(os.getenv("SERVICE_OFFER_PRICE_USD", "1500")),
                probability=max(0.01, min(0.5, candidate.fit_score * 0.15)),
                time_to_cash_hours=float(os.getenv("SERVICE_TIME_TO_CASH_HOURS", "72")),
                estimated_cost=0.0,
                risk=0.15,
                required_capabilities=["market_discovery", "sales", "services"],
                status="DISCOVERED",
            )
            discovered.append(opportunity)
            if self.discovery.supabase.configured():
                try:
                    self.discovery.supabase.upsert_opportunity({
                        "external_ref": candidate.external_ref,
                        "strategy": "services",
                        "title": f"Service opportunity: {candidate.company or 'business'}",
                        "description": opportunity.description[:5000],
                        "source": candidate.source,
                        "expected_value": opportunity.expected_value,
                        "probability": opportunity.probability,
                        "time_to_cash_hours": opportunity.time_to_cash_hours,
                        "cost": opportunity.estimated_cost,
                        "risk": opportunity.risk,
                        "score": opportunity.score,
                        "status": "discovered",
                        "metadata": {"website": candidate.website, "source_url": candidate.source_url},
                    })
                    self.discovery.supabase.insert_lead(candidate.to_lead_row())
                except ExternalAPIError:
                    pass
        self.last_discovery = {
            "count": len(discovered),
            "status": "ok",
            "supabase_persisted": self.discovery.supabase.configured(),
            "browser_enabled": self.discovery.browser.configured(),
        }
        return discovered

    def create_invoice(self, opportunity_id: str, description: str, amount: float, currency: str = "USD", customer_ref: str = "") -> dict:
        return self.invoices.create(opportunity_id, description, amount, currency, "paddle", customer_ref)

    def create_paddle_checkout(self, invoice: dict, price_id: str) -> dict:
        if not self.paddle.api_configured():
            raise RuntimeError("Paddle API is not configured")
        result = self.paddle.create_checkout_transaction(
            [{"price_id": price_id, "quantity": 1}],
            custom_data={"friday_invoice_id": invoice["invoice_id"], "opportunity_id": invoice["opportunity_id"]},
            currency=invoice["currency"],
        )
        self.invoices.update_provider(invoice["invoice_id"], result.transaction_id, result.status.upper())
        return {"invoice": invoice["invoice_id"], "transaction": result.transaction_id, "status": result.status, "checkout_url": result.checkout_url}

    def _record_verified_paddle_result(self, result: PaymentResult, custom_data: dict | None = None) -> dict:
        custom = custom_data or {}
        opportunity_id = custom.get("opportunity_id") or f"paddle:{result.transaction_id}"
        invoice_id = custom.get("friday_invoice_id")
        self.ledger.record(RevenueEvent(
            event_id=f"paddle:{result.transaction_id}",
            opportunity_id=opportunity_id,
            amount=result.amount,
            currency=result.currency,
            status="VERIFIED",
            evidence={"provider": "paddle", "transaction_id": result.transaction_id, "invoice_number": result.invoice_number, "verification": "provider_api_or_webhook"},
            created_at=datetime.now(timezone.utc).isoformat(),
        ))
        if invoice_id:
            self.invoices.update_provider(invoice_id, result.transaction_id, "PAID")
        self.reconcile_goal()
        if self.discovery.supabase.configured():
            try:
                self.discovery.supabase.insert_revenue_event({
                    "provider": "paddle",
                    "transaction_id": result.transaction_id,
                    "amount": result.amount,
                    "currency": result.currency,
                    "verified": True,
                    "metadata": {"invoice_number": result.invoice_number, "opportunity_id": opportunity_id},
                })
            except ExternalAPIError:
                pass
        return {"accepted": True, "revenue_recorded": True, "transaction_id": result.transaction_id, "verified_amount": result.amount, "currency": result.currency}

    def sync_paddle_transaction(self, transaction_id: str) -> dict:
        if not self.paddle.api_configured():
            raise RuntimeError("Paddle API is not configured")
        result = self.paddle.get_transaction(transaction_id)
        if result.status not in {"paid", "completed"} or result.amount <= 0:
            return {"accepted": True, "revenue_recorded": False, "transaction_id": result.transaction_id, "provider_status": result.status}
        data = self.paddle._request("GET", f"/transactions/{transaction_id}").get("data", {})
        return self._record_verified_paddle_result(result, data.get("custom_data") or {})

    def handle_paddle_webhook(self, raw_body: bytes, signature: str) -> dict:
        if not self.paddle.webhook_configured():
            raise RuntimeError("Paddle webhook secret is not configured")
        if not self.paddle.verify_webhook(raw_body, signature):
            raise ValueError("invalid Paddle webhook signature")
        result = self.paddle.parse_paid_event(raw_body)
        if not result:
            return {"accepted": True, "revenue_recorded": False}
        event = json.loads(raw_body.decode("utf-8"))
        data = event.get("data") or {}
        return self._record_verified_paddle_result(result, data.get("custom_data") or {})

    def _hourly_target_status(self) -> dict | None:
        if self.settings.hourly_target is None:
            return None
        now = datetime.now(timezone.utc)
        recent = self.ledger.recent(500)
        hour_start = now.replace(minute=0, second=0, microsecond=0)
        verified_this_hour = 0.0
        period_total = 0.0
        for event in recent:
            if event.get("status") != "VERIFIED" or event.get("currency") != self.settings.hourly_target_currency:
                continue
            try:
                created = datetime.fromisoformat(event["created_at"].replace("Z", "+00:00"))
            except (TypeError, ValueError):
                continue
            amount = float(event.get("amount", 0) or 0)
            if created >= hour_start:
                verified_this_hour += amount
            created_day = created.date().isoformat()
            if self.settings.hourly_target_start and created_day < self.settings.hourly_target_start:
                continue
            if self.settings.hourly_target_deadline and created_day > self.settings.hourly_target_deadline:
                continue
            period_total += amount
        return {
            "target_per_hour": self.settings.hourly_target,
            "currency": self.settings.hourly_target_currency,
            "period_start": self.settings.hourly_target_start or None,
            "period_deadline": self.settings.hourly_target_deadline,
            "verified_this_hour": round(verified_this_hour, 2),
            "hourly_gap": round(max(self.settings.hourly_target - verified_this_hour, 0), 2),
            "period_verified": round(period_total, 2),
            "theoretical_61_day_run_rate": round(self.settings.hourly_target * 24 * 61, 2),
            "target_is_operating_goal_only": True,
        }

    def status(self):
        self.reconcile_goal()
        return {
            "engine_version": "3-enhanced",
            "live_mode": self.settings.live_mode,
            "payment_verification_required": self.settings.require_payment_verification,
            "providers": self.router.status(),
            "paddle_api_configured": self.paddle.api_configured(),
            "paddle_webhook_configured": self.paddle.webhook_configured(),
            "paddle_configured": self.paddle.configured(),
            "paddle_verification_paths": [
                "webhook" if self.paddle.webhook_configured() else None,
                "api_transaction_sync" if self.paddle.api_configured() else None,
            ],
            "autopilot": self.autopilot.status(),
            "discovery": self.discovery.status() | {"last_discovery": self.last_discovery},
            "mission_engine": self.mission_engine.status(self.goal, None, limit=self.settings.max_parallel),
            "mission_target": None if self.settings.mission_target is None else {
                "target": self.settings.mission_target,
                "currency": self.settings.mission_currency,
                "deadline": self.settings.mission_deadline,
            },
            "hourly_target": self._hourly_target_status(),
            "goal": None if not self.goal else {
                "target": self.goal.target,
                "currency": self.goal.currency,
                "verified_progress": self.goal.verified_progress,
                "remaining": max(self.goal.target - self.goal.verified_progress, 0),
                "deadline": self.goal.deadline,
            },
        }
