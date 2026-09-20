"""FastAPI surface for F.R.I.D.A.Y. v3.

HTTP endpoints manage state, provide a human command/chat surface, and receive
verified payment webhooks or explicit Paddle transaction reconciliation calls.
Long-running commercial work runs in the background worker loop.
"""
from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException, Request
import os
import re
from pydantic import BaseModel, Field

from .service import FridayService
from .integrations import ExternalAPIError
from .execution import RevenueExecutionPipeline

app = FastAPI(title="F.R.I.D.A.Y. v3", version="3.0")
service = FridayService()
revenue_pipeline = RevenueExecutionPipeline()


class GoalRequest(BaseModel):
    target: float = Field(gt=0)
    currency: str = "USD"
    deadline: str | None = None


class InvoiceRequest(BaseModel):
    opportunity_id: str
    description: str
    amount: float = Field(gt=0)
    currency: str = "USD"
    customer_ref: str = ""


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)


class NewMissionRequest(BaseModel):
    target: float = Field(gt=0)
    currency: str = "USD"
    deadline: str | None = None
    name: str = "Custom Mission"
    objective: str = ""


class JobIntakeRequest(BaseModel):
    url: str = Field(min_length=8, max_length=4000)
    instruction: str = Field(default="", max_length=8000)
    page_text: str = Field(default="", max_length=20000)
    title: str = Field(default="", max_length=500)


class JobExecuteRequest(BaseModel):
    job_id: str = Field(min_length=4, max_length=100)


def _require_control_token(token: str | None) -> None:
    expected = os.getenv("FRIDAY_CONTROL_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="FRIDAY_CONTROL_TOKEN is not configured for control endpoints",
        )
    if token != expected:
        raise HTTPException(status_code=401, detail="invalid control token")


@app.on_event("startup")
async def start_fiday_autopilot():
    service.autopilot.start()


@app.on_event("shutdown")
async def stop_friday_autopilot():
    service.autopilot.stop()


@app.get("/health")
def health():
    return {"ok": True, "service": "friday-v3", "autopilot": service.autopilot.status()}


@app.get("/status")
def status():
    return service.status()


@app.get("/capacity")
def capacity():
    integration = service.discovery.status()
    capabilities = service.commercial.capability_status()
    configured = [x for x in capabilities if x.get("handler_ready")]
    ready = [x for x in capabilities if x.get("execution_state") == "READY"]
    dependencies = [x for x in capabilities if x.get("execution_state") != "READY"]
    providers = service.llm.router.status()
    return {
        "engine": "F.R.I.D.A.Y. V3 Enhanced",
        "capacity_is_operating_estimate": True,
        "not_revenue": True,
        "configured_providers": [p["provider"] for p in providers if p.get("configured")],
        "available_providers": [p["provider"] for p in providers if p.get("available")],
        "max_parallel_opportunities": service.settings.max_parallel,
        "commercial_handlers": len(configured),
        "commercial_handlers_ready_without_extra_adapter": len(ready),
        "commercial_handlers_with_dependencies": len(dependencies),
        "integrations": integration,
        "default_offer_usd": float(os.getenv("DEFAULT_COMMERCIAL_OFFER_USD", "1500")),
        "service_offer_usd": float(os.getenv("SERVICE_OFFER_PRICE_USD", "1500")),
        "email_daily_cap": int(os.getenv("MAX_AUTONOMOUS_EMAILS_PER_DAY", "20")),
        "guidance": "Use these figures to size the operation. They are not forecasts or guaranteed revenue.",
    }


@app.get("/providers")
def providers():
    return service.llm.router.status()


@app.post("/mission/new")
def new_mission(
    request: NewMissionRequest,
):
    goal = service.set_goal(request.target, request.currency, request.deadline)
    return {
        "mission_replaced": True,
        "name": request.name,
        "objective": request.objective,
        "target": goal.target,
        "currency": goal.currency,
        "deadline": goal.deadline,
        "verified_revenue": goal.verified_progress,
        "note": "This replaces the active runtime mission for the current service process.",
    }


@app.post("/goal")
def set_goal(
    request: GoalRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    goal = service.set_goal(request.target, request.currency, request.deadline)
    return {
        "target": goal.target,
        "currency": goal.currency,
        "deadline": goal.deadline,
        "verified_progress": goal.verified_progress,
    }


class PipelineCreateRequest(BaseModel):
    opportunity_id: str
    offer: dict = Field(default_factory=dict)


class PipelineAdvanceRequest(BaseModel):
    stage: str
    evidence: dict = Field(default_factory=dict)


class PipelinePaymentRequest(BaseModel):
    transaction_id: str = Field(min_length=1)


@app.post("/pipeline")
def pipeline_create(
    request: PipelineCreateRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    return revenue_pipeline.create(request.opportunity_id, request.offer)


@app.get("/pipeline/{opportunity_id}")
def pipeline_get(opportunity_id: str):
    try:
        return revenue_pipeline.snapshot(opportunity_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="pipeline opportunity not found") from exc


@app.post("/pipeline/{opportunity_id}/advance")
def pipeline_advance(
    opportunity_id: str,
    request: PipelineAdvanceRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        return revenue_pipeline.advance(opportunity_id, request.stage, request.evidence)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="pipeline opportunity not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/pipeline/{opportunity_id}/payment-verified")
def pipeline_payment_verified(
    opportunity_id: str,
    request: PipelinePaymentRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        result = service.sync_paddle_transaction(request.transaction_id)
        if not result.get("revenue_recorded"):
            raise HTTPException(
                status_code=409,
                detail="Paddle has not reported this transaction as paid/completed",
            )
        return revenue_pipeline.mark_payment_verified(
            opportunity_id,
            {
                "provider": "paddle",
                "transaction_id": request.transaction_id,
                "verified_amount": result.get("verified_amount"),
                "currency": result.get("currency"),
            },
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="pipeline opportunity not found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/jobs/intake")
def jobs_intake(request: JobIntakeRequest):
    try:
        return service.jobs.intake(
            request.url,
            instruction=request.instruction,
            page_text=request.page_text,
            title=request.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/jobs")
def jobs_recent(limit: int = 20):
    return service.jobs.recent(limit)


@app.get("/jobs/{job_id}")
def jobs_get(job_id: str):
    try:
        return service.jobs.get(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="job not found") from exc


@app.post("/jobs/{job_id}/execute")
def jobs_execute(
    job_id: str,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        return service.jobs.execute(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="job not found") from exc


@app.get("/opportunities")
def opportunities():
    try:
        return [o.__dict__ | {"score": o.score} for o in service.portfolio()]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/autopilot")
def autopilot_status():
    return service.autopilot.status()


@app.get("/mission")
def mission_status():
    if service.goal is None:
        return service.mission_engine.status(None)
    opportunities = service.portfolio()
    return service.mission_engine.status(service.goal, opportunities, limit=service.settings.max_parallel)


@app.post("/discovery/run")
def discovery_run(
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        opportunities = service.portfolio()
        return {
            "discovery": service.last_discovery,
            "opportunities": [o.__dict__ | {"score": o.score} for o in opportunities],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"discovery failed: {type(exc).__name__}: {exc}") from exc


@app.post("/browser/inspect")
def browser_inspect(
    url: str,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        return service.discovery.browser.inspect(url)
    except (ExternalAPIError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/shopify/products")
def shopify_products(limit: int = 25):
    try:
        return {
            "configured": service.discovery.shopify.configured(),
            "products": service.discovery.shopify.list_products(limit),
        }
    except ExternalAPIError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class ShopifyProductRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    vendor: str = "F.R.I.D.A.Y."
    product_type: str = ""
    status: str = "DRAFT"


@app.post("/shopify/products")
def shopify_create_product(
    request: ShopifyProductRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        return service.discovery.shopify.create_product(
            title=request.title,
            description=request.description,
            vendor=request.vendor,
            product_type=request.product_type,
            status=request.status,
        )
    except ExternalAPIError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/shopify/publications")
def shopify_publications():
    try:
        return {
            "configured": service.discovery.shopify.configured(),
            "publications": service.discovery.shopify.list_publications(),
        }
    except ExternalAPIError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class ShopifyPublishRequest(BaseModel):
    product_id: str
    publication_id: str


@app.post("/shopify/publish")
def shopify_publish(
    request: ShopifyPublishRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        return service.discovery.shopify.publish_product(
            request.product_id,
            request.publication_id,
        )
    except ExternalAPIError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/autopilot/run")
def autopilot_run_once(
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        return service.autopilot.run_once()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"autopilot cycle failed: {type(exc).__name__}: {exc}") from exc


@app.post("/invoices")
def create_invoice(
    request: InvoiceRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    return service.create_invoice(
        request.opportunity_id,
        request.description,
        request.amount,
        request.currency,
        request.customer_ref,
    )


@app.post("/chat")
def chat(request: ChatRequest):
    system = (
        "You are F.R.I.D.A.Y., a truthful execution-focused commercial operations agent. "
        "When the user gives a revenue goal, treat it as a mission to execute legitimate, "
        "commercially useful work toward that goal, not as a request for motivational advice. "
        "Use the current system context to decide what is actually executable. Never invent "
        "revenue, payments, customers, leads, orders, outreach, deliveries, credentials, "
        "or completed actions. Only describe an action as completed when the current system "
        "has evidence for it. Only call money revenue when the verified revenue ledger says so. "
        "Do not request secrets in chat. When an action is available through a configured "
        "adapter, describe the concrete execution path and do not replace it with generic advice. "
        "For Paddle, a product and price can be created first and a draft automatically-collected "
        "checkout transaction can then be created without an existing customer. The customer is "
        "needed to complete payment, and only a verified paid/completed transaction counts as revenue. "
        "When an action is not available, do not pretend it is: state the exact blocker and the "
        "smallest human configuration needed to unlock it, then continue with every other action "
        "that is actually executable. Distinguish READY, BLOCKED, NEEDS_HUMAN_ACTION, EXECUTED, "
        "and VERIFIED. A revenue target is an operating goal, never evidence that revenue exists. "
        "Do not promise that a target will be reached. Optimize for real customer acquisition, "
        "offer creation, checkout creation, payment verification, and delivery using legitimate "
        "integrations and keep an evidence trail for each step."
    )
    raw_mission = request.message.strip()
    new_mission_match = __import__("re").match(
        r"^NEW MISSION\\s*\\|\\s*target\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*"
        r"(?:\\|\\s*currency\\s*=\\s*([A-Za-z]{3}))?\\s*"
        r"(?:\\|\\s*deadline\\s*=\\s*([^|]+))?"
        r"(?:\\|\\s*(?:name|objective)\\s*=\\s*([^|]+))?\\s*$",
        raw_mission,
        flags=__import__("re").IGNORECASE,
    )
    if new_mission_match:
        target = float(new_mission_match.group(1))
        currency = (new_mission_match.group(2) or "USD").upper()
        deadline = (new_mission_match.group(3) or "").strip() or None
        objective = (new_mission_match.group(4) or "").strip()
        goal = service.set_goal(target, currency, deadline)
        return {
            "reply": (
                "NEW MISSION ACCEPTED\n\n"
                f"Target: {goal.target:g} {goal.currency}\n"
                f"Deadline: {goal.deadline or 'none'}\n"
                f"Verified revenue: {goal.verified_progress:.2f} {goal.currency}\n"
                f"Objective: {objective or 'open commercial execution'}\n\n"
                "The previous active mission has been replaced for this running V3 process. "
                "Use /capacity to inspect operating capacity without mission-target context."
            ),
            "provider": None,
            "model": "deterministic-mission-mode",
            "attempts": 0,
            "execution": None,
        }

    # Any user-supplied job URL can be ingested. Public pages may be inspected;
    # authenticated marketplace submission remains gated to an approved connector/session.
    job_urls = re.findall(r'https?://[^\\s<>"]+', request.message)
    if job_urls:
        url = job_urls[0].rstrip(".,!?;")
        instruction = request.message
        try:
            job = service.jobs.intake(url, instruction=instruction)
            execute_requested = any(
                phrase in instruction.lower()
                for phrase in (
                    "do this job",
                    "work on this job",
                    "start this job",
                    "execute this job",
                    "complete this job",
                    "take this job",
                )
            )
            execution = service.jobs.execute(job["job_id"]) if execute_requested else None
            current = execution or job
            return {
                "reply": (
                    f"JOB RECEIVED: {job['job_id']}\\n"
                    f"Platform: {job['platform']}\\n"
                    f"Title: {job['title']}\\n"
                    f"Status: {current['status']}\\n"
                    f"Blockers: {', '.join(current.get('blockers', [])) or 'none'}\\n"
                    "F.R.I.D.A.Y. has converted the job link into a tracked work package. "
                    "If the job uses an authenticated marketplace, final submission must use an authorized connector or session."
                ),
                "provider": None,
                "model": "deterministic-job-assistant",
                "attempts": 0,
                "execution": execution,
                "job": job,
            }
        except ValueError as exc:
            return {
                "reply": f"JOB LINK REJECTED: {exc}",
                "provider": None,
                "model": "deterministic-job-assistant",
                "attempts": 0,
                "execution": None,
            }

    mission_text = request.message.lower()
    audit_request = (
        "audit" in mission_text
        and (
            "only" in mission_text
            or "evidence" in mission_text
            or "executed" in mission_text
            or "reconcile" in mission_text
        )
    )
    if audit_request:
        execute_low_risk = any(
            phrase in mission_text
            for phrase in (
                "then execute",
                "execute every",
                "execute all",
                "execute the available",
                "execute every currently authorized",
            )
        )
        return _system_evidence_audit(execute_low_risk)

    current_status = service.status()
    packets = (current_status.get("autopilot") or {}).get("work_packets") or []
    compact = {
        "engine_version": current_status.get("engine_version"),
        "live_mode": current_status.get("live_mode"),
        "payment_verification_required": current_status.get("payment_verification_required"),
        "providers": current_status.get("providers"),
        "paddle_configured": current_status.get("paddle_configured"),
        "autopilot": {
            "enabled": (current_status.get("autopilot") or {}).get("enabled"),
            "running": (current_status.get("autopilot") or {}).get("running"),
            "cycles": (current_status.get("autopilot") or {}).get("cycles"),
            "last_error": (current_status.get("autopilot") or {}).get("last_error"),
            "work_packets": [
                {"opportunity_id": x.get("opportunity_id"), "strategy": x.get("strategy"),
                 "action": x.get("action"), "price_anchor": x.get("price_anchor"), "status": x.get("status")}
                for x in packets[:8]
            ],
        },
        "mission_target": current_status.get("mission_target"),
        "mission_engine": current_status.get("mission_engine"),
        "commercial_execution": current_status.get("commercial_execution"),
        "goal": current_status.get("goal"),
    }
    context = f"Current compact status: {compact}"
    execution_result = None
    mission_text = request.message.lower()
    execute_now = any(
        phrase in mission_text
        for phrase in (
            "run the revenue engine",
            "start the revenue engine",
            "execute the revenue mission",
            "execute now",
            "start now",
        )
    )
    if execute_now:
        try:
            execution_result = service.autopilot.run_once()
            packets_out = execution_result.get("work_packets") or []
            queue_out = execution_result.get("mission_queue") or []
            execution_summary = {
                "ran": execution_result.get("ran"),
                "cycle": execution_result.get("cycle"),
                "opportunities_ranked": execution_result.get("opportunities_ranked"),
                "work_packets": [
                    {
                        "opportunity_id": p.get("opportunity_id"),
                        "strategy": p.get("strategy"),
                        "action": p.get("action"),
                        "price_anchor": p.get("price_anchor"),
                        "status": p.get("status"),
                    }
                    for p in packets_out[:8]
                ],
                "queue_count": len(queue_out),
                "financial_status": execution_result.get("financial_status"),
            }
            context += f"\nFresh execution summary: {execution_summary}"
        except Exception as exc:
            execution_result = {
                "ran": False,
                "error": f"{type(exc).__name__}: {exc}",
            }
            context += f"\nExecution attempt failed: {type(exc).__name__}: {exc}"
    # Deterministic command mode: operational commands must remain usable even
    # when every external LLM is rate-limited or temporarily unavailable.
    command = request.message.strip().lower()
    if command == "/capacity":
        return {
            "reply": "F.R.I.D.A.Y. V3 capacity snapshot. Use the /capacity endpoint for the full structured result.",
            "provider": None,
            "model": "deterministic-capacity-mode",
            "attempts": 0,
            "execution": None,
        }
    if any(token in command for token in (
        "status", "progress", "mission status", "what can generate",
        "what is blocking", "what should happen next", "run all commercial",
        "start earning", "start the revenue engine", "execute now",
    )):
        try:
            if any(token in command for token in ("run all commercial", "start earning", "start the revenue engine", "execute now")):
                execution_result = service.autopilot.run_once()
            status_now = service.status()
            goal_now = status_now.get("goal") or {}
            auto_now = status_now.get("autopilot") or {}
            mission_now = status_now.get("mission_engine") or {}
            commercial_now = status_now.get("commercial_execution") or {}
            provider_now = status_now.get("providers") or []
            verified = goal_now.get("verified_progress", 0)
            target = goal_now.get("target")
            ready = sum(1 for x in (auto_now.get("work_packets") or []) if x.get("status") == "READY")
            blocked = sum(1 for x in (commercial_now.get("capabilities") or []) if x.get("execution_state") != "READY")
            return {
                "reply": (
                    "F.R.I.D.A.Y. V3 COMMAND MODE\n\n"
                    f"Verified revenue: {verified} {goal_now.get('currency', 'USD')}\n"
                    f"Target: {target} {goal_now.get('currency', 'USD') if target is not None else ''}\n"
                    f"Autopilot: {auto_now.get('running')} | cycles: {auto_now.get('cycles')}\n"
                    f"READY work packets: {ready}\n"
                    f"Commercial handlers: {commercial_now.get('capability_count', 0)}\n"
                    f"Capabilities with dependencies: {blocked}\n"
                    f"Providers configured: {sum(1 for p in provider_now if p.get('configured'))}; "
                    f"currently available: {sum(1 for p in provider_now if p.get('available'))}\n\n"
                    "REAL REVENUE RULE: only verified paid/completed transactions count. "
                    "Plans, offers, clicks and pipeline value do not count.\n\n"
                    "Next executable action: inspect READY work and execute the highest-value "
                    "authorized commercial path."
                ),
                "provider": None,
                "model": "deterministic-command-mode",
                "attempts": 0,
                "execution": execution_result,
            }
        except Exception as exc:
            return {
                "reply": f"Command execution attempted but failed: {type(exc).__name__}: {exc}",
                "provider": None,
                "model": "deterministic-command-mode",
                "attempts": 0,
                "execution": execution_result,
            }

    try:
        result = service.llm.complete(
            [
                {"role": "system", "content": system},
                {"role": "system", "content": context},
                {"role": "user", "content": request.message},
            ]
        )
    except RuntimeError as exc:
        # Keep the command surface usable during provider outages. A provider
        # failure is not a failure of the underlying mission/autopilot state.
        status_now = service.status()
        goal_now = status_now.get("goal") or {}
        mission_now = status_now.get("mission_engine") or {}
        auto_now = status_now.get("autopilot") or {}
        commercial_now = status_now.get("commercial_execution") or {}
        fallback = {
            "reply": (
                "F.R.I.D.A.Y. command mode is still online, but the AI response "
                f"providers are temporarily unavailable: {exc}.\n\n"
                f"Verified revenue: {goal_now.get('verified_progress', 0)} {goal_now.get('currency', 'USD')}\n"
                f"Target: {goal_now.get('target', 'unknown')} {goal_now.get('currency', 'USD')}\n"
                f"Autopilot running: {auto_now.get('running')} (cycles: {auto_now.get('cycles')})\n"
                f"Commercial capability handlers: {commercial_now.get('capability_count', 0)}\n"
                f"Mission queue items: {len((mission_now.get('queue') or []))}\n\n"
                "Use /dashboard, /status, /mission, /commercial, or /ledger while the "
                "provider layer recovers."
            ),
            "provider": None,
            "model": None,
            "attempts": 0,
            "execution": execution_result,
            "ai_error": str(exc),
        }
        return fallback
    return {
        "reply": result.text,
        "provider": result.provider,
        "model": result.model,
        "attempts": result.attempts,
        "execution": execution_result,
    }


@app.post("/payments/paddle/sync/{transaction_id}")
def sync_paddle_transaction(
    transaction_id: str,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        return service.sync_paddle_transaction(transaction_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/payments/paddle/webhook")
async def paddle_webhook(
    request: Request,
    paddle_signature: str | None = Header(default=None, alias="Paddle-Signature"),
):
    raw = await request.body()
    if not paddle_signature:
        raise HTTPException(status_code=400, detail="Paddle-Signature header is required")
    try:
        return service.handle_paddle_webhook(raw, paddle_signature)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@app.get("/commercial/capabilities")
def commercial_capabilities():
    return service.commercial.capability_status()


@app.get("/commercial/recent")
def commercial_recent(limit: int = 50):
    return service.commercial.recent(limit)


@app.get("/sales/status")
def sales_status():
    return service.sales.status()


@app.post("/sales/run")
def sales_run(
    limit: int = 8,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        return service.sales.run_cycle(limit=max(1, min(limit, service.sales.daily_cap)))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"sales cycle failed: {type(exc).__name__}: {exc}") from exc


class CommercialExecuteRequest(BaseModel):
    strategy: str = Field(min_length=1)
    opportunity_id: str = "manual"


class CommercialLaunchRequest(BaseModel):
    strategy: str = Field(min_length=1)
    opportunity_id: str = Field(min_length=1)
    amount: float = Field(gt=0)
    description: str = Field(min_length=1, max_length=2048)


@app.post("/commercial/launch")
def commercial_launch(
    request: CommercialLaunchRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    try:
        return service.commercial.launch_revenue_path(
            request.strategy,
            request.opportunity_id,
            request.amount,
            request.description,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"commercial launch failed: {type(exc).__name__}: {exc}") from exc


@app.post("/commercial/execute")
def commercial_execute(
    request: CommercialExecuteRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    return service.commercial.execute(request.strategy, request.opportunity_id)


@app.post("/commercial/run-all")
def commercial_run_all(
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    return service.commercial.run_all()


def _system_evidence_audit(execute_low_risk: bool = False) -> dict:
    execution = None
    if execute_low_risk:
        try:
            execution = service.autopilot.run_once()
        except Exception as exc:
            execution = {"ran": False, "error": f"{type(exc).__name__}: {exc}"}

    status = service.status()
    commercial = service.commercial.recent(100)
    ledger = service.ledger.recent(100)

    executed_actions = []
    external_ids = []
    checkout_urls = []

    for result in commercial:
        if result.get("status") != "EXECUTED":
            continue
        executed_actions.append({
            "task_id": result.get("task_id"),
            "strategy": result.get("strategy"),
            "action": result.get("action"),
            "created_at": result.get("created_at"),
            "evidence": result.get("evidence") or [],
        })
        for item in result.get("external_actions") or []:
            for key in ("product_id", "price_id", "transaction_id", "provider_id"):
                value = item.get(key)
                if value:
                    external_ids.append({
                        "provider": item.get("adapter"),
                        "type": key,
                        "id": value,
                    })

        checkout = (result.get("deliverable") or {}).get("checkout") or {}
        if checkout.get("checkout_url"):
            checkout_urls.append({
                "transaction_id": checkout.get("transaction_id"),
                "checkout_url": checkout.get("checkout_url"),
                "price_id": checkout.get("price_id"),
            })

    stored_leads = []
    supabase = service.discovery.supabase
    if supabase.configured():
        try:
            stored_leads = supabase.recent_rows(
                "leads",
                "id,name,company,email,status,created_at",
                100,
            )
        except ExternalAPIError as exc:
            stored_leads = []
            lead_read_error = str(exc)
        else:
            lead_read_error = None
    else:
        lead_read_error = "Supabase is not configured; stored leads cannot be verified."

    verified_payments = [
        {
            "event_id": item.get("event_id"),
            "opportunity_id": item.get("opportunity_id"),
            "amount": item.get("amount"),
            "currency": item.get("currency"),
            "status": item.get("status"),
            "created_at": item.get("created_at"),
            "evidence": item.get("evidence") or {},
        }
        for item in ledger
        if item.get("status") == "VERIFIED"
    ]

    verified_revenue = round(
        sum(float(item.get("amount", 0) or 0) for item in verified_payments),
        2,
    )

    blockers = []
    if lead_read_error:
        blockers.append(f"leads: {lead_read_error}")

    for capability in status.get("commercial_execution", {}).get("capabilities", []):
        for blocker in capability.get("blockers") or []:
            blockers.append(f"{capability.get('capability')}: {blocker}")

    unique_blockers = []
    seen = set()
    for blocker in blockers:
        if blocker not in seen:
            seen.add(blocker)
            unique_blockers.append(blocker)

    return {
        "source": "friday-v3-system-evidence",
        "executed_actions": executed_actions,
        "external_ids": external_ids,
        "real_leads_stored": stored_leads,
        "checkout_urls_created": checkout_urls,
        "customer_actions": [],
        "verified_payments": verified_payments,
        "verified_revenue": {
            "amount": verified_revenue,
            "currency": (status.get("goal") or {}).get("currency", "USD"),
        },
        "blockers": unique_blockers,
        "execution_attempt": execution,
        "rule": "Anything not present in system evidence is NOT EXECUTED.",
    }


@app.get("/system-check")
def system_check():
    status = service.status()
    providers = service.llm.router.status()
    commercial = status.get("commercial_execution") or {}
    auto = status.get("autopilot") or {}
    return {
        "ok": True,
        "engine": status.get("engine_version"),
        "live_mode": status.get("live_mode"),
        "payment_verification_required": status.get("payment_verification_required"),
        "autopilot": {"running": auto.get("running"), "cycles": auto.get("cycles"), "last_error": auto.get("last_error")},
        "providers": providers,
        "paddle": {"api_configured": service.paddle.api_configured(), "webhook_configured": service.paddle.webhook_configured(), "environment": os.getenv("PADDLE_ENV", "unknown")},
        "commercial": {"enabled": commercial.get("enabled"), "capability_count": commercial.get("capability_count"), "handlers_ready": sum(1 for x in commercial.get("capabilities", []) if x.get("handler_ready"))},
        "verified_revenue": (status.get("goal") or {}).get("verified_progress", 0),
    }


@app.get("/audit")
def audit():
    return _system_evidence_audit(False)


@app.post("/audit/run")
def audit_run(
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    return _system_evidence_audit(True)


class EmailSendRequest(BaseModel):
    recipient: str = Field(min_length=3, max_length=320)
    subject: str = Field(min_length=1, max_length=200)
    html: str = Field(min_length=1, max_length=20000)
    idempotency_key: str = Field(min_length=8, max_length=200)


class SalesRunRequest(BaseModel):
    limit: int = Field(default=5, ge=1, le=20)


@app.get("/email/status")
def email_status():
    return service.email_status()


@app.post("/email/send")
def email_send(
    request: EmailSendRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    return service.send_email(
        request.recipient,
        request.subject,
        request.html,
        request.idempotency_key,
    )


@app.get("/sales/status")
def sales_status():
    return service.sales.status()


@app.post("/sales/run")
def sales_run(
    request: SalesRunRequest | None = None,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    limit = 5 if request is None else request.limit
    return service.sales.run_cycle(limit=limit)


@app.get("/commercial/capabilities")
def commercial_capabilities():
    return service.commercial.capability_status()


@app.get("/commercial/recent")
def commercial_recent(limit: int = 50):
    return service.commercial.recent(limit)


class CommercialExecuteRequest(BaseModel):
    strategy: str = Field(min_length=1)
    opportunity_id: str = "manual"


@app.post("/commercial/execute")
def commercial_execute(
    request: CommercialExecuteRequest,
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    return service.commercial.execute(request.strategy, request.opportunity_id)


@app.post("/commercial/run-all")
def commercial_run_all(
    control_token: str | None = Header(default=None, alias="X-FRIDAY-CONTROL-TOKEN"),
):
    _require_control_token(control_token)
    return service.commercial.run_all()


@app.get("/ledger/recent")
def recent_ledger(limit: int = 50):
    return service.ledger.recent(max(1, min(limit, 200)))
