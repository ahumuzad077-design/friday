import hashlib
import hmac
import json
import os
import tempfile
import time
import unittest

from friday_core.ledger import RevenueLedger
from friday_core.models import RevenueEvent
from friday_core.providers import ProviderRouter
from friday_core.payments import PaddleGateway


class V2Tests(unittest.TestCase):
    def test_only_verified_events_count(self):
        with tempfile.NamedTemporaryFile(suffix=".sqlite3") as f:
            ledger = RevenueLedger(f.name)
            ledger.record(RevenueEvent("a", "opp", 100, "USD", "PENDING", {}))
            self.assertEqual(ledger.verified_total("USD"), 0)
            ledger.record(RevenueEvent("b", "opp", 25, "USD", "VERIFIED", {"provider": "test"}))
            self.assertEqual(ledger.verified_total("USD"), 25)

    def test_paddle_signature_algorithm(self):
        secret = "test-secret"
        body = json.dumps({"event_type": "transaction.paid", "data": {"id": "txn_test", "status": "paid", "currency_code": "USD", "details": {"totals": {"grand_total": "1250"}}}}).encode()
        ts = int(time.time())
        signature = hmac.new(secret.encode(), f"{ts}:".encode() + body, hashlib.sha256).hexdigest()
        old = os.environ.get("PADDLE_WEBHOOK_SECRET")
        os.environ["PADDLE_WEBHOOK_SECRET"] = secret
        try:
            self.assertTrue(PaddleGateway().verify_webhook(body, f"ts={ts};h1={signature}"))
        finally:
            if old is None:
                os.environ.pop("PADDLE_WEBHOOK_SECRET", None)
            else:
                os.environ["PADDLE_WEBHOOK_SECRET"] = old

    def test_openrouter_is_first_when_configured(self):
        old = os.environ.get("OPENROUTER_API_KEY")
        os.environ["OPENROUTER_API_KEY"] = "test"
        try:
            self.assertEqual(ProviderRouter().ordered_available()[0].name, "openrouter")
        finally:
            if old is None:
                os.environ.pop("OPENROUTER_API_KEY", None)
            else:
                os.environ["OPENROUTER_API_KEY"] = old


if __name__ == "__main__":
    unittest.main()
