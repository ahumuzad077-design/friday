"""Live sales execution loop for F.R.I.D.A.Y. V3."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from urllib.parse import urlparse

from .integrations import ExternalAPIError, ResendMailer


class SalesExecutionEngine:
    """Discover prospects, prepare offers/checkouts, and send bounded outreach."""

    def __init__(self, service):
        self.service = service
        self.enabled = os.getenv("SALES_AUTO_OUTREACH", "false").strip().lower() in {"1", "true", "yes", "on"}
        self.daily_cap = max(0, int(os.getenv("SALES_OUTREACH_DAILY_CAP", "0")))
        self.offer_amount = max(1.0, float(os.getenv("SALES_DEFAULT_OFFER_USD", "5000")))
        self.state_path = os.getenv("SALES_STATE_PATH", "friday_sales_state.json")
        self.sent = {}
        self.results = []
        self._load()

    def _load(self):
        try:
            with open(self.state_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
            self.sent = dict(payload.get("sent", {}))
            self.results = list(payload.get("results", []))
        except (FileNotFoundError, ValueError, TypeError, json.JSONDecodeError):
            self.sent = {}
            self.results = []

        # Recover deduplication state from the durable cloud activity log so
        # Railway restarts/redeploys do not resend the same prospect outreach.
        try:
            rows = self.service.discovery.supabase.recent_activity("sales_outreach", 500)
            for row in rows:
                metadata = row.get("metadata") or {}
                outreach_id = metadata.get("outreach_id")
                if outreach_id and metadata.get("status") == "SENT":
                    created_at = str(metadata.get("created_at") or row.get("created_at") or "")
                    day = created_at[:10]
                    if day:
                        self.sent[outreach_id] = day
                    self.results.append(metadata)
        except Exception:
            pass

        if len(self.results) > 500:
            self.results = self.results[-500:]

    def _save(self):
        tmp = self.state_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump({"sent": self.sent, "results": self.results[-500:]}, handle, indent=2)
        os.replace(tmp, self.state_path)

    @staticmethod
    def _id(company, email):
        return hashlib.sha256("{}|{}".format(company, email).encode("utf-8")).hexdigest()[:20]

    @staticmethod
    def _today():
        return datetime.now(timezone.utc).date().isoformat()

    def _sent_today(self):
        return sum(value == self._today() for value in self.sent.values())

    @staticmethod
    def _business_email(candidate):
        email = str(candidate.email or "").strip().lower()
        if "@" not in email:
            return ""
        website = str(candidate.website or "").strip()
        if website:
            host = (urlparse(website).hostname or "").lower().replace("www.", "")
            domain = email.rsplit("@", 1)[-1]
            if host and "." in host and domain != host:
                return ""
        return email

    def _record(self, data):
        self.results.append(data)
        self._save()
        supabase = self.service.discovery.supabase
        if supabase.configured():
            try:
                supabase.insert_activity({
                    "event_type": "sales_outreach",
                    "actor": "friday-v3",
                    "message": "{}: {}".format(data["status"], data["company"]),
                    "metadata": data,
                })
            except ExternalAPIError:
                pass
        return data

    def run_cycle(self, limit=8):
        if not self.enabled:
            return {"enabled": False, "status": "BLOCKED", "reason": "SALES_AUTO_OUTREACH is disabled", "sent_today": self._sent_today(), "email_daily_cap": self.daily_cap, "outreach_daily_cap": None}
        # Outreach itself is not capped: F.R.I.D.A.Y. may continue discovering,
        # qualifying, preparing offers and creating checkout links. Email delivery
        # remains separately bounded by ResendMailer/Guard.
        candidates = self.service.discovery.discover(limit=max(1, limit))
        mailer = ResendMailer()
        results = []

        for candidate in candidates:
            recipient = self._business_email(candidate)
            company = str(candidate.company or "your business")
            outreach_id = self._id(company, recipient or candidate.source_url or candidate.website)

            if not recipient:
                results.append(self._record({
                    "outreach_id": outreach_id,
                    "status": "BLOCKED",
                    "company": company,
                    "recipient": "",
                    "offer_amount": self.offer_amount,
                    "checkout_url": None,
                    "provider_id": None,
                    "blockers": ["No matching organization-domain email was available."],
                    "evidence": [{"source": candidate.source, "source_url": candidate.source_url}],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }))
                continue

            if self.sent.get(outreach_id) == self._today():
                continue

            blockers = []
            evidence = []
            checkout_url = None
            provider_id = None
            status = "PREPARED"

            try:
                offer = self.service.paddle.create_sellable_offer(
                    name="F.R.I.D.A.Y. AI Customer Automation Setup",
                    description="Fixed-scope AI customer-service, lead capture and follow-up setup for a business.",
                    amount=self.offer_amount,
                    currency="USD",
                )
                price_id = str((offer.get("price") or {}).get("id") or "")
                evidence.append({"type": "paddle_catalog", "product_id": (offer.get("product") or {}).get("id"), "price_id": price_id})
                if price_id:
                    checkout = self.service.paddle.create_checkout_transaction(
                        [{"price_id": price_id, "quantity": 1}],
                        custom_data={"friday_outreach_id": outreach_id, "opportunity_id": "lead:" + outreach_id},
                        currency="USD",
                    )
                    checkout_url = checkout.checkout_url
                    evidence.append({"type": "paddle_checkout", "transaction_id": checkout.transaction_id, "checkout_url": checkout_url})
                    status = "CHECKOUT_READY"
                else:
                    blockers.append("Paddle did not return a price ID.")
            except Exception as exc:
                blockers.append("{}: {}".format(type(exc).__name__, exc))

            if checkout_url:
                subject = "A practical AI customer-response setup for {}".format(company)
                html = (
                    "<p>Hello {},</p>".format(candidate.name or "there")
                    + "<p>I am reaching out because {} may benefit from a fixed-scope AI customer-service and lead follow-up setup.</p>".format(company)
                    + "<p>The package is designed to improve response speed, FAQ handling, lead capture and follow-up.</p>"
                    + "<p><strong>Fixed price: ${:,.0f} USD</strong></p>".format(self.offer_amount)
                    + "<p><a href=\"{}\">View the offer and checkout</a></p>".format(checkout_url)
                    + "<p>This is a direct business outreach message. If it is not relevant, reply and I will not contact you again.</p>"
                )
                try:
                    sent = mailer.send(recipient=recipient, subject=subject, html=html, idempotency_key=outreach_id)
                except Exception as exc:
                    sent = {"sent": False, "reason": "{}: {}".format(type(exc).__name__, exc)}
                if sent.get("sent"):
                    provider_id = sent.get("provider_id")
                    self.sent[outreach_id] = self._today()
                    status = "SENT"
                    evidence.append({"type": "resend", "provider_id": provider_id})
                else:
                    blockers.append(str(sent.get("reason") or "email was not sent"))
            else:
                blockers.append("No checkout URL was available, so no payment email was sent.")

            results.append(self._record({
                "outreach_id": outreach_id,
                "status": status,
                "company": company,
                "recipient": recipient,
                "offer_amount": self.offer_amount,
                "checkout_url": checkout_url,
                "provider_id": provider_id,
                "blockers": blockers,
                "evidence": evidence,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }))

        return {
            "enabled": True,
            "status": "EXECUTED",
            "sent_today": self._sent_today(),
            "email_daily_cap": self.daily_cap,
            "outreach_daily_cap": None,
            "offer_amount": self.offer_amount,
            "results": results,
            "revenue_rule": "Only Paddle paid/completed events become verified revenue.",
        }

    def status(self):
        return {
            "enabled": self.enabled,
            "email_daily_cap": self.daily_cap,
            "outreach_daily_cap": None,
            "sent_today": self._sent_today(),
            "offer_amount": self.offer_amount,
            "recent": self.results[-20:],
        }
