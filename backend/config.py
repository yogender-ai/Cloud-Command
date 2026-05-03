import os
from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./cloud_command.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "CHANGE-ME-IN-PRODUCTION")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")
    GATEWAY_SECRET: str = os.getenv("GATEWAY_SECRET", "super-secret-gateway-token-123")

    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    MAIL_FROM_EMAIL: str = os.getenv("MAIL_FROM_EMAIL", "onboarding@resend.dev")
    MAIL_FROM_NAME: str = os.getenv("MAIL_FROM_NAME", "Cloud Command")

    RENDER_EXTERNAL_URL: str = os.getenv("RENDER_EXTERNAL_URL", "")
    GATEWAY_PUBLIC_URL: str = os.getenv(
        "GATEWAY_PUBLIC_URL",
        os.getenv("RENDER_EXTERNAL_URL", "https://cloud-command.onrender.com"),
    ).rstrip("/")
    HF_SPACE_ALIASES_JSON: str = os.getenv("HF_SPACE_ALIASES_JSON", "")

    ENABLE_BACKGROUND_PINGER: bool = _env_bool("ENABLE_BACKGROUND_PINGER", True)
    ENABLE_SCHEDULED_JOBS: bool = _env_bool("ENABLE_SCHEDULED_JOBS", True)
    ENABLE_SELF_PING: bool = _env_bool("ENABLE_SELF_PING", False)
    MIN_MONITOR_INTERVAL_SECONDS: int = int(os.getenv("MIN_MONITOR_INTERVAL_SECONDS", "300"))
    MONITOR_LOG_RETENTION_PER_MONITOR: int = int(os.getenv("MONITOR_LOG_RETENTION_PER_MONITOR", "500"))

    # Limits
    MAX_MONITORS_PER_USER: int = 20
    MAX_API_KEYS_PER_USER: int = 50
    MAX_PLATFORM_ACCOUNTS_PER_USER: int = 10  # per provider (Render/Vercel)


settings = Settings()
