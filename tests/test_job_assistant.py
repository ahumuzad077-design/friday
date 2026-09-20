import os
import tempfile
import unittest
from types import SimpleNamespace

from friday_core.job_assistant import InvitedJobAssistant


class FakeSupabase:
    def configured(self):
        return False


class FakeDiscovery:
    supabase = FakeSupabase()

    def status(self):
        return {
            "tavily_configured": False,
            "apollo_configured": False,
            "resend_configured": False,
            "autonomous_email_enabled": False,
            "supabase_configured": False,
            "browser_enabled": False,
            "shopify_configured": False,
        }


class FakeService:
    discovery = FakeDiscovery()


class InvitedJobAssistantTests(unittest.TestCase):
    def make_engine(self):
        engine = InvitedJobAssistant(FakeService())
        fd, path = tempfile.mkstemp(suffix=".json")
        os.close(fd)
        engine.state_path = path
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass
        return engine, path

    def test_upwork_link_is_received_without_scraping(self):
        engine, path = self.make_engine()
        try:
            result = engine.intake(
                "https://www.upwork.com/jobs/~0123456789abcdef",
                instruction="Please assess this job and prepare the work.",
            )
            self.assertEqual(result["platform"], "upwork")
            self.assertIn("approved_connector", result["source_mode"])
            self.assertTrue(result["job_id"])
            self.assertIn("job description", " ".join(result["blockers"]).lower())
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_generic_job_page_can_use_supplied_text(self):
        engine, path = self.make_engine()
        try:
            result = engine.intake(
                "https://example.com/jobs/123",
                page_text="Need a website and landing page. Requirements: responsive design.",
                instruction="Build this.",
            )
            self.assertEqual(result["platform"], "other")
            self.assertEqual(result["status"], "ANALYZED_READY_TO_WORK")
            self.assertIn("website", result["deliverables"])
            executed = engine.execute(result["job_id"])
            self.assertEqual(executed["status"], "READY_FOR_SUBMISSION")
            self.assertIn("submission", " ".join(executed["execution_notes"]).lower())
        finally:
            if os.path.exists(path):
                os.unlink(path)


if __name__ == "__main__":
    unittest.main()
