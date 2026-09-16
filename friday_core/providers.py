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
            Provider(
                "openrouter",
                "OPENROUTER_API_KEY",
                "https://openrouter.ai/api/v1",
                os.getenv("OPENROUTER_MODEL", "openrouter/free"),
                10,
            ),
            Provider(
                "groq",
                "GROQ_API_KEY",
                "https://api.groq.com/openai/v1",
                os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                20,
            ),
            Provider(
                "gemini",
                "GEMINI_API_KEY",
                "https://generativelanguage.googleapis.com/v1beta/openai",
                os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                30,
            ),
            Provider(
                "nvidia",
                "NVIDIA_API_KEY",
                "https://integrate.api.nvidia.com/v1",
                os.getenv("NVIDIA_MODEL", "nvidia/llama-3.3-nemotron-super-49b-v1"),
                40,
            ),
            Provider(
                "xai",
                "XAI_API_KEY",
                "https://api.x.ai/v1",
                os.getenv("XAI_MODEL", "grok-4.1-fast"),
                50,
            ),
            Provider(
                "openai",
                "OPENAI_API_KEY",
                "https://api.openai.com/v1",
                os.getenv("OPENAI_MODEL", ""),
                90,
            ),
        ]

        requested = [
            x.strip().lower()
            for x in os.getenv(
                "AI_PROVIDER_ORDER", "openrouter,groq,gemini,nvidia,xai,openai"
            ).split(",")
            if x.strip()
        ]
        position = {name: index for index, name in enumerate(requested)}
        self.providers = sorted(
            providers,
            key=lambda p: (
                position.get(p.name, len(position) + p.priority),
                p.priority,
            ),
        )
        self.cooldowns: dict[str, float] = {}

    def available(self) -> list[Provider]:
        now = time.time()
        return [
            p
            for p in self.providers
            if os.getenv(p.env_name)
            and self.cooldowns.get(p.name, 0) <= now
        ]

    def ordered_available(self) -> list[Provider]:
        return self.available()

    def mark_unavailable(self, provider_name: str, seconds: int = 60):
        self.cooldowns[provider_name] = time.time() + seconds

    def status(self) -> list[dict]:
        return [
            {
                "provider": p.name,
                "configured": bool(os.getenv(p.env_name)),
                "available": any(x.name == p.name for x in self.available()),
                "model": p.default_model,
                "priority": p.priority,
            }
            for p in self.providers
        ]
