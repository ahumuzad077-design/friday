"""FastAPI surface for the F.R.I.D.A.Y. v2 service.

Long-running agent work belongs in a worker; HTTP endpoints create/read state and
receive payment webhooks.
"""
from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .service import FridayService

app = FastAPI(title="F.R.I.D.A.Y. v2", version="2.0")
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


@app.get("/health")
def health():
    return {"ok": True, "service": "friday-v2"}


@app.get("/status")
def status():
    return service.status()


@app.post("/goal")
def set_goal(request: GoalRequest):
    goal = service.set_goal(request.target, request.currency, request.deadline)
    return {"target": goal.target, "currency": goal.currency, "deadline": goal.deadline, "verified_progress": goal.verified_progress}


@app.get("/opportunities")
def opportunities():
    try:
        return [o.__dict__ | {"score": o.score} for o in service.portfolio()]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/invoices")
def create_invoice(request: InvoiceRequest):
    return service.create_invoice(request.opportunity_id, request.description, request.amount, request.currency, request.customer_ref)


@app.post("/payments/paddle/webhook")
async def paddle_webhook(request: Request, paddle_signature: str | None = Header(default=None, alias="Paddle-Signature")):
    raw = await request.body()
    if not paddle_signature:
        raise HTTPException(status_code=400, detail="Paddle-Signature header is required")
    try:
        return service.handle_paddle_webhook(raw, paddle_signature)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@app.get("/ledger/recent")
def recent_ledger(limit: int = 50):
    return service.ledger.recent(max(1, min(limit, 200)))
