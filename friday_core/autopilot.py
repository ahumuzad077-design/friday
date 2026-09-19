"""Autonomous commercial work loop for F.R.I.D.A.Y.

The loop performs real operational work without fabricating revenue: it refreshes
opportunities, builds actionable work packets, tracks execution state, and exposes
what needs to happen next. External side effects remain explicitly guarded.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
import os
import threading
from typing import Any


@dataclass
class WorkPacket:
    opportunity_id: str
    strategy: str
    description: str
    action: str
    deliverable: str
    price_anchor: float
    status: str = "READY"
    updated_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class AutonomousWorkLoop:
    """Continuously turns the ranked opportunity portfolio into executable work.

    It never records revenue by itself. Revenue is added only by the verified
    payment path in FridayService. This makes the target tracker auditable.
    """

    def __init__(self, service):
        self.service = service
        self.enabled = os.getenv("AUTOPILOT_ENABLED", "true").strip().lower() in {
            "1", "true", "yes", "on"
        }
        try:
            self.interval_seconds = max(30, int(os.getenv("AUTOPILOT_INTERVAL_SECONDS", "300")))
        except ValueError:
            self.interval_seconds = 300
        self.state_path = os.getenv("AUTOPILOT_STATE_PATH", "friday_autopilot.json")
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.cycles = 0
        self.last_cycle_at: str | None = None
        self.last_error: str | None = None
        self.work_packets: list[dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        try:
            with open(self.state_path, "r", encoding="utf-8") as handle:
                state = json.load(handle)
            self.cycles = int(state.get("cycles", 0))
            self.last_cycle_at = state.get("last_cycle_at")
            self.last_error = state.get("last_error")
            self.work_packets = list(state.get("work_packets", []))
        except (FileNotFoundError, ValueError, TypeError, json.JSONDecodeError):
            return

    def _save(self) -> None:
        tmp = f"{self.state_path}.tmp"
        state = {
            "cycles": self.cycles,
            "last_cycle_at": self.last_cycle_at,
            "last_error": self.last_error,
            "work_packets": self.work_packets,
        }
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump(state, handle, indent=2)
        os.replace(tmp, self.state_path)

    def run_once(self) -> dict[str, Any]:
        with self._lock:
            now = datetime.now(timezone.utc).isoformat()
            self.service.reconcile_goal()
            opportunities = self.service.portfolio()
            ranked = self.service.mission_engine.rank(opportunities)
            packets: list[dict[str, Any]] = []

            for opportunity in ranked:
                # Keep the first version deterministic and executable. AI can be
                # used later to enrich the packet, but the loop must work even when
                # every AI provider is rate-limited or unavailable.
                if opportunity.strategy == "services":
                    action = "PACKAGE_AND_OFFER"
                    deliverable = "A fixed-scope business service with a clear quote and acceptance criteria"
                elif opportunity.strategy == "enterprise":
                    action = "BUILD_ENTERPRISE_PROPOSAL"
                    deliverable = "A decision-ready enterprise proposal with scope, timeline, price, and terms"
                elif opportunity.strategy == "digital_products":
                    action = "BUILD_DIGITAL_PRODUCT"
                    deliverable = "A sellable digital asset plus checkout-ready sales copy"
                elif opportunity.strategy == "lead_generation":
                    action = "BUILD_LEAD_PIPELINE"
                    deliverable = "A qualified-lead workflow tied to a paid service offer"
                elif opportunity.strategy == "ecommerce":
                    action = "VALIDATE_PRODUCT_DEMAND"
                    deliverable = "A product validation brief with evidence requirements and unit economics"
                else:
                    action = "RESEARCH_AND_PACKAGE"
                    deliverable = "A commercial offer with evidence, pricing, and a next action"

                packet = WorkPacket(
                    opportunity_id=opportunity.id,
                    strategy=opportunity.strategy,
                    description=opportunity.description,
                    action=action,
                    deliverable=deliverable,
                    price_anchor=round(max(opportunity.expected_value, 1.0), 2),
                    updated_at=now,
                )
                packets.append(packet.to_dict())

            mission = self.service.mission_engine.snapshot(self.service.goal)
            for index, packet in enumerate(packets):
                packet["mission_target"] = None if mission is None else mission.target
                packet["mission_remaining"] = None if mission is None else mission.remaining
                packet["queue_priority"] = "high" if index < 3 else "normal"
            self.work_packets = packets

            commercial_results = []
            if os.getenv("COMMERCIAL_EXECUTION_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}:
                for opportunity in ranked[: self.service.settings.max_parallel]:
                    try:
                        commercial_results.append(
                            self.service.commercial.execute(opportunity.strategy, opportunity.id)
                        )
                    except Exception as exc:
                        commercial_results.append({
                            "opportunity_id": opportunity.id,
                            "strategy": opportunity.strategy,
                            "status": "BLOCKED",
                            "blockers": [f"{type(exc).__name__}: {exc}"],
                        })

            self.cycles += 1
            self.last_cycle_at = now
            self.last_error = None
            self._save()

            status = self.service.status()
            return {
                "ran": True,
                "cycle": self.cycles,
                "timestamp": now,
                "opportunities_ranked": len(ranked),
                "work_packets": packets,
                "financial_status": status.get("hourly_target") or status.get("goal"),
                "mission_queue": self.service.mission_engine.execution_queue(ranked, self.service.settings.max_parallel),
                "commercial_execution": commercial_results,
            }

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "interval_seconds": self.interval_seconds,
            "running": bool(self._thread and self._thread.is_alive()),
            "cycles": self.cycles,
            "last_cycle_at": self.last_cycle_at,
            "last_error": self.last_error,
            "work_packets": self.work_packets,
        }

    def start(self) -> None:
        if not self.enabled or (self._thread and self._thread.is_alive()):
            return

        def loop() -> None:
            # Execute immediately on boot, then continue on the fixed interval.
            while not self._stop.is_set():
                try:
                    self.run_once()
                except Exception as exc:  # keep the service alive on one bad cycle
                    with self._lock:
                        self.last_error = f"{type(exc).__name__}: {exc}"
                        self._save()
                self._stop.wait(self.interval_seconds)

        self._thread = threading.Thread(target=loop, name="friday-autopilot", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
