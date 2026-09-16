import os
import unittest


class V3StartupTests(unittest.TestCase):
    def test_service_starts_without_credentials(self):
        from friday_core.service import FridayService

        service = FridayService()
        self.assertFalse(service.paddle.configured())
        self.assertIsNone(service.goal)

    def test_capital_target_configuration(self):
        keys = ("CAPITAL_TARGET_AMOUNT", "CAPITAL_TARGET_CURRENCY", "CAPITAL_TARGET_DEADLINE")
        old = {key: os.environ.get(key) for key in keys}
        os.environ["CAPITAL_TARGET_AMOUNT"] = "1000000"
        os.environ["CAPITAL_TARGET_CURRENCY"] = "usd"
        os.environ["CAPITAL_TARGET_DEADLINE"] = "2026-10-28"
        try:
            from friday_core.config import Settings

            settings = Settings()
            self.assertEqual(settings.capital_target, 1000000.0)
            self.assertEqual(settings.capital_currency, "USD")
            self.assertEqual(settings.capital_deadline, "2026-10-28")
        finally:
            for key, value in old.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value


if __name__ == "__main__":
    unittest.main()
