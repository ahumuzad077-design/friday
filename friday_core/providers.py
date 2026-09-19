"""Provider registry and configurable free-first routing for F.R.I.D.A.Y."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class Provider:
    name: str
    env_name: str
    base_url: str | None = None
    default_model: str | None = None
    priority: int = 100
    optional: bool = True


class ProviderRouter:
    def __init__(self):
        providers = [
            Provider("nvidia", "NVIDIA_API_KEY", "https://integrate.api.nvidia.com/v1", os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3-ultra-550b-a55b"), 10),
            Provider("openrouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", os.getenv("OPENROUTER_MODEL", "openrouter/free"), 20),
            Provider("groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1", os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"), 30),
            Provider("gemini", "GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai", os.getenv("GEMINI_MODEL", "gemini-2.5-flash"), 40),
            Provider("xai", "XAI_API_KEY", "https://api.x.ai/v1", os.getenv("XAI_MODEL", "grok-4.1-fast"), 50),
            Provider("openai", "OPENAI_API_KEY", "https://api.openai.com/v1", os.getenv("OPENAI_MODEL", ""), 90),
        ]
        requested = [
            x.strip().lower()
            for x in os.getenv("AI_PROVIDER_ORDER", "openrouter,groq,gemini,nvidia,xai,openai").split(",")
            if x.strip()
        ]
        position = {name: index for index, name in enumerate(requested)}
        self.providers = sorted(providers, key=lambda p: (position.get(p.name, len(position) + p.priority), p.priority))
        self.cooldowns: dict[str, float] = {}
        self.last_errors: dict[str, str] = {}

    def configured(self) -> list[Provider]:
        return [p for p in self.providers if os.getenv(p.env_name)]

    def available(self) -> list[Provider]:
        now = time.time()
        return [p for p in self.configured() if self.cooldowns.get(p.name, 0) <= now]

    def ordered_available(self) -> list[Provider]:
        return self.available()

    def mark_unavailable(self, provider_name: str, seconds: int = 60, error: str | None = None):
        self.cooldowns[provider_name] = time.time() + max(1, seconds)
        if error:
            self.last_errors[provider_name] = error

    def status(self) -> list[dict]:
        now = time.time()
        return [
            {
                "provider": p.name,
                "configured": bool(os.getenv(p.env_name)),
                "available": self.cooldowns.get(p.name, 0) <= now and bool(os.getenv(p.env_name)),
                "model": p.default_model,
                "priority": p.priority,
                "cooldown_seconds": max(0, int(self.cooldowns.get(p.name, 0) - now)),
                "last_error": self.last_errors.get(p.name),
            }
            for p in self.providers
        ]

    def health_summary(self) -> dict:
        configured = self.configured()
        available = self.available()
        cooling = [p for p in configured if p not in available]
        return {
            "configured_count": len(configured),
            "available_count": len(available),
            "cooling_down": [p.name for p in cooling],
        }
