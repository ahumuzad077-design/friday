"""Mission-planning engine for F.R.I.D.A.Y. V4.

V4 adds a more aggressive commercial prioritization layer without treating
targets as evidence of revenue. It ranks opportunities by expected cash value,
probability, time-to-cash, and execution readiness, then exposes an auditable
mission queue.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timezone
from typing import Any


@dataclass(frozen=True)
class MissionSnapshot:
    target: float
    currency: str
    deadline: str | None
    verified_revenue: float
    remaining: float
    hours_remaining: float | None
    required_hourly_rate: float | None
    target_is_operating_goal_only: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "target": self.target,
            "currency": self.currency,
            "deadline": self.deadline,
            "verified_revenue": self.verified_revenue,
            "remaining": self.remaining,
            "hours_remaining": self.hours_remaining,
            "required_hourly_rate": self.required_hourly_rate,
            "target_is_operating_goal_only": self.target_is_operating_goal_only,
        }


class V4MissionEngine:
    def __init__(self, settings, ledger):
        self.settings = settings
        self.ledger = ledger

    @staticmethod
    def _deadline_hours(deadline: str | None) -> float | None:
        if not deadline:
            return None
        try:
            date = datetime.fromisoformat(deadline).date()
        except ValueError:
            return None
        end = datetime.combine(date, time(23, 59, 59), tzinfo=timezone.utc)
        return max(0.0, (end - datetime.now(timezone.utc)).total_seconds() / 3600.0)

    def snapshot(self, goal=None) -> MissionSnapshot | None:
        if goal is None:
            return None
        verified = self.ledger.verified_total(goal.currency)
        remaining = max(goal.target - verified, 0.0)
        hours = self._deadline_hours(goal.deadline)
        rate = None
        if hours and hours > 0:
            rate = remaining / hours
        return MissionSnapshot(
            target=goal.target,
            currency=goal.currency,
            deadline=goal.deadline,
            verified_revenue=round(verified, 2),
            remaining=round(remaining, 2),
            hours_remaining=None if hours is None else round(hours, 2),
            required_hourly_rate=None if rate is None else round(rate, 2),
        )

    def rank(self, opportunities: list) -> list:
        def key(opportunity):
            time_factor = max(float(opportunity.time_to_cash_hours or 1.0), 1.0)
            expected = max(float(opportunity.expected_value or 0.0), 0.0)
            probability = max(min(float(opportunity.probability or 0.0), 1.0), 0.0)
            readiness = 1.15 if str(opportunity.status).upper() in {"DISCOVERED", "READY"} else 1.0
            discovery_bonus = 1.05 if str(opportunity.id).startswith("discovered-") else 1.0
            return (expected * max(probability, 0.01) * readiness * discovery_bonus) / time_factor

        return sorted(opportunities, key=key, reverse=True)

    def execution_queue(self, opportunities: list, limit: int) -> list[dict[str, Any]]:
        mission = self.snapshot()
        queue = []
        for index, opportunity in enumerate(self.rank(opportunities)[: max(1, limit)], start=1):
            expected = round(max(float(opportunity.expected_value), 0.0), 2)
            probability = round(max(min(float(opportunity.probability), 1.0), 0.0), 4)
            queue.append(
                {
                    "queue_position": index,
                    "opportunity_id": opportunity.id,
                    "strategy": opportunity.strategy,
                    "expected_value": expected,
                    "probability": probability,
                    "time_to_cash_hours": float(opportunity.time_to_cash_hours),
                    "mission_priority": "high" if index <= 3 else "normal",
                    "execution_status": "READY",
                    "revenue_counting_rule": "Only independently verified payments count.",
                }
            )
        return queue

    def status(self, goal=None, opportunities: list | None = None, limit: int = 10) -> dict[str, Any]:
        mission = self.snapshot(goal)
        result = {
            "engine": "F.R.I.D.A.Y. V4",
            "mission": None if mission is None else mission.to_dict(),
            "queue": [] if opportunities is None else self.execution_queue(opportunities, limit),
        }
        return result
