import tempfile
import unittest
from friday_core.config import Settings
from friday_core.ledger import RevenueLedger
from friday_core.models import Goal, Opportunity, RevenueEvent
from friday_core.orchestrator import AutonomousOrchestrator
from friday_core.providers import ProviderRouter


class CoreTests(unittest.TestCase):
    def test_unverified_revenue_is_zero(self):
        with tempfile.NamedTemporaryFile(suffix=".sqlite3") as f:
            ledger = RevenueLedger(f.name)
            ledger.record(RevenueEvent("e1", "o1", 1000, "USD", "PENDING"))
            self.assertEqual(ledger.verified_total("USD"), 0.0)

    def test_verified_revenue_counts(self):
        with tempfile.NamedTemporaryFile(suffix=".sqlite3") as f:
            ledger = RevenueLedger(f.name)
            ledger.record(RevenueEvent("e1", "o1", 1000, "USD", "VERIFIED"))
            self.assertEqual(ledger.verified_total("USD"), 1000.0)

    def test_portfolio_scales_with_goal(self):
        with tempfile.NamedTemporaryFile(suffix=".sqlite3") as f:
            settings = Settings(ledger_path=f.name)
            ledger = RevenueLedger(f.name)
            router = ProviderRouter()
            engine = AutonomousOrchestrator(settings, ledger, router)
            small = engine.build_portfolio(Goal(1000))
            large = engine.build_portfolio(Goal(1000000))
            self.assertGreater(max(x.expected_value for x in large), max(x.expected_value for x in small))


if __name__ == "__main__":
    unittest.main()
