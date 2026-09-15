"""Domain objects. Financial progress is based on verified events only."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class Goal:
    target: float
    currency: str = "USD"
    deadline: str | None = None
    id: str = ""
    verified_progress: float = 0.0


@dataclass
class Opportunity:
    id: str
    strategy: str
    description: str
    expected_value: float
    probability: float
    time_to_cash_hours: float
    estimated_cost: float = 0.0
    risk: float = 0.0
    required_capabilities: list[str] = field(default_factory=list)
    status: str = "PLANNED"
    evidence_required: bool = True

    @property
    def score(self) -> float:
        value = self.expected_value * max(0.0, min(1.0, self.probability))
        speed = 1.0 / max(1.0, self.time_to_cash_hours / 24.0)
        return (value - self.estimated_cost) * speed * max(0.0, 1.0 - self.risk)


@dataclass
class RevenueEvent:
    event_id: str
    opportunity_id: str
    amount: float
    currency: str
    status: str = "PENDING"
    evidence: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
