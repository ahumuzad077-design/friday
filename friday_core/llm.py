"""Free-first, provider-agnostic LLM client.

OpenAI-compatible providers are called over HTTP so F.R.I.D.A.Y. does not
require a paid SDK. Providers are optional; unavailable/rate-limited providers
are cooled down and the next configured provider is tried.
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
        self.max_retries = max(0, int(os.getenv("AI_MAX_RETRIES", "1")))
        self.max_input_chars = max(4000, int(os.getenv("AI_MAX_INPUT_CHARS", "14000")))
        self.max_output_tokens = max(256, int(os.getenv("AI_MAX_OUTPUT_TOKENS", "2048")))

    def _compact_messages(self, messages):
        compacted = []
        remaining = self.max_input_chars
        for index, message in enumerate(messages):
            role = message.get("role", "user")
            content = str(message.get("content", ""))
            reserve = 5000 if role == "user" and index == len(messages) - 1 else 3000
            allowed = max(1000, remaining if index == len(messages) - 1 else min(len(content), remaining - reserve))
            if len(content) > allowed:
                content = content[:allowed] + "\n[context truncated by F.R.I.D.A.Y.]"
            compacted.append({"role": role, "content": content})
            remaining -= len(content)
            if remaining <= 0:
                break
        return compacted

    def _request(self, provider, messages, tools=None, temperature=0.2, force_no_thinking=False):
        if not provider.base_url:
            raise RuntimeError(f"provider {provider.name} has no HTTP adapter")

        safe_messages = self._compact_messages(messages)
        payload: dict[str, Any] = {
            "model": provider.default_model,
            "messages": safe_messages,
            "temperature": temperature,
            "max_tokens": self.max_output_tokens,
        }

        if provider.name == "nvidia":
            payload["temperature"] = 1.0
            payload["top_p"] = 0.95
            if not force_no_thinking:
                payload["extra_body"] = {
                    "chat_template_kwargs": {
                        "enable_thinking": os.getenv(
                            "NVIDIA_ENABLE_THINKING", "true"
                        ).strip().lower() in {"1", "true", "yes", "on"}
                    }
                }
            else:
                payload["extra_body"] = {
                    "chat_template_kwargs": {
                        "enable_thinking": False,
                        "force_nonempty_content": True,
                    }
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
                "User-Agent": "FRIDAY/3.0",
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
        configured = self.router.configured()
        providers = self.router.ordered_available()
        if not configured:
            raise RuntimeError("No AI provider is configured. Add a provider key in Railway Variables.")
        if not providers:
            summary = self.router.health_summary()
            raise RuntimeError(
                "All configured AI providers are temporarily unavailable or rate-limited. "
                f"Cooling down: {', '.join(summary['cooling_down']) or 'none'}. "
                "Use provider status to inspect the current state."
            )

        errors = []
        attempts = 0
        for provider in providers:
            for retry in range(self.max_retries + 1):
                attempts += 1
                try:
                    text = self._request(provider, messages, tools, temperature)
                    return LLMResult(provider.name, provider.default_model or "", text, attempts)
                except urllib.error.HTTPError as exc:
                    detail = exc.read().decode("utf-8", errors="replace")[:300]

                    if provider.name == "nvidia" and exc.code == 400:
                        try:
                            text = self._request(
                                provider,
                                messages,
                                tools,
                                temperature,
                                force_no_thinking=True,
                            )
                            return LLMResult(provider.name, provider.default_model or "", text, attempts)
                        except urllib.error.HTTPError as retry_exc:
                            retry_detail = retry_exc.read().decode("utf-8", errors="replace")[:200]
                            errors.append(f"{provider.name}: HTTP 400 ({retry_detail})")
                            self.router.mark_unavailable(provider.name, 120, retry_detail)
                            break

                    if exc.code == 413:
                        self.router.mark_unavailable(provider.name, 120, f"HTTP 413: {detail}")
                        errors.append(f"{provider.name}: request too large")
                        break

                    if exc.code == 429:
                        retry_after = exc.headers.get("Retry-After") if exc.headers else None
                        try:
                            cooldown = max(30, min(int(float(retry_after)), 900)) if retry_after else 60
                        except (TypeError, ValueError):
                            cooldown = 60
                        self.router.mark_unavailable(provider.name, cooldown, f"HTTP 429: {detail}")
                        errors.append(f"{provider.name}: rate limited ({cooldown}s)")
                        break

                    errors.append(f"{provider.name}: HTTP {exc.code}")
                    if retry < self.max_retries:
                        time.sleep(min(2 ** retry, 4))
                except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
                    errors.append(f"{provider.name}: {exc}")
                    if retry < self.max_retries:
                        time.sleep(min(2 ** retry, 4))

        raise RuntimeError("AI providers failed: " + "; ".join(errors))
