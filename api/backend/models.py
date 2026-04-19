from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    api_keys = relationship("ApiKey", back_populates="owner")

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)  # User's custom nickname for the key
    provider = Column(String)  # e.g., "openai", "gemini", "huggingface"
    masked_key = Column(String) # E.g. "sk-...1234"
    encrypted_key = Column(String) # For now, we will store plaintext or simple encryption. In a real highly secure prod app, use a KMS. Since it's local, raw token can be stored or simple symmetic encrypt. Let's start with raw token but named `key_value`
    key_value = Column(String) 
    
    status = Column(String, default="Unknown") # "Active", "Invalid", "Suspended"
    last_checked = Column(DateTime, default=datetime.datetime.utcnow)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="api_keys")
    usage_logs = relationship("UsageLog", back_populates="api_key", cascade="all, delete-orphan")

class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"))
    tokens_used = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    api_key = relationship("ApiKey", back_populates="usage_logs")
