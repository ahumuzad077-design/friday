"""Strategy orchestration primitives for legitimate revenue generation."""
from .models import Goal, Opportunity

# Revenue paths F.R.I.D.A.Y. may actively pursue.
# Funding, grants and sponsorships are intentionally excluded from the autonomous
# commercial engine; they are not treated as revenue opportunities.
STRATEGIES = (
    "services", "mobile_digital_services", "sales", "lead_generation",
    "enterprise", "digital_products", "affiliate", "affiliate_marketing",
    "content_marketing", "faceless_content", "email_marketing", "ecommerce",
    "market_analysis",
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

    def build_portfolio(self, goal: Goal, discovered: list[Opportunity] | None = None) -> list[Opportunity]:
        # Deterministic seeds keep the base layer testable. Real opportunities from
        # discovery are appended and are still only opportunities until a customer
        # actually pays and the payment is verified.
        base = max(goal.target, 1.0)
        seeds = [
            ("enterprise", "Identify a high-value enterprise contract", base * 0.15, 0.02, 240, 0.02, 0.10, ["enterprise", "sales"]),
            ("services", "Package and sell a legitimate digital or automation service", base * 0.01, 0.12, 48, 0.01, 0.05, ["services", "sales"]),
            ("mobile_digital_services", "Offer a remotely deliverable website, AI automation, research or digital service", base * 0.015, 0.10, 48, 0.005, 0.05, ["mobile_digital_services", "sales"]),
            ("lead_generation", "Generate qualified commercial leads for a paid service", base * 0.02, 0.10, 72, 0.01, 0.02, ["lead_generation"]),
            ("digital_products", "Create and sell a legitimate digital product", base * 0.03, 0.08, 120, 0.01, 0.03, ["digital_products", "content_marketing"]),
            ("affiliate_marketing", "Test a compliant affiliate offer with real audience/problem fit", base * 0.02, 0.05, 168, 0.01, 0.08, ["affiliate_marketing", "content_marketing"]),
            ("content_marketing", "Build original research-led content that can acquire customers", base * 0.02, 0.06, 168, 0.005, 0.06, ["content_marketing"]),
            ("faceless_content", "Test an original faceless content channel around evidence-backed topics", base * 0.015, 0.04, 336, 0.01, 0.10, ["faceless_content", "content_marketing"]),
            ("email_marketing", "Prepare permission-based email campaigns for qualified prospects or customers", base * 0.025, 0.07, 96, 0.005, 0.05, ["email_marketing", "sales"]),
            ("ecommerce", "Validate a real product demand opportunity", base * 0.04, 0.04, 240, 0.03, 0.08, ["ecommerce", "market_analysis"]),
        ]
        base_opportunities = [
            Opportunity(
                f"opp-{i}", s, d, v, p, h, estimated_cost=c, risk=r,
                required_capabilities=caps,
            )
            for i, (s, d, v, p, h, c, r, caps) in enumerate(seeds, 1)
        ]
        return base_opportunities + list(discovered or [])
