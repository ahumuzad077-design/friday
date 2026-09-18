import os
import tempfile
import unittest

from friday_core.config import Settings
from friday_core.ledger import RevenueLedger
from friday_core.models import Goal, Opportunity
from friday_core.mission_engine import MissionEngine
from friday_core.orchestrator import AutonomousOrchestrator
from friday_core.providers import ProviderRouter


class EnhancedMissionEngineTests(unittest.TestCase):
    def test_snapshot_uses_only_verified_revenue(self):
        with tempfile.NamedTemporaryFile(suffix=".sqlite3") as f:
            ledger = RevenueLedger(f.name)
            engine = MissionEngine(Settings(ledger_path=f.name), ledger)
            snapshot = engine.snapshot(Goal(1_000_000, "USD", "2099-01-01"))
            self.assertEqual(snapshot.verified_revenue, 0.0)
            self.assertEqual(snapshot.remaining, 1_000_000.0)
            self.assertGreater(snapshot.required_hourly_rate, 0.0)

    def test_ranking_prefers_value_per_time(self):
        with tempfile.NamedTemporaryFile(suffix=".sqlite3") as f:
            ledger = RevenueLedger(f.name)
            engine = MissionEngine(Settings(ledger_path=f.name), ledger)
            slow = Opportunity("slow", "enterprise", "slow", 100_000, 0.10, 240)
            fast = Opportunity("fast", "services", "fast", 20_000, 0.75, 24)
            self.assertEqual(engine.rank([slow, fast])[0].id, "fast")

    def test_nvidia_default_is_current_ultra(self):
        old_key = os.environ.get("NVIDIA_API_KEY")
        old_model = os.environ.get("NVIDIA_MODEL")
        os.environ["NVIDIA_API_KEY"] = "test"
        os.environ.pop("NVIDIA_MODEL", None)
        try:
            provider = next(item for item in ProviderRouter().providers if item.name == "nvidia")
            self.assertEqual(provider.default_model, "nvidia/nemotron-3-ultra-550b-a55b")
        finally:
            if old_key is None:
                os.environ.pop("NVIDIA_API_KEY", None)
            else:
                os.environ["NVIDIA_API_KEY"] = old_key
            if old_model is None:
                os.environ.pop("NVIDIA_MODEL", None)
            else:
                os.environ["NVIDIA_MODEL"] = old_model

    def test_video_derived_strategies_are_in_portfolio(self):
        with tempfile.NamedTemporaryFile(suffix=".sqlite3") as f:
            ledger = RevenueLedger(f.name)
            orchestrator = AutonomousOrchestrator(Settings(ledger_path=f.name), ledger, ProviderRouter())
            strategies = {item.strategy for item in orchestrator.build_portfolio(Goal(100_000))}
            for strategy in {
                "mobile_digital_services",
                "affiliate_marketing",
                "content_marketing",
                "faceless_content",
                "email_marketing",
            }:
                self.assertIn(strategy, strategies)


if __name__ == "__main__":
    unittest.main()
