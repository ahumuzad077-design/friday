"""Invited Job Assistant for F.R.I.D.A.Y. V3.

Accepts a job URL supplied by the user, records the opportunity, builds a
structured work package, drafts a proposal, and tracks execution. It does not
use unauthorized automation against marketplaces. Upwork/Fiverr links are
accepted as job references; marketplace interaction requires an approved
connector or explicit human action.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import urllib.parse
from typing import Any

from .integrations import ExternalAPIError


MARKETPLACE_RULES = {
    "upwork": {
        "domains": {"upwork.com", "www.upwork.com"},
        "mode": "approved_connector_or_human",
        "note": "Do not scrape or automate marketplace interactions without an approved Upwork integration.",
    },
    "fiverr": {
        "domains": {"fiverr.com", "www.fiverr.com"},
        "mode": "approved_connector_or_human",
        "note": "Do not scrape or automate unauthorized marketplace interactions or mass messaging.",
    },
}


@dataclass
class JobRecord:
    job_id: str
    platform: str
    url: str
    source_mode: str
    user_instruction: str
    title: str
    description: str
    requirements: list[str]
    deliverables: list[str]
    estimated_value: float | None
    status: str
    blockers: list[str]
    proposal: str
    work_plan: list[dict[str, Any]]
    execution_notes: list[str]
    evidence: list[dict[str, Any]]
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class InvitedJobAssistant:
    def __init__(self, service):
        self.service = service
        self.state_path = os.getenv("JOB_ASSISTANT_STATE_PATH", "friday_jobs.json")
        self.records: dict[str, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        try:
            with open(self.state_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
            self.records = dict(payload.get("jobs", {}))
        except (FileNotFoundError, ValueError, TypeError, json.JSONDecodeError):
            self.records = {}

    def _save(self) -> None:
        tmp = self.state_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump({"jobs": self.records}, handle, indent=2)
        os.replace(tmp, self.state_path)

    @staticmethod
    def detect_platform(url: str) -> str:
        host = (urllib.parse.urlparse(url).hostname or "").lower()
        if host.endswith("upwork.com"):
            return "upwork"
        if host.endswith("fiverr.com"):
            return "fiverr"
        return "other"

    @staticmethod
    def _job_id(url: str) -> str:
        return "job-" + hashlib.sha256(url.strip().encode("utf-8")).hexdigest()[:20]

    @staticmethod
    def _extract_requirements(text: str) -> list[str]:
        patterns = [
            r"must have[^.\n]{0,180}",
            r"required[^.\n]{0,180}",
            r"requirements?[:\-][^\n]{0,220}",
            r"deliverables?[:\-][^\n]{0,220}",
            r"looking for[^.\n]{0,180}",
        ]
        found: list[str] = []
        for pattern in patterns:
            for match in re.findall(pattern, text, flags=re.IGNORECASE):
                value = " ".join(match.split())
                if value and value not in found:
                    found.append(value[:300])
        return found[:15]

    @staticmethod
    def _extract_deliverables(text: str) -> list[str]:
        keywords = [
            "website", "landing page", "app", "dashboard", "logo", "design",
            "content", "article", "video", "automation", "chatbot", "data",
            "spreadsheet", "presentation", "report", "research", "api",
            "software", "bug fix", "integration",
        ]
        lowered = text.lower()
        return [k for k in keywords if k in lowered][:12]

    @staticmethod
    def _extract_amount(text: str) -> float | None:
        matches = re.findall(r"(?:\$|usd\s*)([0-9][0-9,]*(?:\.[0-9]{1,2})?)", text, flags=re.IGNORECASE)
        if not matches:
            return None
        values = []
        for value in matches:
            try:
                values.append(float(value.replace(",", "")))
            except ValueError:
                pass
        return max(values) if values else None

    def _persist_activity(self, record: JobRecord) -> None:
        supabase = self.service.discovery.supabase
        if not supabase.configured():
            return
        try:
            supabase.insert_task({
                "task_key": record.job_id,
                "type": "invited_job",
                "status": record.status.lower(),
                "priority": "high",
                "payload": record.to_dict(),
                "metadata": {"platform": record.platform, "url": record.url},
            })
            supabase.insert_activity({
                "event_type": "invited_job",
                "actor": "friday-v3",
                "message": f"{record.status}: {record.platform} job {record.job_id}",
                "metadata": record.to_dict(),
            })
        except ExternalAPIError:
            pass

    def _save_record(self, record: JobRecord) -> dict[str, Any]:
        data = record.to_dict()
        self.records[record.job_id] = data
        self._save()
        self._persist_activity(record)
        return data

    def intake(self, url: str, instruction: str = "", page_text: str = "", title: str = "") -> dict[str, Any]:
        url = url.strip()
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("A valid http(s) job URL is required.")

        platform = self.detect_platform(url)
        rules = MARKETPLACE_RULES.get(platform)
        source_mode = rules["mode"] if rules else "public_page_or_user_supplied_context"

        # Marketplace links are stored without automated scraping unless an
        # approved connector is present. Generic public job pages may be inspected.
        blockers: list[str] = []
        evidence: list[dict[str, Any]] = [{"type": "user_supplied_url", "url": url}]
        description = page_text.strip()

        if rules:
            blockers.append(rules["note"])
            if not description:
                blockers.append(
                    f"Provide the job description here or connect an approved {platform.title()} integration "
                    "before automated job-page analysis."
                )
        elif not description:
            if self.service.discovery.browser.configured():
                try:
                    page = self.service.discovery.browser.inspect(url)
                    title = title or str(page.get("title") or "")
                    description = str(page.get("text") or "")[:12000]
                    evidence.append({
                        "type": "browser_inspection",
                        "url": url,
                        "title": title,
                        "characters": len(description),
                    })
                except Exception as exc:
                    blockers.append(f"Public job-page inspection failed: {type(exc).__name__}: {exc}")
            else:
                blockers.append("Browser inspection is not configured; provide the job description.")

        title = title.strip() or self._derive_title(description, platform)
        requirements = self._extract_requirements(description)
        deliverables = self._extract_deliverables(description)
        estimated_value = self._extract_amount(description)

        if platform in MARKETPLACE_RULES and not description:
            status = "RECEIVED_NEEDS_JOB_TEXT_OR_APPROVED_CONNECTOR"
        elif description:
            status = "ANALYZED_READY_TO_WORK"
        else:
            status = "RECEIVED"

        if not requirements:
            requirements = ["Review the supplied job brief before final execution."]
        if not deliverables:
            deliverables = ["Create a job-specific deliverable plan from the supplied brief."]

        job_id = self._job_id(url)
        now = datetime.now(timezone.utc).isoformat()
        proposal = self._proposal(title, platform, requirements, deliverables, instruction)
        work_plan = self._build_work_plan(deliverables, requirements, instruction)

        record = JobRecord(
            job_id=job_id,
            platform=platform,
            url=url,
            source_mode=source_mode,
            user_instruction=instruction,
            title=title,
            description=description[:12000],
            requirements=requirements,
            deliverables=deliverables,
            estimated_value=estimated_value,
            status=status,
            blockers=blockers,
            proposal=proposal,
            work_plan=work_plan,
            execution_notes=[],
            evidence=evidence,
            created_at=now,
            updated_at=now,
        )
        return self._save_record(record)

    def execute(self, job_id: str) -> dict[str, Any]:
        raw = self.records.get(job_id)
        if not raw:
            raise KeyError(job_id)

        record = JobRecord(**raw)
        now = datetime.now(timezone.utc).isoformat()

        if record.status == "RECEIVED_NEEDS_JOB_TEXT_OR_APPROVED_CONNECTOR":
            record.status = "BLOCKED"
            record.execution_notes.append(
                "Marketplace job page was not automatically scraped. Supply the job text or configure an approved connector."
            )
            record.updated_at = now
            return self._save_record(record)

        record.status = "WORK_IN_PROGRESS"
        record.execution_notes.append("Execution workspace initialized from the supplied job brief.")

        # Keep external marketplace submission separate. The assistant can prepare
        # the actual work package here without pretending it was submitted.
        for step in record.work_plan:
            step["status"] = "READY"

        record.status = "READY_FOR_SUBMISSION"
        record.execution_notes.append("Deliverable plan prepared; marketplace submission remains a separate authorized action.")
        record.updated_at = now
        return self._save_record(record)

    def get(self, job_id: str) -> dict[str, Any]:
        record = self.records.get(job_id)
        if not record:
            raise KeyError(job_id)
        return record

    def recent(self, limit: int = 20) -> list[dict[str, Any]]:
        values = list(self.records.values())
        return values[-max(1, min(limit, 100)):]

    def _derive_title(self, description: str, platform: str) -> str:
        first = next((line.strip() for line in description.splitlines() if line.strip()), "")
        if first:
            return first[:160]
        return f"{platform.title()} Job"

    @staticmethod
    def _proposal(title: str, platform: str, requirements: list[str], deliverables: list[str], instruction: str) -> str:
        requirement_text = "; ".join(requirements[:4])
        deliverable_text = "; ".join(deliverables[:6])
        personal = f"\nClient instruction: {instruction.strip()}" if instruction.strip() else ""
        return (
            f"Hello,\n\nI reviewed the brief for “{title}” and can help deliver the requested outcome. "
            f"I would approach it in clear stages: confirm requirements, produce the core deliverables, "
            f"test/review the result, and provide a clean final handoff.\n\n"
            f"Key requirements I will address: {requirement_text}.\n"
            f"Expected deliverables: {deliverable_text}.\n\n"
            f"I will keep the work aligned to the brief and communicate any requirement that needs clarification. "
            f"This proposal should be reviewed for factual accuracy and submitted only through the authorized {platform.title()} workflow."
            f"{personal}\n\nBest,\nF.R.I.D.A.Y.\n"
        )

    @staticmethod
    def _build_work_plan(deliverables: list[str], requirements: list[str], instruction: str) -> list[dict[str, Any]]:
        steps = [
            {"step": 1, "name": "Requirements", "action": "Confirm scope, constraints, inputs, and acceptance criteria."},
            {"step": 2, "name": "Production", "action": "Create the requested deliverables using the available F.R.I.D.A.Y. tools."},
            {"step": 3, "name": "Quality check", "action": "Check deliverables against requirements and remove unsupported claims or errors."},
            {"step": 4, "name": "Handoff", "action": "Package the completed work and prepare a client-ready handoff."},
        ]
        if instruction.strip():
            steps.insert(1, {"step": 2, "name": "User priorities", "action": instruction.strip()[:500]})
        return steps


def platform_policy(platform: str) -> dict[str, str]:
    rules = MARKETPLACE_RULES.get(platform.lower())
    if rules:
        return rules
    return {"mode": "standard", "note": "Use only authorized website/API interactions."}
