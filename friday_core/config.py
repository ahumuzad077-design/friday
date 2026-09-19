"""Runtime configuration for F.R.I.D.A.Y."""
from dataclasses import dataclass, field
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
    live_mode: bool = field(default_factory=lambda: flag("LIVE_MODE", False))
    require_payment_verification: bool = field(default_factory=lambda: flag("PAYMENT_VERIFICATION_REQUIRED", True))
    max_steps: int = field(default_factory=lambda: positive_int("MAX_AGENT_STEPS", 25))
    max_parallel: int = field(default_factory=lambda: positive_int("MAX_PARALLEL_OPPORTUNITIES", 8))
    ledger_path: str = field(default_factory=lambda: os.getenv("FRIDAY_LEDGER_DB", "friday_ledger.sqlite3"))
    capital_target: float | None = field(default_factory=lambda: float(os.environ["CAPITAL_TARGET_AMOUNT"]) if os.getenv("CAPITAL_TARGET_AMOUNT") else None)
    capital_currency: str = field(default_factory=lambda: os.getenv("CAPITAL_TARGET_CURRENCY", "USD").upper())
    capital_deadline: str | None = field(default_factory=lambda: os.getenv("CAPITAL_TARGET_DEADLINE") or None)
    mission_target: float | None = field(default_factory=lambda: float(os.environ["MISSION_TARGET_AMOUNT"]) if os.getenv("MISSION_TARGET_AMOUNT") else None)
    mission_currency: str = field(default_factory=lambda: os.getenv("MISSION_TARGET_CURRENCY", "USD").upper())
    mission_deadline: str | None = field(default_factory=lambda: os.getenv("MISSION_TARGET_DEADLINE") or None)
    hourly_target: float | None = field(default_factory=lambda: float(os.environ["HOURLY_REVENUE_TARGET"]) if os.getenv("HOURLY_REVENUE_TARGET") else None)
    hourly_target_currency: str = field(default_factory=lambda: os.getenv("HOURLY_REVENUE_TARGET_CURRENCY", "USD").upper())
    hourly_target_start: str = field(default_factory=lambda: os.getenv("HOURLY_REVENUE_TARGET_START", ""))
    hourly_target_deadline: str | None = field(default_factory=lambda: os.getenv("HOURLY_REVENUE_TARGET_DEADLINE") or None)
    daily_upkeep: float = field(default_factory=lambda: max(0.0, float(os.getenv("DAILY_UPKEEP_USD", "0"))))
    daily_upkeep_currency: str = field(default_factory=lambda: os.getenv("DAILY_UPKEEP_CURRENCY", "USD").upper())

    def __post_init__(self):
        if self.capital_target is not None and self.capital_target <= 0:
            raise ValueError("CAPITAL_TARGET_AMOUNT must be greater than zero")
        if self.mission_target is not None and self.mission_target <= 0:
            raise ValueError("MISSION_TARGET_AMOUNT must be greater than zero")
        if len(self.capital_currency) != 3 or len(self.mission_currency) != 3:
            raise ValueError("target currencies must be 3-letter currency codes")
        if self.hourly_target is not None and self.hourly_target <= 0:
            raise ValueError("HOURLY_REVENUE_TARGET must be greater than zero")
        if len(self.hourly_target_currency) != 3:
            raise ValueError("HOURLY_REVENUE_TARGET_CURRENCY must be a 3-letter currency code")

    def enabled_providers(self) -> dict[str, bool]:
        names = ("OPENROUTER", "OPENAI", "GROQ", "XAI", "GEMINI", "NVIDIA", "GAMMA")
        return {name.lower(): bool(os.getenv(f"{name}_API_KEY")) for name in names}
