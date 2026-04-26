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


# ────────────────────────────────────────
# SCHEDULED JOBS
# ────────────────────────────────────────
class ScheduledJobCreate(BaseModel):
    name: str
    url: str
    method: str = "POST"
    category: Optional[str] = None
    interval_seconds: int = 900
    timeout_seconds: int = 60
    body_json: Optional[str] = None
    header_name: Optional[str] = None
    header_value: Optional[str] = None
    is_enabled: bool = True


class ScheduledJobUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    method: Optional[str] = None
    category: Optional[str] = None
    interval_seconds: Optional[int] = None
    timeout_seconds: Optional[int] = None
    body_json: Optional[str] = None
    header_name: Optional[str] = None
    header_value: Optional[str] = None
    is_enabled: Optional[bool] = None
    clear_header: bool = False
    clear_category: bool = False


class ScheduledJobResponse(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    url: str
    method: str
    interval_seconds: int
    timeout_seconds: int
    body_json: Optional[str] = None
    header_name: Optional[str] = None
    is_enabled: bool
    status: str
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    last_status_code: Optional[int] = None
    last_latency_ms: Optional[int] = None
    last_error: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduledJobLogResponse(BaseModel):
    id: int
    job_id: int
    status: str
    status_code: Optional[int] = None
    latency_ms: Optional[int] = None
    error_message: Optional[str] = None
    response_preview: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────
# API KEYS
# ──────────────────────────────────────
class ApiKeyCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    name: str
    provider: str
    category: Optional[str] = None
    model_name: Optional[str] = None
    daily_request_limit: Optional[int] = None
    daily_token_limit: Optional[int] = None
    key_value: str  # plaintext, will be encrypted server-side

class ApiKeyUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}
    name: Optional[str] = None
    category: Optional[str] = None
    model_name: Optional[str] = None
    daily_request_limit: Optional[int] = None
    daily_token_limit: Optional[int] = None
    clear_category: bool = False
    clear_model_name: bool = False
    clear_limits: bool = False

class ApiKeyResponse(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}
    id: int
    name: str
    provider: str
    category: Optional[str] = None
    model_name: Optional[str] = None
    daily_request_limit: Optional[int] = None
    daily_token_limit: Optional[int] = None
    masked_key: str
    status: str
    last_checked: datetime
    created_at: datetime
    tokens_used: int = 0

class ApiKeyUsageResponse(BaseModel):
    id: int
    api_key_id: int
    api_key_name: Optional[str] = None
    tokens_used: int
    timestamp: datetime
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class ApiUsageResponse(BaseModel):
    total_keys: int
    active_keys: int
    tokens_today: int
    requests_today: int
    errors_today: int
    usage_history: List[dict]
    per_key: List[dict]
    key_groups: List["ApiKeyGroupResponse"]
    recent_errors: List[dict] = []

# ──────────────────────────────────────
# GATEWAY API KEYS (Cloud Command Keys)
# ──────────────────────────────────────
class GatewayApiKeyCreate(BaseModel):
    name: str

class GatewayApiKeyResponse(BaseModel):
    id: int
    name: str
    prefix: str
    last_used_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class GatewayApiKeyRevealResponse(GatewayApiKeyResponse):
    key_value: str  # The plaintext token (only returned once upon creation)


# ──────────────────────────────────────
# API KEY GROUPS
# ──────────────────────────────────────
class ApiKeyGroupMemberCreate(BaseModel):
    api_key_id: int
    priority: int = 0
    is_enabled: bool = True

class ApiKeyGroupMemberResponse(BaseModel):
    id: int
    api_key_id: int
    key_name: Optional[str] = None
    provider: Optional[str] = None
    masked_key: Optional[str] = None
    status: Optional[str] = None
    priority: int
    is_enabled: bool

    class Config:
        from_attributes = True

class ApiKeyGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    strategy: str = "round-robin"  # round-robin, fallback, random
    member_ids: Optional[List[int]] = None  # API key IDs to add initially

class ApiKeyGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    strategy: Optional[str] = None

class ApiKeyGroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    strategy: str
    members: List[ApiKeyGroupMemberResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


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
