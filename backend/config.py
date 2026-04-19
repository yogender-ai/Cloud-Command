import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./cloud_command.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "CHANGE-ME-IN-PRODUCTION")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

    SMTP_EMAIL: str = os.getenv("SMTP_EMAIL", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")

    RENDER_EXTERNAL_URL: str = os.getenv("RENDER_EXTERNAL_URL", "")

    # Limits
    MAX_MONITORS_PER_USER: int = 20
    MAX_API_KEYS_PER_USER: int = 50
    MAX_PLATFORM_ACCOUNTS_PER_USER: int = 10  # per provider (Render/Vercel)


settings = Settings()
