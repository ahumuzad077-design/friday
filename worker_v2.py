"""Always-on F.R.I.D.A.Y. worker.

The worker plans and reconciles work. It never manufactures revenue and it does
not send money. Real payment events arrive through the API webhook.
"""
from __future__ import annotations

import logging
import os
import time

from friday_core.service import FridayService

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("friday.worker")


def run():
    service = FridayService()
    interval = int(os.getenv("THINK_INTERVAL", "60"))
    while True:
        try:
            service.reconcile_goal()
            if service.goal:
                portfolio = service.portfolio()
                logger.info("goal=%s verified=%s opportunities=%s", service.goal.target, service.goal.verified_progress, len(portfolio))
            else:
                logger.info("F.R.I.D.A.Y. worker alive; no goal configured")
        except Exception:
            logger.exception("worker cycle failed")
        time.sleep(max(10, interval))


if __name__ == "__main__":
    run()
