"""Strategy orchestration primitives."""
from .models import Goal, Opportunity


STRATEGIES = (
    "services",
    "sales",
    "lead_generation",
    "ecommerce",
    "digital_products",
    "affiliate",
    "sponsorships",
    "grants",
    "enterprise",
    "market_analysis",
)


class AutonomousOrchestrator:
    def __init__(self, settings, ledger, providers):
        self.settings = settings
        self.ledger = ledger
        self.providers = providers

    def rank(self, opportunities: list[Opportunity]) -> list[Opportunity]:
        return sorted(opportunities, key=lambda item: item.score, reverse=True)[: self.settings.max_parallel]

    def build_portfolio(self, goal: Goal) -> list[Opportunity]:
        # The LLM can later replace this seed generator. Keeping deterministic seeds
        # makes the system testable and prevents a model from inventing revenue.
        base = max(goal.target, 1.0)
        seeds = [
            ("services", "Find and qualify a legitimate service contract", base * 0.01, 0.12, 48, 0.05),
            ("enterprise", "Identify a high-value enterprise contract", base * 0.15, 0.02, 240, 0.10),
            ("digital_products", "Create and sell a legitimate digital product", base * 0.03, 0.08, 120, 0.03),
            ("lead_generation", "Generate qualified commercial leads for a paid service", base * 0.02, 0.10, 72, 0.02),
            ("sponsorships", "Identify aligned sponsorship opportunities", base * 0.20, 0.01, 720, 0.02),
            ("grants", "Identify legitimate grant/funding opportunities", base * 0.25, 0.005, 1440, 0.01),
            ("ecommerce", "Validate a real product demand opportunity", base * 0.04, 0.04, 240, 0.08),
        ]
        return [Opportunity(f"opp-{i}", s, d, v, p, h, estimated_cost=c, risk=r) for i, (s,d,v,p,h,r) in enumerate(seeds, 1)]
