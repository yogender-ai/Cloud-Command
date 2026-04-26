from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float,
    ForeignKey, DateTime, Date, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


def utcnow():
    return datetime.now(timezone.utc)


# ──────────────────────────────────────
# USERS
# ──────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)  # Argon2id hash
    notification_email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    monitors = relationship("Monitor", back_populates="owner", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="owner", cascade="all, delete-orphan")
    api_key_groups = relationship("ApiKeyGroup", back_populates="owner", cascade="all, delete-orphan")
    gateway_keys = relationship("GatewayApiKey", back_populates="owner", cascade="all, delete-orphan")
    platform_accounts = relationship("PlatformAccount", back_populates="owner", cascade="all, delete-orphan")


# ──────────────────────────────────────
# CLOUD COMMAND GATEWAY KEYS
# ──────────────────────────────────────
class GatewayApiKey(Base):
    __tablename__ = "gateway_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)  # e.g., "News-Intel Production"
    key_hash = Column(String(255), unique=True, index=True, nullable=False)  # SHA-256 hash of the token
    prefix = Column(String(20), nullable=False)  # e.g., "cc-sk-..." for UI display
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    owner = relationship("User", back_populates="gateway_keys")


# ──────────────────────────────────────
# OTP (email verification)
# ──────────────────────────────────────
class OTP(Base):
    __tablename__ = "otps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    email = Column(String(255), nullable=False)
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ──────────────────────────────────────
# SITE MONITORING
# ──────────────────────────────────────
class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    url = Column(String(500), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)  # e.g. Production, Staging, Client
    interval_seconds = Column(Integer, default=60)
    status = Column(String(50), default="UP")
    last_checked = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    owner = relationship("User", back_populates="monitors")
    logs = relationship("MonitorLog", back_populates="monitor", cascade="all, delete-orphan")


class MonitorLog(Base):
    __tablename__ = "monitor_logs"

    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False)
    latency = Column(Integer, nullable=True)  # ms
    created_at = Column(DateTime(timezone=True), default=utcnow)

    monitor = relationship("Monitor", back_populates="logs")


# ──────────────────────────────────────
# API KEY MANAGEMENT
# ──────────────────────────────────────
class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)  # User's nickname
    provider = Column(String(100), nullable=False)  # openai, anthropic, gemini, etc.
    model_name = Column(String(255), nullable=True)  # e.g., gemini-1.5-pro
    category = Column(String(100), nullable=True)  # e.g. AI, Dev Tools, Infrastructure (used as Label/Role)
    encrypted_key = Column(Text, nullable=False)  # Fernet-encrypted
    masked_key = Column(String(100), nullable=False)  # e.g. "sk-...1234"
    status = Column(String(100), default="Unknown")  # Active, Invalid, Suspended
    daily_request_limit = Column(Integer, nullable=True) # Max requests per day
    daily_token_limit = Column(Integer, nullable=True) # Max tokens per day
    last_checked = Column(DateTime(timezone=True), default=utcnow)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    owner = relationship("User", back_populates="api_keys")
    usage_logs = relationship("ApiUsageLog", back_populates="api_key", cascade="all, delete-orphan")


class ApiUsageLog(Base):
    __tablename__ = "api_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=False)
    api_key_name = Column(String(255), nullable=True)  # Denormalized for per-key chart display
    tokens_used = Column(Integer, default=0)
    status_code = Column(Integer, default=200)
    is_error = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow)

    api_key = relationship("ApiKey", back_populates="usage_logs")


# ──────────────────────────────────────
# PLATFORM ACCOUNTS (Render / Vercel)
# ──────────────────────────────────────
class PlatformAccount(Base):
    __tablename__ = "platform_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # "render" or "vercel"
    account_name = Column(String(255), nullable=False)  # User-given label
    category = Column(String(100), nullable=True)  # e.g. Production, Client, Personal
    encrypted_token = Column(Text, nullable=False)  # Fernet-encrypted
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    owner = relationship("User", back_populates="platform_accounts")


# ──────────────────────────────────────
# ANALYTICS
# ──────────────────────────────────────
class PlatformVisit(Base):
    __tablename__ = "platform_visits"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, unique=True)
    visits = Column(Integer, default=1)


class MonitorVisit(Base):
    __tablename__ = "monitor_visits"

    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    hour = Column(Integer, nullable=False)
    visits = Column(Integer, default=1)

    __table_args__ = (
        UniqueConstraint("monitor_id", "date", "hour", name="uq_monitor_date_hour"),
    )


# ────────────────────────────────────────
# SCHEDULED HTTP JOBS
# ────────────────────────────────────────
class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    url = Column(String(1000), nullable=False)
    method = Column(String(10), default="POST")
    interval_seconds = Column(Integer, default=900)
    timeout_seconds = Column(Integer, default=60)
    body_json = Column(Text, nullable=True)
    header_name = Column(String(255), nullable=True)
    encrypted_header_value = Column(Text, nullable=True)
    is_enabled = Column(Boolean, default=True)
    status = Column(String(50), default="PENDING")
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), default=utcnow)
    last_status_code = Column(Integer, nullable=True)
    last_latency_ms = Column(Integer, nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    owner = relationship("User")
    logs = relationship("ScheduledJobLog", back_populates="job", cascade="all, delete-orphan")


class ScheduledJobLog(Base):
    __tablename__ = "scheduled_job_logs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("scheduled_jobs.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False)
    status_code = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    response_preview = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    job = relationship("ScheduledJob", back_populates="logs")


# ──────────────────────────────────────
# API KEY GROUPS (bundled key management)
# ──────────────────────────────────────
class ApiKeyGroup(Base):
    __tablename__ = "api_key_groups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)  # e.g. "News-Intel Keys"
    description = Column(Text, nullable=True)
    strategy = Column(String(50), default="round-robin")  # round-robin, fallback, random
    created_at = Column(DateTime(timezone=True), default=utcnow)

    owner = relationship("User", back_populates="api_key_groups")
    members = relationship("ApiKeyGroupMember", back_populates="group", cascade="all, delete-orphan")


class ApiKeyGroupMember(Base):
    __tablename__ = "api_key_group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("api_key_groups.id", ondelete="CASCADE"), nullable=False)
    api_key_id = Column(Integer, ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=False)
    priority = Column(Integer, default=0)  # Lower = higher priority (for fallback mode)
    is_enabled = Column(Boolean, default=True)

    group = relationship("ApiKeyGroup", back_populates="members")
    api_key = relationship("ApiKey")
