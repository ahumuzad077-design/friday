"""External commercial integrations for F.R.I.D.A.Y. V3.

These adapters use HTTP or Playwright directly and keep secrets in environment
variables. They are intentionally small, auditable, and fail closed when a
credential or required configuration is missing.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class ExternalAPIError(RuntimeError):
    pass


def _json_request(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    payload: Any | None = None,
    timeout: int = 30,
) -> Any:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers=headers or {},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:800]
        raise ExternalAPIError(f"HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise ExternalAPIError(f"network error: {exc.reason}") from exc


class TavilySearch:
    base_url = "https://api.tavily.com/search"

    def __init__(self):
        self.api_key = os.getenv("TAVILY_API_KEY")

    def configured(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, max_results: int = 8) -> list[dict[str, Any]]:
        if not self.api_key:
            raise ExternalAPIError("TAVILY_API_KEY is not configured")
        data = _json_request(
            "POST",
            self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            payload={
                "query": query,
                "topic": "general",
                "search_depth": os.getenv("TAVILY_SEARCH_DEPTH", "basic"),
                "max_results": max(1, min(max_results, 20)),
                "include_answer": False,
                "include_raw_content": False,
                "include_images": False,
            },
        )
        return list(data.get("results") or [])


class ApolloProspecting:
    search_url = "https://api.apollo.io/api/v1/mixed_people/api_search"
    enrich_url = "https://api.apollo.io/api/v1/people/match"

    def __init__(self):
        self.api_key = os.getenv("APOLLO_API_KEY")

    def configured(self) -> bool:
        return bool(self.api_key)

    def search_people(
        self,
        titles: list[str],
        locations: list[str],
        per_page: int = 10,
    ) -> list[dict[str, Any]]:
        if not self.api_key:
            raise ExternalAPIError("APOLLO_API_KEY is not configured")
        query = [
            ("per_page", str(max(1, min(per_page, 100)))),
            ("page", "1"),
        ]
        for title in titles:
            query.append(("person_titles[]", title))
        for location in locations:
            query.append(("organization_locations[]", location))
        url = f"{self.search_url}?{urllib.parse.urlencode(query)}"
        data = _json_request(
            "POST",
            url,
            headers={
                "x-api-key": self.api_key,
                "Cache-Control": "no-cache",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30,
        )
        return list(data.get("people") or [])

    def enrich_person(
        self,
        *,
        name: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
        domain: str | None = None,
    ) -> dict[str, Any] | None:
        if not self.api_key:
            raise ExternalAPIError("APOLLO_API_KEY is not configured")
        query: dict[str, str] = {
            "reveal_personal_emails": "false",
            "reveal_phone_number": "false",
        }
        if name:
            query["name"] = name
        else:
            if first_name:
                query["first_name"] = first_name
            if last_name:
                query["last_name"] = last_name
        if domain:
            query["domain"] = domain
        url = f"{self.enrich_url}?{urllib.parse.urlencode(query)}"
        data = _json_request(
            "POST",
            url,
            headers={
                "x-api-key": self.api_key,
                "Cache-Control": "no-cache",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30,
        )
        return data.get("person")


class ResendMailer:
    endpoint = "https://api.resend.com/emails"

    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("RESEND_FROM_EMAIL") or os.getenv("SENDER_EMAIL", "")
        self.enabled = os.getenv("ALLOW_AUTONOMOUS_EMAIL", "false").strip().lower() in {
            "1", "true", "yes", "on"
        }
        try:
            self.daily_cap = max(1, int(os.getenv("MAX_AUTONOMOUS_EMAILS_PER_DAY", "20")))
        except ValueError:
            self.daily_cap = 20
        self.sent_today = 0

    def configured(self) -> bool:
        return bool(self.api_key and self.from_email)

    def send(self, recipient: str, subject: str, html: str, idempotency_key: str) -> dict[str, Any]:
        if not self.enabled:
            return {"sent": False, "reason": "autonomous email is disabled"}
        if not self.configured():
            return {"sent": False, "reason": "RESEND_API_KEY and RESEND_FROM_EMAIL are required"}
        if self.sent_today >= self.daily_cap:
            return {"sent": False, "reason": "daily email cap reached"}
        if not recipient or "@" not in recipient:
            return {"sent": False, "reason": "invalid recipient"}
        data = _json_request(
            "POST",
            self.endpoint,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Idempotency-Key": idempotency_key,
            },
            payload={
                "from": self.from_email,
                "to": [recipient],
                "subject": subject,
                "html": html,
            },
        )
        self.sent_today += 1
        return {"sent": True, "provider_id": data.get("id")}


class SupabaseStore:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        self.secret_key = os.getenv("SUPABASE_SECRET_KEY")

    def configured(self) -> bool:
        return bool(self.url and self.secret_key)

    def _request(self, method: str, table: str, payload: Any | None = None, query: str = ""):
        if not self.configured():
            raise ExternalAPIError("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
        url = self.url.rstrip("/") + f"/rest/v1/{table}"
        if query:
            url += f"?{query}"
        return _json_request(
            method,
            url,
            headers={
                "apikey": self.secret_key,
                "Authorization": f"Bearer {self.secret_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Prefer": "return=representation,resolution=merge-duplicates",
            },
            payload=payload,
        )

    def health(self) -> bool:
        if not self.configured():
            return False
        self._request("GET", "settings", query="select=key&limit=1")
        return True

    def upsert_opportunity(self, row: dict[str, Any]) -> Any:
        ref = row.get("external_ref")
        query = "on_conflict=external_ref" if ref else ""
        return self._request("POST", "opportunities", row, query=query)

    def insert_lead(self, row: dict[str, Any]) -> Any:
        return self._request("POST", "leads", row)

    def insert_activity(self, row: dict[str, Any]) -> Any:
        return self._request("POST", "activity_log", row)

    def insert_task(self, row: dict[str, Any]) -> Any:
        return self._request("POST", "tasks", row)

    def insert_revenue_event(self, row: dict[str, Any]) -> Any:
        query = "on_conflict=provider,transaction_id"
        return self._request("POST", "revenue_events", row, query=query)

    def recent_activity(self, event_type: str, limit: int = 200) -> list[dict[str, Any]]:
        if not self.configured():
            raise ExternalAPIError("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
        query = urllib.parse.urlencode({
            "select": "id,event_type,actor,message,metadata,created_at",
            "event_type": f"eq.{event_type}",
            "order": "created_at.desc",
            "limit": str(max(1, min(limit, 500))),
        })
        rows = self._request("GET", "activity_log", query=query)
        return list(rows or [])

    def recent_rows(self, table: str, select: str = "*", limit: int = 100) -> list[dict[str, Any]]:
        allowed_tables = {"leads", "orders", "payments", "revenue_events", "activity_log", "tasks"}
        if table not in allowed_tables:
            raise ValueError("table is not allowed")
        if not self.configured():
            raise ExternalAPIError("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
        query = urllib.parse.urlencode({
            "select": select,
            "order": "created_at.desc",
            "limit": str(max(1, min(limit, 200))),
        })
        rows = self._request("GET", table, query=query)
        return list(rows or [])


@dataclass
class DiscoveredCandidate:
    external_ref: str
    source: str
    company: str
    name: str
    title: str
    email: str
    website: str
    source_url: str
    evidence: str
    fit_score: float

    def to_lead_row(self) -> dict[str, Any]:
        return {
            "name": self.name or None,
            "company": self.company or None,
            "email": self.email or None,
            "website": self.website or None,
            "source": self.source,
            "status": "new",
            "qualification": {
                "fit_score": self.fit_score,
                "evidence": self.evidence[:2000],
                "source_url": self.source_url,
            },
            "metadata": {"external_ref": self.external_ref},
        }


class BrowserWorker:
    """Public-web browser automation foundation.

    It can inspect and navigate public pages. Credentials and login flows are
    deliberately kept out of the generic worker until a site-specific connector
    and human-controlled session is available.
    """

    def __init__(self):
        self.enabled = os.getenv("BROWSER_AUTOMATION_ENABLED", "true").strip().lower() in {
            "1", "true", "yes", "on"
        }
        self.allowed_domains = {
            d.strip().lower()
            for d in os.getenv("BROWSER_ALLOWED_DOMAINS", "").split(",")
            if d.strip()
        }

    def configured(self) -> bool:
        return self.enabled

    def inspect(self, url: str, timeout_ms: int = 20000) -> dict[str, Any]:
        if not self.enabled:
            raise ExternalAPIError("browser automation is disabled")
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("a valid http(s) URL is required")
        host = parsed.hostname.lower() if parsed.hostname else ""
        if self.allowed_domains and not any(
            (host == domain or host.endswith("." + domain))
            for domain in self.allowed_domains
        ):
            raise ExternalAPIError(f"domain not allowed: {host}")
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            raise ExternalAPIError("Playwright is not installed") from exc

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            title = page.title()
            text = page.locator("body").inner_text(timeout=5000)
            links = page.locator("a").evaluate_all(
                "(els) => els.slice(0, 40).map(a => ({text:(a.innerText||a.textContent||'').trim(), href:a.href}))"
            )
            browser.close()
        return {
            "url": url,
            "title": title,
            "text": text[:12000],
            "links": links,
        }


def stable_ref(*parts: str) -> str:
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


class MarketDiscovery:
    def __init__(self):
        self.tavily = TavilySearch()
        self.apollo = ApolloProspecting()
        self.supabase = SupabaseStore()
        self.browser = BrowserWorker()
        self.shopify = ShopifyStore()

    def status(self) -> dict[str, Any]:
        return {
            "tavily_configured": self.tavily.configured(),
            "apollo_configured": self.apollo.configured(),
            "resend_configured": ResendMailer().configured(),
            "autonomous_email_enabled": ResendMailer().enabled,
            "supabase_configured": self.supabase.configured(),
            "browser_enabled": self.browser.configured(),
            "shopify_configured": self.shopify.configured(),
        }

    def discover(self, limit: int = 8) -> list[DiscoveredCandidate]:
        candidates: list[DiscoveredCandidate] = []
        queries = [
            q.strip()
            for q in os.getenv(
                "MARKET_DISCOVERY_QUERIES",
                "businesses needing website automation,hospitality businesses needing AI customer service,"
                "restaurants needing online booking automation,salons spas clinics needing customer-service automation"
            ).split(",")
            if q.strip()
        ]

        if self.tavily.configured():
            for query in queries[:4]:
                try:
                    results = self.tavily.search(query, max_results=3)
                except ExternalAPIError:
                    continue
                for item in results:
                    url = str(item.get("url", ""))
                    title = str(item.get("title", ""))
                    content = str(item.get("content", ""))
                    if not url:
                        continue
                    host = urllib.parse.urlparse(url).hostname or ""
                    company = title[:120] or host
                    ref = stable_ref("tavily", url)
                    candidates.append(
                        DiscoveredCandidate(
                            external_ref=ref,
                            source="tavily",
                            company=company,
                            name="",
                            title="",
                            email="",
                            website=url,
                            source_url=url,
                            evidence=content,
                            fit_score=min(1.0, 0.35 + float(item.get("score", 0) or 0) * 0.65),
                        )
                    )

        if self.apollo.configured():
            titles = [
                x.strip()
                for x in os.getenv(
                    "APOLLO_TARGET_TITLES",
                    "owner,founder,ceo,managing director,general manager"
                ).split(",")
                if x.strip()
            ]
            locations = [
                x.strip()
                for x in os.getenv("APOLLO_TARGET_LOCATIONS", "Uganda,Kenya")
                .split(",")
                if x.strip()
            ]
            try:
                people = self.apollo.search_people(titles, locations, per_page=min(10, limit))
            except ExternalAPIError:
                people = []
            enrich_limit = max(0, int(os.getenv("APOLLO_ENRICH_LIMIT", "5")))
            for idx, person in enumerate(people[:limit]):
                organization = person.get("organization") or {}
                domain = str(organization.get("primary_domain") or "")
                name = str(person.get("name") or "").strip()
                enriched = None
                if idx < enrich_limit and name and domain:
                    try:
                        enriched = self.apollo.enrich_person(name=name, domain=domain)
                    except ExternalAPIError:
                        enriched = None
                merged = enriched or person
                organization = merged.get("organization") or organization
                email = str(merged.get("email") or "")
                company = str(organization.get("name") or person.get("organization_name") or "")
                website = str(organization.get("website_url") or (f"https://{domain}" if domain else ""))
                ref = stable_ref("apollo", str(person.get("id") or ""), company, name)
                candidates.append(
                    DiscoveredCandidate(
                        external_ref=ref,
                        source="apollo",
                        company=company,
                        name=name,
                        title=str(person.get("title") or ""),
                        email=email,
                        website=website,
                        source_url=str(person.get("linkedin_url") or website),
                        evidence=f"Apollo prospect: {name} at {company}",
                        fit_score=0.75,
                    )
                )

        unique: dict[str, DiscoveredCandidate] = {}
        for candidate in candidates:
            unique.setdefault(candidate.external_ref, candidate)
        return list(unique.values())[: max(1, limit)]


class ShopifyStore:
    """Shopify Admin GraphQL adapter for catalog and publishing operations."""

    def __init__(self):
        self.store_domain = os.getenv("SHOPIFY_STORE_DOMAIN", "").strip()
        self.access_token = os.getenv("SHOPIFY_ACCESS_TOKEN", "").strip()
        self.api_version = os.getenv("SHOPIFY_API_VERSION", "2026-07").strip()

    def configured(self) -> bool:
        return bool(self.store_domain and self.access_token)

    @property
    def endpoint(self) -> str:
        domain = self.store_domain.replace("https://", "").replace("http://", "").rstrip("/")
        return f"https://{domain}/admin/api/{self.api_version}/graphql.json"

    def graphql(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.configured():
            raise ExternalAPIError("SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN are required")
        data = _json_request(
            "POST",
            self.endpoint,
            headers={
                "X-Shopify-Access-Token": self.access_token,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            payload={"query": query, "variables": variables or {}},
        )
        if data.get("errors"):
            raise ExternalAPIError(f"Shopify GraphQL errors: {data['errors']}")
        return data.get("data") or {}

    def list_products(self, limit: int = 25) -> list[dict[str, Any]]:
        data = self.graphql(
            """query Products($first: Int!) {
                products(first: $first) {
                    nodes {
                        id
                        title
                        status
                        vendor
                        productType
                        handle
                        variants(first: 10) {
                            nodes { id title price sku }
                        }
                    }
                }
            }""",
            {"first": max(1, min(limit, 100))},
        )
        return list((data.get("products") or {}).get("nodes") or [])

    def create_product(
        self,
        *,
        title: str,
        description: str = "",
        vendor: str = "F.R.I.D.A.Y.",
        product_type: str = "",
        status: str = "DRAFT",
    ) -> dict[str, Any]:
        data = self.graphql(
            """mutation ProductCreate($product: ProductCreateInput!) {
                productCreate(product: $product) {
                    product { id title handle status }
                    userErrors { field message }
                }
            }""",
            {
                "product": {
                    "title": title,
                    "descriptionHtml": description,
                    "vendor": vendor,
                    "productType": product_type,
                    "status": status,
                }
            },
        )
        result = data.get("productCreate") or {}
        errors = result.get("userErrors") or []
        if errors:
            raise ExternalAPIError(f"Shopify product errors: {errors}")
        return result.get("product") or {}

    def list_publications(self) -> list[dict[str, Any]]:
        data = self.graphql(
            """query Publications($first: Int!) {
                publications(first: $first) {
                    nodes { id name }
                }
            }""",
            {"first": 20},
        )
        return list((data.get("publications") or {}).get("nodes") or [])

    def publish_product(self, product_id: str, publication_id: str) -> dict[str, Any]:
        data = self.graphql(
            """mutation Publish($id: ID!, $input: [PublicationInput!]!) {
                publishablePublish(id: $id, input: $input) {
                    userErrors { field message }
                    publishable { ... on Product { id title status } }
                }
            }""",
            {"id": product_id, "input": [{"publicationId": publication_id}]},
        )
        result = data.get("publishablePublish") or {}
        errors = result.get("userErrors") or []
        if errors:
            raise ExternalAPIError(f"Shopify publish errors: {errors}")
        return result.get("publishable") or {}
