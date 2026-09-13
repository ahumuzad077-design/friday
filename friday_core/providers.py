"""Provider registry for multi-model reasoning.

This layer does not decide how money is made. It supplies reasoning capabilities
and can degrade gracefully when a provider is unavailable.
"""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Provider:
    name: str
    env_name: str
    base_url: str | None = None
    default_model: str | None = None


class ProviderRouter:
    def __init__(self):
        self.providers = [
            Provider("openrouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", os.getenv("OPENROUTER_MODEL", "openrouter/auto")),
            Provider("openai", "OPENAI_API_KEY", "https://api.openai.com/v1", os.getenv("OPENAI_MODEL", "")),
            Provider("groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1", os.getenv("GROQ_MODEL", "")),
            Provider("xai", "XAI_API_KEY", "https://api.x.ai/v1", os.getenv("XAI_MODEL", "grok-4.6")),
            Provider("gemini", "GEMINI_API_KEY", None, os.getenv("GEMINI_MODEL", "")),
            Provider("nvidia", "NVIDIA_API_KEY", None, os.getenv("NVIDIA_MODEL", "")),
        ]

    def available(self) -> list[Provider]:
        return [p for p in self.providers if os.getenv(p.env_name)]

    def status(self) -> list[dict]:
        return [{"provider": p.name, "configured": bool(os.getenv(p.env_name)), "model": p.default_model} for p in self.providers]
