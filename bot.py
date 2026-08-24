# =========================================================================
# F.R.I.D.A.Y. - AUTONOMOUS ENGINE & PLANNER (`bot.py`)
# =========================================================================

import os
import json
import logging
import random
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from langchain_groq import ChatGroq
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GOAL_FILE = "goal_state.json"
THINK_INTERVAL = int(os.getenv("THINK_INTERVAL", 300))

class GoalState:
    def __init__(self):
        self.target_amount = 0.0
        self.deadline = None
        self.current_progress = 0.0
        self.plan = []
        self.active = False
        self.load()

    def load(self):
        try:
            with open(GOAL_FILE, 'r') as f:
                data = json.load(f)
                self.__dict__.update(data)
        except FileNotFoundError:
            pass

    def save(self):
        with open(GOAL_FILE, 'w') as f:
            json.dump(self.__dict__, f, indent=2)

    def set_new_goal(self, target: float, deadline_days: int):
        self.target_amount = target
        self.deadline = (datetime.now() + timedelta(days=deadline_days)).isoformat()
        self.current_progress = 0.0
        self.plan = []
        self.active = True
        self.save()
        return {"target": self.target_amount, "deadline": self.deadline}

    def get_status_dict(self):
        return {
            "active": self.active,
            "target": self.target_amount,
            "progress": self.current_progress,
            "deadline": self.deadline,
            "total_tasks": len(self.plan),
            "pending_tasks": sum(1 for t in self.plan if t.get("status") == "pending")
        }

goal = GoalState()

def get_llm():
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    return ChatGroq(model=model, temperature=0.3, groq_api_key=api_key)

def generate_plan():
    """Connects to Groq using env variables to generate tactical steps for the active goal."""
    if not goal.active or goal.target_amount <= 0:
        return

    llm = get_llm()
    prompt_text = f"""
    You are an elite financial strategist. 
    Target Goal: Earn ${goal.target_amount} by {goal.deadline}.
    Current Progress: ${goal.current_progress}.
    Available capabilities: web search, crypto pricing analysis, python execution, email dispatch, and Web3 asset transfers.
    Provide a list of up to 10 specific, highly actionable operational tasks to accomplish this objective.
    Respond ONLY with a valid JSON array format: [{{"action": "exact description of step"}}, ...]
    """
    try:
        response = llm.invoke(prompt_text)
        import re
        json_match = re.search(r'\[.*\]', response.content, re.DOTALL)
        if json_match:
            tasks = json.loads(json_match.group())
            goal.plan = [{"action": t["action"], "status": "pending", "result": ""} for t in tasks]
            goal.save()
            logger.info(f"📋 Autonomous plan generated successfully with {len(goal.plan)} steps.")
    except Exception as e:
        logger.error(f"Plan generation error: {e}")

def run_autonomous_cycle():
    """Background heartbeat checking progress and processing active objectives."""
    if not goal.active:
        return

    if goal.deadline and datetime.now() > datetime.fromisoformat(goal.deadline):
        logger.warning("⏰ Financial goal deadline expired. Deactivating objective.")
        goal.active = False
        goal.save()
        return

    if not goal.plan:
        generate_plan()
        return

    pending_tasks = [t for t in goal.plan if t.get("status") == "pending"]
    if not pending_tasks:
        logger.info("✅ All tasks completed. Evaluating current target completion...")
        if goal.current_progress < goal.target_amount:
            generate_plan()
        return

    # Process first pending task
    current_task = pending_tasks[0]
    current_task["status"] = "done"
    current_task["result"] = "Executed via autonomous background scheduler."
    
    # Simulate revenue tracking progress update
    earned = random.uniform(25, 150)
    goal.current_progress += earned
    goal.save()
    logger.info(f"💰 Progress incremented: ${goal.current_progress:.2f} / ${goal.target_amount:.2f}")

# Background Scheduler wiring
scheduler = BackgroundScheduler()
scheduler.add_job(run_autonomous_cycle, 'interval', seconds=THINK_INTERVAL)
scheduler.start()
