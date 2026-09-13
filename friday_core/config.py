"""Runtime configuration for F.R.I.D.A.Y. v2."""
from dataclasses import dataclass
import os


def flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    live_mode: bool = flag("LIVE_MODE", False)
    require_payment_verification: bool = flag("PAYMENT_VERIFICATION_REQUIRED", True)
    max_steps: int = int(os.getenv("MAX_AGENT_STEPS", "25"))
    max_parallel: int = int(os.getenv("MAX_PARALLEL_OPPORTUNITIES", "8"))
    ledger_path: str = os.getenv("FRIDAY_LEDGER_DB", "friday_ledger.sqlite3")

    def enabled_providers(self) -> dict[str, bool]:
        names = ("OPENROUTER", "OPENAI", "GROQ", "XAI", "GEMINI", "NVIDIA", "GAMMA")
        return {name.lower(): bool(os.getenv(f"{name}_API_KEY")) for name in names}
