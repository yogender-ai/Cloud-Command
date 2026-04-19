from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ApiKeyBase(BaseModel):
    name: str
    provider: str
    key_value: str

class ApiKeyCreate(ApiKeyBase):
    pass

class ApiKeyResponse(BaseModel):
    id: int
    name: str
    provider: str
    masked_key: str
    status: str
    last_checked: datetime
    
    class Config:
        orm_mode = True

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str
    
class TokenData(BaseModel):
    username: Optional[str] = None

class UsageLogResponse(BaseModel):
    id: int
    api_key_id: int
    tokens_used: int
    timestamp: datetime

    class Config:
        orm_mode = True

class UsageSummary(BaseModel):
    date: str
    total_tokens: int

class DashboardSummary(BaseModel):
    total_keys: int
    active_keys: int
    tokens_today: int
    usage_history: List[UsageSummary]
