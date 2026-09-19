import tempfile
import unittest
from types import SimpleNamespace

from friday_core.capabilities import CAPABILITIES
from friday_core.commercial_tasks import CommercialTaskEngine


class FakeAdapter:
    def configured(self):
        return False

    def health(self):
        return False


class FakeDiscovery:
    def __init__(self):
        self.tavily = FakeAdapter()
        self.apollo = FakeAdapter()
        self.supabase = FakeAdapter()
        self.browser = FakeAdapter()
        self.shopify = FakeAdapter()

    def status(self):
        return {
            "tavily_configured": False,
            "apollo_configured": False,
            "resend_configured": False,
            "autonomous_email_enabled": False,
            "supabase_configured": False,
            "browser_enabled": False,
            "shopify_configured": False,
        }


class FakePaddle:
    def configured(self):
        return False

    def api_configured(self):
        return False

    def webhook_configured(self):
        return False


class CommercialTaskCoverageTests(unittest.TestCase):
    def setUp(self):
        self.service = SimpleNamespace(
            discovery=FakeDiscovery(),
            paddle=FakePaddle(),
        )

    def test_every_registered_capability_has_a_handler(self):
        with tempfile.NamedTemporaryFile(suffix=".json") as f:
            engine = CommercialTaskEngine(self.service)
            engine.state_path = f.name
            rows = engine.capability_status()
            self.assertEqual(len(rows), len(CAPABILITIES))
            self.assertTrue(all(row["handler_ready"] for row in rows))

    def test_run_all_covers_every_capability(self):
        with tempfile.NamedTemporaryFile(suffix=".json") as f:
            engine = CommercialTaskEngine(self.service)
            engine.state_path = f.name
            result = engine.run_all("test")
            self.assertEqual(result["capability_count"], len(CAPABILITIES))
            self.assertEqual(
                {row["capability"] for row in result["results"]},
                {cap.name for cap in CAPABILITIES},
            )


if __name__ == "__main__":
    unittest.main()
