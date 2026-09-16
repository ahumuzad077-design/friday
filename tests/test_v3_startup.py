import os
import tempfile
import unittest
from unittest.mock import patch


class V3StartupTests(unittest.TestCase):
    def test_service_starts_without_credentials(self):
        from friday_core.service import FridayService

        with tempfile.NamedTemporaryFile(suffix=".sqlite3") as f:
            with patch.dict(
                os.environ,
                {
                    "FRIDAY_LEDGER_DB": f.name,
                    "CAPITAL_TARGET_AMOUNT": "",
                    "CAPITAL_TARGET_CURRENCY": "USD",
                    "CAPITAL_TARGET_DEADLINE": "",
                    "PADDLE_API_KEY": "",
                    "PADDLE_WEBHOOK_SECRET": "",
                },
                clear=False,
            ):
                service = FridayService()
                self.assertFalse(service.paddle.configured())
                self.assertIsNone(service.goal)

    def test_capital_target_configuration(self):
        with patch.dict(
            os.environ,
            {
                "CAPITAL_TARGET_AMOUNT": "1000000",
                "CAPITAL_TARGET_CURRENCY": "usd",
                "CAPITAL_TARGET_DEADLINE": "2026-10-28",
            },
            clear=False,
        ):
            from friday_core.config import Settings

            settings = Settings()
            self.assertEqual(settings.capital_target, 1000000.0)
            self.assertEqual(settings.capital_currency, "USD")
            self.assertEqual(settings.capital_deadline, "2026-10-28")


if __name__ == "__main__":
    unittest.main()
