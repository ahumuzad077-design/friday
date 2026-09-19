"""FastAPI surface for F.R.I.D.A.Y. v3.

HTTP endpoints manage state, provide a human command/chat surface, and receive
verified payment webhooks or explicit Paddle transaction reconciliation calls.
Long-running commercial work runs in the background worker loop.
"""
from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException, Request
import os
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
    evidence: dict = Field(default_factory=dict)


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
        return revenue_pipeline.mark_payment_verified(opportunity_id, request.evidence)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="pipeline opportunity not found") from exc


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
        "When an action is not available, do not pretend it is: state the exact blocker and the "
        "smallest human configuration needed to unlock it, then continue with every other action "
        "that is actually executable. Distinguish READY, BLOCKED, NEEDS_HUMAN_ACTION, EXECUTED, "
        "and VERIFIED. A revenue target is an operating goal, never evidence that revenue exists. "
        "Do not promise that a target will be reached. Optimize for real customer acquisition, "
        "offer creation, checkout creation, payment verification, and delivery using legitimate "
        "integrations and keep an evidence trail for each step."
    )
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
    try:
        result = service.llm.complete(
            [
                {"role": "system", "content": system},
                {"role": "system", "content": context},
                {"role": "user", "content": request.message},
            ]
        )
    except RuntimeError as exc:
        # Do not hide a successfully attempted commercial cycle just because the
        # conversational provider is temporarily unavailable.
        fallback = {
            "reply": (
                "The requested revenue cycle was attempted, but the AI response layer "
                f"is currently unavailable: {exc}. "
                "Use /dashboard or /status to inspect the execution state."
            ),
            "provider": None,
            "model": None,
            "attempts": 0,
            "execution": execution_result,
            "ai_error": str(exc),
        }
        if execution_result is not None:
            return fallback
        raise HTTPException(status_code=503, detail=str(exc)) from exc
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


@app.get("/ledger/recent")
def recent_ledger(limit: int = 50):
    return service.ledger.recent(max(1, min(limit, 200)))
