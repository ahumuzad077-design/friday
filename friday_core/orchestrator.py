"""Strategy orchestration primitives for legitimate revenue generation."""

from .models import Goal, Opportunity

# Commercial paths derived from the supplied video lessons. They are opportunity
# classes, not promises of revenue. Grants/sponsorships and speculative trading
# remain outside the autonomous commercial loop.
STRATEGIES = (
    "enterprise",
    "services",
    "mobile_digital_services",
    "ai_automation_services",
    "lead_generation",
    "sales",
    "digital_products",
    "micro_niche_apps",
    "recurring_saas",
    "productized_services",
    "affiliate",
    "affiliate_marketing",
    "content_marketing",
    "faceless_content",
    "email_marketing",
    "ecommerce",
    "market_analysis",
)


class AutonomousOrchestrator:
    def __init__(self, settings, ledger, providers):
        self.settings = settings
        self.ledger = ledger
        self.providers = providers

    def rank(self, opportunities: list[Opportunity]) -> list[Opportunity]:
        return sorted(opportunities, key=lambda item: item.score, reverse=True)[: self.settings.max_parallel]

    def build_portfolio(self, goal: Goal, discovered: list[Opportunity] | None = None) -> list[Opportunity]:
        base = max(goal.target, 1.0)
        seeds = [
            (
                "enterprise", "Identify a high-value enterprise contract",
                base * 0.15, 0.02, 240, 0.02, 0.10, ["enterprise", "sales"],
            ),
            (
                "ai_automation_services", "Find a repetitive business process that can be improved with AI automation",
                base * 0.03, 0.10, 72, 0.01, 0.05, ["automation", "customer_operations", "sales"],
            ),
            (
                "productized_services", "Package a repeatable service around a specific customer outcome",
                base * 0.025, 0.10, 72, 0.005, 0.05, ["services", "sales"],
            ),
            (
                "mobile_digital_services", "Offer a remotely deliverable website, AI automation, research or digital service",
                base * 0.015, 0.10, 48, 0.005, 0.05, ["mobile_digital_services", "sales"],
            ),
            (
                "lead_generation", "Generate qualified commercial leads for a paid service",
                base * 0.02, 0.10, 72, 0.01, 0.02, ["lead_generation"],
            ),
            ("digital_products", "Build a specific digital product around a validated customer pain point", base * 0.03, 0.08, 120, 0.01, 0.03, ["digital_products", "content_marketing"]),
            ("micro_niche_apps", "Prototype a narrow AI app that solves a validated recurring problem", base * 0.05, 0.05, 168, 0.02, 0.06, ["software", "digital_products"]),
            ("recurring_saas", "Test a subscription product when recurring customer value is demonstrated", base * 0.08, 0.03, 336, 0.03, 0.08, ["software", "digital_products", "customer_operations"]),
            ("affiliate_marketing", "Test a compliant affiliate offer with real audience/problem fit", base * 0.02, 0.05, 168, 0.01, 0.08, ["affiliate_marketing", "content_marketing"]),
            ("content_marketing", "Build original research-led content that can acquire customers", base * 0.02, 0.06, 168, 0.005, 0.06, ["content_marketing"]),
            ("faceless_content", "Test original faceless content around evidence-backed topics", base * 0.015, 0.04, 336, 0.01, 0.10, ["faceless_content", "content_marketing"]),
            ("email_marketing", "Prepare permission-based campaigns for qualified prospects or customers", base * 0.025, 0.07, 96, 0.005, 0.05, ["email_marketing", "sales"]),
            ("ecommerce", "Validate real product demand and unit economics before creating listings", base * 0.04, 0.04, 240, 0.03, 0.08, ["ecommerce", "market_analysis"]),
        ]
        return [
            Opportunity(f"opp-{i}", strategy, description, value, probability, hours,
                        estimated_cost=cost, risk=risk, required_capabilities=caps)
            for i, (strategy, description, value, probability, hours, cost, risk, caps)
            in enumerate(seeds, 1)
        ] + list(discovered or [])
