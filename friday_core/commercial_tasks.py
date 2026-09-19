"""Broad commercial task execution for F.R.I.D.A.Y. V3.

This module turns every registered commercial strategy into a concrete, auditable
execution task. It never fabricates customers or revenue. External side effects
are limited to configured adapters and are recorded with evidence.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import hashlib
import json
import os
from typing import Any

from .capabilities import CAPABILITIES
from .integrations import ExternalAPIError, ResendMailer


@dataclass
class CommercialTaskResult:
    task_id: str
    strategy: str
    capability: str
    status: str
    action: str
    deliverable: dict[str, Any]
    external_actions: list[dict[str, Any]]
    blockers: list[str]
    evidence: list[dict[str, Any]]
    created_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class CommercialTaskEngine:
    """Executes or prepares all registered commercial capability classes.

    The engine distinguishes:
      EXECUTED   = a configured action actually ran
      PREPARED   = a concrete asset/work item was created
      BLOCKED    = a required integration or input is missing
      VERIFIED   = reserved for independently verified financial evidence
    """

    STRATEGY_TO_CAPABILITY = {
        "enterprise": "enterprise",
        "services": "services",
        "mobile_digital_services": "mobile_digital_services",
        "ai_automation_services": "ai_automation_services",
        "lead_generation": "lead_generation",
        "sales": "sales",
        "digital_products": "digital_products",
        "micro_niche_apps": "micro_niche_apps",
        "recurring_saas": "recurring_saas",
        "productized_services": "productized_services",
        "affiliate": "affiliate",
        "affiliate_marketing": "affiliate_marketing",
        "content_marketing": "content_marketing",
        "faceless_content": "faceless_content",
        "email_marketing": "email_marketing",
        "ecommerce": "ecommerce",
        "market_analysis": "market_analysis",
    }

    def __init__(self, service):
        self.service = service
        self.state_path = os.getenv("COMMERCIAL_TASK_STATE_PATH", "friday_commercial_tasks.json")
        self.results: list[dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        try:
            with open(self.state_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
            self.results = list(payload.get("results", []))
        except (FileNotFoundError, ValueError, TypeError, json.JSONDecodeError):
            self.results = []

    def _save(self) -> None:
        tmp = self.state_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump({"results": self.results[-500:]}, handle, indent=2)
        os.replace(tmp, self.state_path)

    @staticmethod
    def _task_id(strategy: str, opportunity_id: str) -> str:
        raw = f"{strategy}|{opportunity_id}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]

    def capability_status(self) -> list[dict[str, Any]]:
        integration = self.service.discovery.status()
        payment = {
            "paddle": bool(self.service.paddle.configured()),
            "supabase": bool(self.service.discovery.supabase.configured()),
            "resend": bool(integration.get("resend_configured")),
            "apollo": bool(integration.get("apollo_configured")),
            "tavily": bool(integration.get("tavily_configured")),
            "browser": bool(integration.get("browser_enabled")),
            "shopify": bool(integration.get("shopify_configured")),
        }
        rows = []
        for capability in CAPABILITIES:
            blockers: list[str] = []
            executable = True
            if capability.name in {"research", "market_analysis"} and not payment["tavily"] and not payment["browser"]:
                blockers.append("No configured research adapter (Tavily or browser).")
                executable = False
            if capability.name == "lead_generation" and not payment["apollo"] and not payment["tavily"]:
                blockers.append("No configured lead-discovery adapter (Apollo or Tavily).")
                executable = False
            if capability.name in {"email_marketing"} and not payment["resend"]:
                blockers.append("RESEND_API_KEY + RESEND_FROM_EMAIL are required for sending.")
            if capability.name == "ecommerce" and not payment["shopify"]:
                blockers.append("Shopify credentials are required for catalog execution.")
            if capability.name in {"invoicing", "payment_verification"} and not payment["paddle"]:
                blockers.append("Paddle credentials are required for payment execution.")
            rows.append({
                "capability": capability.name,
                "category": capability.category,
                "description": capability.description,
                "revenue_relevance": capability.revenue_relevance,
                "handler_ready": True,
                "execution_state": "READY" if executable else "READY_WITH_DEPENDENCY",
                "blockers": blockers,
                "adapters": payment,
            })
        return rows

    def _record(self, result: CommercialTaskResult) -> dict[str, Any]:
        data = result.to_dict()
        self.results.append(data)
        self._save()
        supabase = self.service.discovery.supabase
        if supabase.configured():
            try:
                supabase.insert_task({
                    "task_key": result.task_id,
                    "type": "commercial_execution",
                    "status": result.status.lower(),
                    "priority": "high",
                    "payload": data,
                    "metadata": {"strategy": result.strategy, "capability": result.capability},
                })
                supabase.insert_activity({
                    "event_type": "commercial_task",
                    "actor": "friday-v3",
                    "message": f"{result.status}: {result.strategy}",
                    "metadata": data,
                })
            except ExternalAPIError:
                pass
        return data

    def execute(
        self,
        strategy: str,
        opportunity_id: str = "general",
        amount: float | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        strategy = strategy.strip().lower()
        capability = self.STRATEGY_TO_CAPABILITY.get(strategy, strategy)
        if capability not in {c.name for c in CAPABILITIES}:
            return self._record(CommercialTaskResult(
                task_id=self._task_id(strategy, opportunity_id),
                strategy=strategy,
                capability=capability,
                status="BLOCKED",
                action="No registered execution handler exists for this strategy.",
                deliverable={},
                external_actions=[],
                blockers=[f"Unknown commercial strategy: {strategy}"],
                evidence=[],
                created_at=datetime.now(timezone.utc).isoformat(),
            ))

        task_id = self._task_id(strategy, opportunity_id)
        existing_window = max(0, int(os.getenv("COMMERCIAL_TASK_REEXECUTE_SECONDS", "3600")))
        if existing_window:
            now_ts = datetime.now(timezone.utc)
            for previous in reversed(self.results):
                if previous.get("task_id") != task_id:
                    continue
                try:
                    created = datetime.fromisoformat(str(previous.get("created_at", "")).replace("Z", "+00:00"))
                except ValueError:
                    break
                if (now_ts - created).total_seconds() < existing_window:
                    return previous
                break

        now = datetime.now(timezone.utc).isoformat()
        external: list[dict[str, Any]] = []
        blockers: list[str] = []
        evidence: list[dict[str, Any]] = []
        action = "Prepare a concrete commercial work item."
        deliverable: dict[str, Any] = {}
        status = "PREPARED"

        # Every strategy gets a deterministic local deliverable immediately.
        templates = {
            "enterprise": ("BUILD_ENTERPRISE_PROPOSAL", "decision-ready proposal"),
            "services": ("PACKAGE_AND_OFFER", "fixed-scope service offer"),
            "mobile_digital_services": ("PACKAGE_MOBILE_SERVICE", "remotely deliverable service package"),
            "ai_automation_services": ("MAP_AND_PACKAGE_AUTOMATION", "automation process map and offer"),
            "sales": ("BUILD_SALES_ASSET", "sales script, quote and closing workflow"),
            "digital_products": ("BUILD_DIGITAL_PRODUCT_SPEC", "digital product specification"),
            "micro_niche_apps": ("BUILD_MICRO_NICHE_APP_SPEC", "micro-niche application specification"),
            "recurring_saas": ("BUILD_RECURRING_PRODUCT_SPEC", "subscription product specification"),
            "productized_services": ("BUILD_PRODUCTIZED_SERVICE", "repeatable service package"),
            "affiliate": ("BUILD_AFFILIATE_CAMPAIGN", "affiliate campaign brief and disclosure plan"),
            "affiliate_marketing": ("BUILD_AFFILIATE_CAMPAIGN", "affiliate campaign brief and disclosure plan"),
            "content_marketing": ("BUILD_CONTENT_CAMPAIGN", "original content acquisition campaign"),
            "faceless_content": ("BUILD_FACELESS_CONTENT_SYSTEM", "original faceless content plan"),
            "email_marketing": ("BUILD_EMAIL_CAMPAIGN", "permission-based email campaign"),
            "market_analysis": ("RUN_MARKET_ANALYSIS", "market analysis brief"),
            "research": ("RUN_RESEARCH", "research brief"),
            "software": ("BUILD_SOFTWARE_SPEC", "software implementation specification"),
            "content": ("BUILD_CONTENT_ASSET", "commercial content asset"),
            "data": ("BUILD_DATA_ASSET", "authorized data transformation/report"),
            "automation": ("BUILD_AUTOMATION_PLAN", "workflow automation plan"),
            "customer_operations": ("BUILD_CUSTOMER_WORKFLOW", "customer intake/support workflow"),
            "invoicing": ("PREPARE_INVOICE", "invoice/reconciliation record"),
            "payment_verification": ("VERIFY_PAYMENT", "provider verification task"),
            "portfolio_management": ("REBALANCE_PORTFOLIO", "opportunity allocation decision"),
            "business_building": ("BUILD_BUSINESS_CASE", "business case and operating model"),
            "planning": ("BUILD_EXECUTION_PLAN", "measurable execution plan"),
            "opportunity_testing": ("DESIGN_VALIDATION_TEST", "small validation experiment"),
            "ecommerce": ("VALIDATE_AND_CREATE_CATALOG_ITEM", "validated commerce catalog item"),
        }
        action, label = templates.get(capability, ("PREPARE_COMMERCIAL_TASK", "commercial work item"))
        deliverable = {
            "label": label,
            "strategy": strategy,
            "opportunity_id": opportunity_id,
            "created_at": now,
            "price_anchor": round(max(float(amount or os.getenv("DEFAULT_COMMERCIAL_OFFER_USD", "1500")), 1.0), 2),
            "description": description or f"Commercial offer for {strategy} opportunity {opportunity_id}.",
            "next_step": "Use the configured adapter for the next external stage.",
        }

        # Revenue-facing strategies can create real, reusable Paddle catalog items.
        paddle_offer_strategies = {
            "enterprise",
            "services",
            "mobile_digital_services",
            "ai_automation_services",
            "sales",
            "digital_products",
            "micro_niche_apps",
            "recurring_saas",
            "productized_services",
            "software",
        }
        if capability in paddle_offer_strategies:
            if self.service.paddle.api_configured():
                try:
                    sellable = self.service.paddle.create_sellable_offer(
                        name=f"F.R.I.D.A.Y. {capability.replace('_', ' ').title()}",
                        description=(description or f"Commercial {capability.replace('_', ' ')} offer for {opportunity_id}")[:2048],
                        amount=float(amount or os.getenv("DEFAULT_COMMERCIAL_OFFER_USD", "1500")),
                        currency="USD",
                        recurring=(capability == "recurring_saas"),
                    )
                    deliverable["paddle_offer"] = sellable
                    external.append({
                        "adapter": "paddle",
                        "action": "create_product_and_price",
                        "product_id": (sellable.get("product") or {}).get("id"),
                        "price_id": (sellable.get("price") or {}).get("id"),
                    })
                    evidence.append({
                        "type": "paddle_catalog",
                        "product_id": (sellable.get("product") or {}).get("id"),
                        "price_id": (sellable.get("price") or {}).get("id"),
                    })
                    status = "EXECUTED"
                except Exception as exc:
                    blockers.append(f"Paddle catalog creation failed: {type(exc).__name__}: {exc}")
            else:
                # The handler remains live and the offer specification is ready,
                # but an external catalog cannot be created without Paddle API access.
                blockers.append("Paddle API key is required to create a live catalog product/price.")

        # Live, low-risk adapter execution where it is meaningful.
        elif capability in {"research", "market_analysis"}:
            if self.service.discovery.tavily.configured():
                query = f"commercial demand and buying signals for opportunity {opportunity_id}"
                try:
                    results = self.service.discovery.tavily.search(query, max_results=5)
                    deliverable["research_results"] = results
                    external.append({"adapter": "tavily", "action": "search", "count": len(results)})
                    evidence.append({"type": "tavily", "query": query, "count": len(results)})
                    status = "EXECUTED"
                except ExternalAPIError as exc:
                    blockers.append(f"Tavily search failed: {exc}")
            elif self.service.discovery.browser.configured():
                evidence.append({"type": "browser", "status": "available"})
            else:
                blockers.append("Research adapter not configured.")

        elif capability == "lead_generation":
            leads: list[dict[str, Any]] = []
            if self.service.discovery.apollo.configured():
                try:
                    people = self.service.discovery.apollo.search_people(
                        ["owner", "founder", "ceo", "managing director", "general manager"],
                        [x.strip() for x in os.getenv("APOLLO_TARGET_LOCATIONS", "Uganda,Kenya").split(",") if x.strip()],
                        per_page=10,
                    )
                    leads = people
                    external.append({"adapter": "apollo", "action": "search_people", "count": len(people)})
                    evidence.append({"type": "apollo", "count": len(people)})
                    status = "EXECUTED"
                except ExternalAPIError as exc:
                    blockers.append(f"Apollo search failed: {exc}")
            elif self.service.discovery.tavily.configured():
                try:
                    results = self.service.discovery.tavily.search("Uganda businesses owners founders website automation", 8)
                    leads = results
                    external.append({"adapter": "tavily", "action": "business_discovery", "count": len(results)})
                    evidence.append({"type": "tavily", "count": len(results)})
                    status = "EXECUTED"
                except ExternalAPIError as exc:
                    blockers.append(f"Tavily lead discovery failed: {exc}")
            else:
                blockers.append("Apollo/Tavily is not configured.")
            deliverable["leads"] = leads[:20]

        elif capability == "ecommerce":
            if self.service.discovery.shopify.configured():
                title = f"F.R.I.D.A.Y. validated offer - {opportunity_id}"
                try:
                    product = self.service.discovery.shopify.create_product(
                        title=title,
                        description="Draft catalog item created by F.R.I.D.A.Y. for validated commercialization.",
                        vendor="F.R.I.D.A.Y.",
                        product_type="Digital Service",
                        status="DRAFT",
                    )
                    deliverable["shopify_product"] = product
                    external.append({"adapter": "shopify", "action": "create_draft_product", "product_id": product.get("id")})
                    evidence.append({"type": "shopify", "product_id": product.get("id")})
                    status = "EXECUTED"
                except ExternalAPIError as exc:
                    blockers.append(f"Shopify execution failed: {exc}")
            else:
                blockers.append("Shopify credentials are not configured.")

        elif capability == "email_marketing":
            mailer = ResendMailer()
            deliverable["sending_ready"] = mailer.configured() and mailer.enabled
            if not mailer.configured():
                blockers.append("RESEND_API_KEY and RESEND_FROM_EMAIL are required.")
            elif not mailer.enabled:
                blockers.append("Autonomous email sending is disabled.")
            else:
                # Do not send unsolicited messages merely to mark the task complete.
                blockers.append("Sending requires a real, permission-appropriate recipient from the lead/customer record.")
            if blockers:
                status = "PREPARED"

        elif capability == "payment_verification":
            deliverable["payment_path"] = {
                "paddle_api_configured": self.service.paddle.api_configured(),
                "paddle_webhook_configured": self.service.paddle.webhook_configured(),
            }
            if self.service.paddle.configured():
                status = "READY"
                evidence.append({"type": "paddle", "configured": True})
            else:
                blockers.append("Paddle API and webhook credentials are not both configured.")

        elif capability == "invoicing":
            deliverable["invoice_path"] = "Use /invoices with a real opportunity/customer reference and verified amount."
            status = "READY"

        else:
            # Local planning/specification is a real execution step; no fake external action.
            status = "PREPARED"

        if blockers and status == "EXECUTED":
            status = "EXECUTED"
        result = CommercialTaskResult(
            task_id=self._task_id(strategy, opportunity_id),
            strategy=strategy,
            capability=capability,
            status=status,
            action=action,
            deliverable=deliverable,
            external_actions=external,
            blockers=blockers,
            evidence=evidence,
            created_at=now,
        )
        return self._record(result)

    def launch_revenue_path(
        self,
        strategy: str,
        opportunity_id: str,
        amount: float,
        description: str,
    ) -> dict[str, Any]:
        """Create a sellable offer and a payment checkout when Paddle is configured.

        This prepares a real customer payment path. It does not mark revenue verified
        until Paddle reports a paid/completed transaction.
        """
        task = self.execute(
            strategy=strategy,
            opportunity_id=opportunity_id,
            amount=amount,
            description=description,
        )
        result = {
            "task": task,
            "checkout": None,
            "customer_required_to_pay": True,
            "revenue_verified": False,
        }
        offer = task.get("deliverable", {}).get("paddle_offer") or {}
        price = offer.get("price") or {}
        price_id = price.get("id")
        if price_id and self.service.paddle.api_configured():
            checkout = self.service.paddle.create_checkout_transaction(
                [{"price_id": price_id, "quantity": 1}],
                custom_data={"opportunity_id": opportunity_id, "friday_task_id": task.get("task_id")},
                currency="USD",
            )
            result["checkout"] = {
                "transaction_id": checkout.transaction_id,
                "status": checkout.status,
                "checkout_url": checkout.checkout_url,
                "price_id": price_id,
            }
            result["evidence"] = [{
                "type": "paddle_checkout",
                "transaction_id": checkout.transaction_id,
                "checkout_url": checkout.checkout_url,
            }]
        else:
            result["blocker"] = "A sellable Paddle price was not available, so no checkout transaction was created."
        return result

    def run_all(self, opportunity_id_prefix: str = "cycle") -> dict[str, Any]:
        results = []
        for capability in CAPABILITIES:
            results.append(self.execute(capability.name, f"{opportunity_id_prefix}-{capability.name}"))
        return {
            "ran": True,
            "capability_count": len(results),
            "results": results,
            "summary": {
                "executed": sum(r["status"] == "EXECUTED" for r in results),
                "prepared": sum(r["status"] == "PREPARED" for r in results),
                "ready": sum(r["status"] == "READY" for r in results),
                "blocked": sum(r["status"] == "BLOCKED" for r in results),
            },
        }

    def recent(self, limit: int = 50) -> list[dict[str, Any]]:
        return self.results[-max(1, min(limit, 200)):]
