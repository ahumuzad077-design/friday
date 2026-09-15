"""Payment gateway adapters.

Paddle is the primary gateway for international digital/service sales. Revenue
is recorded only after a verified provider event. No payment is simulated.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.request
from dataclasses import dataclass


@dataclass
class PaymentResult:
    provider: str
    transaction_id: str
    status: str
    amount: float
    currency: str
    checkout_url: str | None = None
    invoice_number: str | None = None


class PaddleGateway:
    def __init__(self):
        self.api_key = os.getenv("PADDLE_API_KEY")
        self.base_url = os.getenv("PADDLE_API_BASE", "https://api.paddle.com")
        self.webhook_secret = os.getenv("PADDLE_WEBHOOK_SECRET")

    def configured(self) -> bool:
        return bool(self.api_key)

    def _request(self, method: str, path: str, payload=None):
        if not self.api_key:
            raise RuntimeError("PADDLE_API_KEY is not configured")
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.base_url.rstrip("/") + path,
            data=body,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method=method,
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))

    def create_checkout_transaction(self, items, custom_data=None, currency="USD") -> PaymentResult:
        """Create an automatic transaction. `items` must contain Paddle price IDs.

        Each item should be {price_id: ..., quantity: ...}. This intentionally
        does not accept arbitrary card data or attempt to charge a customer.
        """
        payload = {
            "items": items,
            "currency_code": currency.upper(),
            "collection_mode": "automatic",
            "custom_data": custom_data or {},
        }
        data = self._request("POST", "/transactions", payload).get("data", {})
        checkout = data.get("checkout") or {}
        return PaymentResult(
            provider="paddle",
            transaction_id=data.get("id", ""),
            status=data.get("status", "draft"),
            amount=float(data.get("details", {}).get("totals", {}).get("grand_total", "0")) / 100,
            currency=data.get("currency_code", currency).upper(),
            checkout_url=checkout.get("url"),
            invoice_number=data.get("invoice_number"),
        )

    def verify_webhook(self, raw_body: bytes, signature: str, tolerance_seconds: int = 300) -> bool:
        if not self.webhook_secret:
            raise RuntimeError("PADDLE_WEBHOOK_SECRET is not configured")
        parts = {}
        for item in signature.split(";"):
            if "=" in item:
                key, value = item.split("=", 1)
                parts[key] = value
        try:
            ts = int(parts["ts"])
            received = parts["h1"]
        except (KeyError, ValueError):
            return False
        if abs(time.time() - ts) > tolerance_seconds:
            return False
        signed = f"{ts}:".encode("utf-8") + raw_body
        expected = hmac.new(self.webhook_secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, received)

    def parse_paid_event(self, raw_body: bytes) -> PaymentResult | None:
        event = json.loads(raw_body.decode("utf-8"))
        if event.get("event_type") not in {"transaction.paid", "transaction.completed"}:
            return None
        data = event.get("data") or {}
        if data.get("status") not in {"paid", "completed"}:
            return None
        totals = data.get("details", {}).get("totals", {})
        amount = totals.get("grand_total") or data.get("amount") or "0"
        return PaymentResult(
            provider="paddle",
            transaction_id=data.get("id", ""),
            status="VERIFIED",
            amount=float(amount) / 100,
            currency=str(data.get("currency_code", "USD")).upper(),
            invoice_number=data.get("invoice_number"),
        )
