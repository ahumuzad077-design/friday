"""Strategy orchestration primitives for legitimate revenue generation."""
from .models import Goal, Opportunity

# Revenue paths F.R.I.D.A.Y. may actively pursue.
# Funding, grants and sponsorships are intentionally excluded from the autonomous
# commercial engine; they are not treated as revenue opportunities.
STRATEGIES = (
    "services", "sales", "lead_generation", "ecommerce", "digital_products",
    "affiliate", "enterprise", "market_analysis",
)


class AutonomousOrchestrator:
    def __init__(self, settings, ledger, providers):
        self.settings = settings
        self.ledger = ledger
        self.providers = providers

    def rank(self, opportunities: list[Opportunity]) -> list[Opportunity]:
        return sorted(
            opportunities, key=lambda item: item.score, reverse=True
        )[:self.settings.max_parallel]

    def build_portfolio(self, goal: Goal) -> list[Opportunity]:
        # Deterministic seeds make this layer testable. A later discovery layer can
        # add real opportunities, but the model itself can never create revenue.
        base = max(goal.target, 1.0)
        seeds = [
            ("services", "Find and qualify a legitimate service contract", base * 0.01, 0.12, 48, 0.01, 0.05),
            ("enterprise", "Identify a high-value enterprise contract", base * 0.15, 0.02, 240, 0.02, 0.10),
            ("digital_products", "Create and sell a legitimate digital product", base * 0.03, 0.08, 120, 0.01, 0.03),
            ("lead_generation", "Generate qualified commercial leads for a paid service", base * 0.02, 0.10, 72, 0.01, 0.02),
            ("ecommerce", "Validate a real product demand opportunity", base * 0.04, 0.04, 240, 0.03, 0.08),
        ]
        return [
            Opportunity(
                f"opp-{i}", s, d, v, p, h, estimated_cost=c, risk=r
            )
            for i, (s, d, v, p, h, c, r) in enumerate(seeds, 1)
        ]
