from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ──────────────────────────────────────
# AUTH
# ──────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    email: str
    notification_email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────
# MONITORS
# ──────────────────────────────────────
class MonitorCreate(BaseModel):
    url: str
    name: str
    category: Optional[str] = None
    interval_seconds: int = 60

class MonitorUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    clear_category: bool = False  # set True to explicitly clear to null

class MonitorResponse(BaseModel):
    id: int
    url: str
    name: str
    category: Optional[str] = None
    interval_seconds: int
    status: str
    last_checked: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MonitorLogResponse(BaseModel):
    id: int
    monitor_id: int
    status: str
    latency: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────
# API KEYS
# ──────────────────────────────────────
class ApiKeyCreate(BaseModel):
    name: str
    provider: str
    category: Optional[str] = None
    key_value: str  # plaintext, will be encrypted server-side

class ApiKeyResponse(BaseModel):
    id: int
    name: str
    provider: str
    category: Optional[str] = None
    masked_key: str
    status: str
    last_checked: datetime
    created_at: datetime
    tokens_used: int = 0

    class Config:
        from_attributes = True

class ApiKeyUsageResponse(BaseModel):
    id: int
    api_key_id: int
    tokens_used: int
    timestamp: datetime

    class Config:
        from_attributes = True

class ApiKeySummary(BaseModel):
    total_keys: int
    active_keys: int
    tokens_today: int
    usage_history: List[dict]


# ──────────────────────────────────────
# PLATFORM ACCOUNTS (Render / Vercel)
# ──────────────────────────────────────
class PlatformAccountCreate(BaseModel):
    provider: str  # "render" or "vercel"
    account_name: str
    category: Optional[str] = None
    api_token: str  # plaintext, will be encrypted server-side

class PlatformAccountResponse(BaseModel):
    id: int
    provider: str
    account_name: str
    category: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────
# SETTINGS
# ──────────────────────────────────────
class NotificationEmailRequest(BaseModel):
    email: EmailStr

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    code: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class VaultOtpVerify(BaseModel):
    code: str


# ──────────────────────────────────────
# ANALYTICS
# ──────────────────────────────────────
class VisitResponse(BaseModel):
    date: str
    visits: int
