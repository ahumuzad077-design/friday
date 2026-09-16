"""Runtime configuration for F.R.I.D.A.Y."""
from dataclasses import dataclass
import os


def flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "on"}


def positive_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return value


@dataclass(frozen=True)
class Settings:
    live_mode: bool = flag("LIVE_MODE", False)
    require_payment_verification: bool = flag("PAYMENT_VERIFICATION_REQUIRED", True)
    max_steps: int = positive_int("MAX_AGENT_STEPS", 25)
    max_parallel: int = positive_int("MAX_PARALLEL_OPPORTUNITIES", 8)
    ledger_path: str = os.getenv("FRIDAY_LEDGER_DB", "friday_ledger.sqlite3")
    capital_target: float | None = (
        float(os.environ["CAPITAL_TARGET_AMOUNT"])
        if os.getenv("CAPITAL_TARGET_AMOUNT")
        else None
    )
    capital_currency: str = os.getenv("CAPITAL_TARGET_CURRENCY", "USD").upper()
    capital_deadline: str | None = os.getenv("CAPITAL_TARGET_DEADLINE") or None
    hourly_target: float | None = (
        float(os.environ["HOURLY_REVENUE_TARGET"])
        if os.getenv("HOURLY_REVENUE_TARGET")
        else None
    )
    hourly_target_currency: str = os.getenv("HOURLY_REVENUE_TARGET_CURRENCY", "USD").upper()
    hourly_target_start: str = os.getenv("HOURLY_REVENUE_TARGET_START", "")
    hourly_target_deadline: str | None = os.getenv("HOURLY_REVENUE_TARGET_DEADLINE") or None

    def __post_init__(self):
        if self.capital_target is not None and self.capital_target <= 0:
            raise ValueError("CAPITAL_TARGET_AMOUNT must be greater than zero")
        if len(self.capital_currency) != 3:
            raise ValueError("CAPITAL_TARGET_CURRENCY must be a 3-letter currency code")
        if self.hourly_target is not None and self.hourly_target <= 0:
            raise ValueError("HOURLY_REVENUE_TARGET must be greater than zero")
        if len(self.hourly_target_currency) != 3:
            raise ValueError("HOURLY_REVENUE_TARGET_CURRENCY must be a 3-letter currency code")

    def enabled_providers(self) -> dict[str, bool]:
        names = ("OPENROUTER", "OPENAI", "GROQ", "XAI", "GEMINI", "NVIDIA", "GAMMA")
        return {name.lower(): bool(os.getenv(f"{name}_API_KEY")) for name in names}
