"""Capability registry for broad, goal-driven F.R.I.D.A.Y. operation.

F.R.I.D.A.Y. is not an e-commerce bot. This registry describes classes of
legitimate work it can plan and route to adapters. A capability being listed
does not imply that an external integration is installed or that revenue was
created; execution must still produce verifiable evidence.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Capability:
    name: str
    category: str
    description: str
    revenue_relevance: str
    requires_external_adapter: bool = True


CAPABILITIES = (
    Capability("research", "intelligence", "Research markets, companies, products, regulations and opportunities.", "discover"),
    Capability("market_analysis", "intelligence", "Analyze demand, competition, pricing and commercial trends.", "discover"),
    Capability("sales", "commercial", "Develop offers, proposals, quotes and legitimate sales workflows.", "direct"),
    Capability("lead_generation", "commercial", "Find and qualify relevant business prospects without spam.", "direct"),
    Capability("services", "commercial", "Package and deliver digital, technical, creative or analytical services.", "direct"),
    Capability("enterprise", "commercial", "Pursue higher-value B2B contracts and recurring commercial relationships.", "direct"),
    Capability("digital_products", "commercial", "Create and sell software, templates, reports, educational products and other digital goods.", "direct"),
    Capability("ecommerce", "commercial", "Operate legitimate product-commerce workflows when economics justify them.", "direct"),
    Capability("affiliate", "commercial", "Manage compliant affiliate and referral opportunities.", "direct"),
    Capability("software", "production", "Design, build, test and maintain software and automation products.", "indirect"),
    Capability("content", "production", "Produce commercial content, documentation, media and marketing assets.", "indirect"),
    Capability("data", "production", "Transform, analyze and report on authorized datasets.", "indirect"),
    Capability("automation", "operations", "Automate repetitive business operations through approved integrations.", "indirect"),
    Capability("customer_operations", "operations", "Handle support, intake, qualification and customer workflows.", "direct"),
    Capability("invoicing", "finance", "Create invoices, payment links and reconciliation records.", "direct"),
    Capability("payment_verification", "finance", "Verify payment-provider evidence before recognizing revenue.", "control", False),
    Capability("portfolio_management", "strategy", "Compare opportunities and allocate execution attention by expected value, cost, speed and risk.", "control", False),
    Capability("business_building", "strategy", "Evaluate and build scalable businesses and assets rather than optimizing only for small transactions.", "strategic", False),
    Capability("planning", "strategy", "Break large financial goals into measurable milestones and executable work.", "control", False),
)


def capability_map() -> dict[str, Capability]:
    return {item.name: item for item in CAPABILITIES}
