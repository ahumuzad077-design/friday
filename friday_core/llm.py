"""Free-first, provider-agnostic LLM client.

OpenAI-compatible providers are called over HTTP so F.R.I.D.A.Y. does not
require a paid SDK. Providers are optional; unavailable/rate-limited providers
are skipped and the next configured provider is tried.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class LLMResult:
    provider: str
    model: str
    text: str
    attempts: int


class FreeFirstLLM:
    def __init__(self, router=None):
        from .providers import ProviderRouter
        self.router = router or ProviderRouter()
        self.timeout = int(os.getenv("AI_TIMEOUT_SECONDS", "45"))
        self.max_retries = int(os.getenv("AI_MAX_RETRIES", "2"))

    def _request(self, provider, messages, tools=None, temperature=0.2):
        if not provider.base_url:
            raise RuntimeError(f"provider {provider.name} has no HTTP adapter")
        payload: dict[str, Any] = {
            "model": provider.default_model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            provider.base_url.rstrip("/") + "/chat/completions",
            data=body,
            headers={
                "Authorization": f"Bearer {os.environ[provider.env_name]}",
                "Content-Type": "application/json",
                "User-Agent": "FRIDAY/2.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        content = message.get("content") or ""
        if not content and message.get("tool_calls"):
            content = json.dumps({"tool_calls": message["tool_calls"]})
        if not content:
            raise RuntimeError(f"empty response from {provider.name}")
        return content

    def complete(self, messages, tools=None, temperature=0.2) -> LLMResult:
        providers = self.router.ordered_available()
        if not providers:
            raise RuntimeError("No configured AI provider. Add at least one free provider key.")
        last_error = None
        attempts = 0
        for provider in providers:
            for retry in range(self.max_retries + 1):
                attempts += 1
                try:
                    text = self._request(provider, messages, tools, temperature)
                    return LLMResult(provider.name, provider.default_model or "", text, attempts)
                except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, RuntimeError) as exc:
                    last_error = exc
                    if retry < self.max_retries:
                        time.sleep(min(2 ** retry, 8))
        raise RuntimeError(f"All configured AI providers failed: {last_error}")
