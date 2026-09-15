# =========================================================================
# F.R.I.D.A.Y. - AUTONOMOUS ENGINE & PLANNER
# =========================================================================
# IMPORTANT: This module never invents revenue. Financial progress must come
# from a verified ledger/event source, not from task completion or randomness.

import os
import json
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from langchain_groq import ChatGroq
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GOAL_FILE = os.getenv("GOAL_FILE", "goal_state.json")
THINK_INTERVAL = int(os.getenv("THINK_INTERVAL", 300))

class GoalState:
    def __init__(self):
        self.target_amount = 0.0
        self.currency = "USD"
        self.deadline = None
        self.current_progress = 0.0
        self.plan = []
        self.active = False
        self.load()

    def load(self):
        try:
            with open(GOAL_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.__dict__.update(data)
        except FileNotFoundError:
            pass
        except Exception as exc:
            logger.error("Goal state load error: %s", exc)

    def save(self):
        tmp = f"{GOAL_FILE}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.__dict__, f, indent=2)
        os.replace(tmp, GOAL_FILE)

    def set_new_goal(self, target: float, deadline_days: int, currency: str = "USD"):
        if target <= 0:
            raise ValueError("target must be greater than zero")
        if deadline_days < 0:
            raise ValueError("deadline_days cannot be negative")

        self.target_amount = float(target)
        self.currency = currency.upper()
        self.deadline = (datetime.now() + timedelta(days=deadline_days)).isoformat()
        self.current_progress = 0.0
        self.plan = []
        self.active = True
        self.save()
        return {
            "target": self.target_amount,
            "currency": self.currency,
            "deadline": self.deadline,
        }

    def set_verified_progress(self, amount: float):
        """Set progress only from a trusted verification/ledger layer."""
        if amount < 0:
            raise ValueError("verified progress cannot be negative")
        self.current_progress = float(amount)
        self.save()

    def get_status_dict(self):
        return {
            "active": self.active,
            "target": self.target_amount,
            "currency": self.currency,
            "progress": self.current_progress,
            "deadline": self.deadline,
            "total_tasks": len(self.plan),
            "pending_tasks": sum(1 for t in self.plan if t.get("status") == "pending"),
        }

goal = GoalState()

def get_llm():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    return ChatGroq(model=model, temperature=0.3, groq_api_key=api_key)

def generate_plan():
    """Generate candidate work; generation itself never counts as revenue."""
    if not goal.active or goal.target_amount <= 0:
        return

    llm = get_llm()
    prompt_text = f"""
You are F.R.I.D.A.Y., an autonomous operations planner.
Goal: obtain legitimate, verifiable revenue of {goal.target_amount} {goal.currency} by {goal.deadline}.
Current VERIFIED progress: {goal.current_progress} {goal.currency}.

Generate up to 12 concrete opportunities/tasks across multiple legitimate channels,
not just one strategy. Prefer actions that can produce measurable evidence such as
an accepted proposal, order, invoice payment, signed contract, grant award, or
other independently verifiable receipt. Do not claim money was earned merely because
an action was attempted. Do not fabricate transactions, customers, orders, or balances.

Return ONLY JSON:
[{{"action":"...","channel":"...","expected_value":0,"evidence_required":"..."}}]
"""
    try:
        response = llm.invoke(prompt_text)
        import re
        match = re.search(r"\[.*\]", response.content, re.DOTALL)
        if not match:
            raise ValueError("planner returned no JSON array")
        tasks = json.loads(match.group())
        goal.plan = []
        for task in tasks[:12]:
            goal.plan.append({
                "action": str(task.get("action", "")),
                "channel": str(task.get("channel", "general")),
                "expected_value": float(task.get("expected_value", 0) or 0),
                "evidence_required": str(task.get("evidence_required", "")),
                "status": "pending",
                "result": "",
            })
        goal.save()
        logger.info("Plan generated with %d candidate tasks.", len(goal.plan))
    except Exception as exc:
        logger.error("Plan generation error: %s", exc)

def run_autonomous_cycle():
    """Heartbeat. It schedules work but cannot manufacture financial progress."""
    if not goal.active:
        return

    if goal.deadline and datetime.now() > datetime.fromisoformat(goal.deadline):
        logger.warning("Financial goal deadline expired. Deactivating objective.")
        goal.active = False
        goal.save()
        return

    if not goal.plan:
        generate_plan()
        return

    pending_tasks = [t for t in goal.plan if t.get("status") == "pending"]
    if not pending_tasks:
        if goal.current_progress < goal.target_amount:
            generate_plan()
        return

    current_task = pending_tasks[0]
    # Planning/execution adapters must update this status after they perform a
    # real action. We deliberately do not mark it done or add money here.
    current_task["status"] = "ready"
    current_task["result"] = "Awaiting execution adapter and independent evidence."
    goal.save()
    logger.info("Task ready: %s", current_task.get("action"))

scheduler = BackgroundScheduler()
scheduler.add_job(run_autonomous_cycle, "interval", seconds=THINK_INTERVAL)
scheduler.start()
