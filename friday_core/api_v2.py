"""FastAPI surface for F.R.I.D.A.Y. v3.

HTTP endpoints manage state, provide a human command/chat surface, and receive
verified payment webhooks or explicit Paddle transaction reconciliation calls.
Long-running work belongs in the worker.
"""
from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .service import FridayService

app = FastAPI(title="F.R.I.D.A.Y. v3", version="3.0")
service = FridayService()


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


@app.get("/health")
def health():
    return {"ok": True, "service": "friday-v3"}


@app.get("/status")
def status():
    return service.status()


@app.post("/goal")
def set_goal(request: GoalRequest):
    goal = service.set_goal(request.target, request.currency, request.deadline)
    return {
        "target": goal.target,
        "currency": goal.currency,
        "deadline": goal.deadline,
        "verified_progress": goal.verified_progress,
    }


@app.get("/opportunities")
def opportunities():
    try:
        return [o.__dict__ | {"score": o.score} for o in service.portfolio()]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/invoices")
def create_invoice(request: InvoiceRequest):
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
        "You are F.R.I.D.A.Y., a truthful commercial operations assistant. "
        "Answer the user's request using the current system context. Never invent "
        "revenue, payments, customers, actions, credentials, or completed work. "
        "Only call something paid when the verified revenue ledger says so. "
        "Do not request secrets in chat. Explain what you can do and give the next "
        "concrete command when an action requires a human-controlled integration."
    )
    context = f"Current status: {service.status()}"
    try:
        result = service.llm.complete(
            [
                {"role": "system", "content": system},
                {"role": "system", "content": context},
                {"role": "user", "content": request.message},
            ]
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "reply": result.text,
        "provider": result.provider,
        "model": result.model,
        "attempts": result.attempts,
    }


@app.post("/payments/paddle/sync/{transaction_id}")
def sync_paddle_transaction(transaction_id: str):
    """Verify one Paddle transaction directly through Paddle's API.

    This endpoint is useful when a webhook destination has not been created.
    """
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
