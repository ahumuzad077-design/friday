"""Payment gateway adapters.

Paddle is the primary gateway for international digital/service sales. Revenue
is recorded only after a verified provider event or a direct provider API
confirmation. No payment is simulated.
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
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Paddle network error: {exc.reason}") from exc

    @staticmethod
    def _transaction_result(data: dict, fallback_currency: str = "USD") -> PaymentResult:
        checkout = data.get("checkout") or {}
        totals = data.get("details", {}).get("totals", {})
        amount = totals.get("grand_total") or data.get("amount") or "0"
        return PaymentResult(
            provider="paddle",
            transaction_id=str(data.get("id", "")),
            status=str(data.get("status", "draft")).lower(),
            amount=float(amount) / 100,
            currency=str(data.get("currency_code", fallback_currency)).upper(),
            checkout_url=checkout.get("url"),
            invoice_number=data.get("invoice_number"),
        )

    def create_product(self, name: str, description: str, tax_category: str = "standard", custom_data: dict | None = None) -> dict:
        """Create a reusable Paddle catalog product."""
        payload = {
            "name": name[:200],
            "description": description[:2048],
            "type": "standard",
            "tax_category": tax_category,
            "custom_data": custom_data or {},
        }
        return self._request("POST", "/products", payload).get("data", {})

    def create_price(
        self,
        product_id: str,
        amount: float,
        currency: str = "USD",
        name: str = "One-time",
        description: str = "One-time commercial offer",
        billing_cycle: dict | None = None,
    ) -> dict:
        """Create a catalog price for a product."""
        if amount <= 0:
            raise ValueError("price amount must be greater than zero")
        payload = {
            "product_id": product_id,
            "description": description[:500],
            "name": name[:150],
            "unit_price": {
                "amount": str(int(round(amount * 100))),
                "currency_code": currency.upper(),
            },
            "billing_cycle": billing_cycle,
            "quantity": {"minimum": 1, "maximum": 100},
        }
        return self._request("POST", "/prices", payload).get("data", {})

    def create_sellable_offer(
        self,
        name: str,
        description: str,
        amount: float,
        currency: str = "USD",
        tax_category: str = "standard",
        recurring: bool = False,
    ) -> dict:
        """Create a Paddle product + price pair that can be used in a checkout."""
        product = self.create_product(
            name=name,
            description=description,
            tax_category=("saas" if recurring and tax_category == "standard" else tax_category),
        )
        billing_cycle = {"interval": "month", "frequency": 1} if recurring else None
        price = self.create_price(
            product_id=str(product["id"]),
            amount=amount,
            currency=currency,
            name=("Monthly" if recurring else "One-time"),
            description=description,
            billing_cycle=billing_cycle,
        )
        return {
            "product": product,
            "price": price,
            "sellable": True,
            "checkout_requirement": "Paddle checkout/default payment link must be configured to present a hosted checkout URL.",
        }

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
        return self._transaction_result(data, currency)

    def get_transaction(self, transaction_id: str) -> PaymentResult:
        """Fetch a transaction directly from Paddle for payment reconciliation.

        This is a fallback to webhooks. A transaction is only considered
        verified when Paddle reports its status as paid or completed.
        """
        if not transaction_id:
            raise ValueError("transaction_id is required")
        data = self._request("GET", f"/transactions/{transaction_id}").get("data", {})
        return self._transaction_result(data)

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
