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
import urllib.error
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
        self.api_version = os.getenv("PADDLE_API_VERSION", "1")

    def api_configured(self) -> bool:
        return bool(self.api_key)

    def webhook_configured(self) -> bool:
        return bool(self.webhook_secret)

    def configured(self) -> bool:
        return self.api_configured() and self.webhook_configured()

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
                "Paddle-Version": self.api_version,
            },
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Paddle API error {exc.code}: {detail[:500]}") from exc

    def create_checkout_transaction(self, items, custom_data=None, currency="USD") -> PaymentResult:
        """Create an automatic transaction using Paddle price IDs."""
        if not items:
            raise ValueError("at least one Paddle price item is required")
        for item in items:
            if not item.get("price_id"):
                raise ValueError("each Paddle item requires price_id")
            if int(item.get("quantity", 1)) < 1:
                raise ValueError("Paddle quantity must be at least 1")
        payload = {
            "items": items,
            "currency_code": currency.upper(),
            "collection_mode": "automatic",
            "custom_data": custom_data or {},
        }
        data = self._request("POST", "/transactions", payload).get("data", {})
        checkout = data.get("checkout") or {}
        totals = data.get("details", {}).get("totals", {})
        return PaymentResult(
            provider="paddle",
            transaction_id=data.get("id", ""),
            status=data.get("status", "draft"),
            amount=float(totals.get("grand_total", "0")) / 100,
            currency=str(data.get("currency_code", currency)).upper(),
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
                parts[key.strip()] = value.strip()
        try:
            ts = int(parts["ts"])
            received = parts["h1"]
        except (KeyError, ValueError):
            return False
        if not received or abs(time.time() - ts) > tolerance_seconds:
            return False
        signed = f"{ts}:".encode("utf-8") + raw_body
        expected = hmac.new(
            self.webhook_secret.encode("utf-8"), signed, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, received)

    def parse_paid_event(self, raw_body: bytes) -> PaymentResult | None:
        try:
            event = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("invalid Paddle webhook JSON") from exc

        if event.get("event_type") not in {"transaction.paid", "transaction.completed"}:
            return None
        data = event.get("data") or {}
        transaction_id = str(data.get("id", ""))
        status = str(data.get("status", "")).lower()
        if not transaction_id or status not in {"paid", "completed"}:
            return None
        totals = data.get("details", {}).get("totals", {})
        amount = totals.get("grand_total") or data.get("amount") or "0"
        parsed_amount = float(amount) / 100
        if parsed_amount <= 0:
            return None
        return PaymentResult(
            provider="paddle",
            transaction_id=transaction_id,
            status="VERIFIED",
            amount=parsed_amount,
            currency=str(data.get("currency_code", "USD")).upper(),
            invoice_number=data.get("invoice_number"),
        )
