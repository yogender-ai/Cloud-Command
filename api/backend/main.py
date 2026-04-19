from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
import httpx
from typing import List

import models, schemas, database, auth

import random
from sqlalchemy import func

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Secure API Key Monitor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for easier deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("username")
        if username is None:
            raise credentials_exception
    except auth.JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user


async def check_api_key_validity(provider: str, key: str) -> str:
    """Async function to validate key against actual API providers."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if provider.lower() == "openai":
                r = await client.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {key}"})
                if r.status_code == 200: return "Active"
                elif r.status_code == 401: return "Invalid"
                elif r.status_code == 429: return "Suspended/RateLimited"
                
            elif provider.lower() == "anthropic":
                r = await client.get("https://api.anthropic.com/v1/models", headers={"x-api-key": key, "anthropic-version": "2023-06-01"})
                if r.status_code == 200: return "Active"
                elif r.status_code == 401: return "Invalid"
                elif r.status_code == 403: return "Suspended"
                
            elif provider.lower() == "huggingface":
                r = await client.get("https://huggingface.co/api/whoami-v2", headers={"Authorization": f"Bearer {key}"})
                if r.status_code == 200: return "Active"
                elif r.status_code == 401: return "Invalid"
                
            elif provider.lower() == "gemini":
                r = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
                if r.status_code == 200: return "Active"
                elif r.status_code in [400, 403]: return "Invalid"
                
            elif provider.lower() == "deepseek":
                r = await client.get("https://api.deepseek.com/models", headers={"Authorization": f"Bearer {key}"})
                if r.status_code == 200: return "Active"
                elif r.status_code == 401: return "Invalid"
                elif r.status_code == 402: return "Insufficient Balance"
                
            return "Unknown/Unsupported"
    except Exception as e:
        return f"Error: {str(e)}"
    return "Error"


@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"username": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/keys", response_model=list[schemas.ApiKeyResponse])
def get_keys(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    keys = db.query(models.ApiKey).filter(models.ApiKey.owner_id == current_user.id).all()
    return keys

@app.get("/usage/summary", response_model=schemas.DashboardSummary)
def get_usage_summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user_keys = db.query(models.ApiKey).filter(models.ApiKey.owner_id == current_user.id).all()
    key_ids = [k.id for k in user_keys]
    
    total_keys = len(user_keys)
    active_keys = len([k for k in user_keys if "active" in k.status.lower()])
    
    # Get tokens today
    today = datetime.utcnow().date()
    tokens_today = db.query(func.sum(models.UsageLog.tokens_used))\
        .filter(models.UsageLog.api_key_id.in_(key_ids))\
        .filter(func.date(models.UsageLog.timestamp) == today).scalar() or 0
        
    # Get last 7 days history
    history = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        day_tokens = db.query(func.sum(models.UsageLog.tokens_used))\
            .filter(models.UsageLog.api_key_id.in_(key_ids))\
            .filter(func.date(models.UsageLog.timestamp) == day).scalar() or 0
        history.append({"date": day_str, "total_tokens": day_tokens})
        
    return {
        "total_keys": total_keys,
        "active_keys": active_keys,
        "tokens_today": tokens_today,
        "usage_history": history
    }

@app.get("/keys/{key_id}/usage", response_model=List[schemas.UsageLogResponse])
def get_key_usage(key_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_key = db.query(models.ApiKey).filter(models.ApiKey.id == key_id, models.ApiKey.owner_id == current_user.id).first()
    if not db_key:
        raise HTTPException(status_code=404, detail="Key not found")
    return db_key.usage_logs

def log_simulated_usage(db: Session, api_key_id: int):
    # Simulate some usage for the demo
    usage = models.UsageLog(
        api_key_id=api_key_id,
        tokens_used=random.randint(100, 5000),
        timestamp=datetime.utcnow()
    )
    db.add(usage)
    db.commit()

@app.post("/keys", response_model=schemas.ApiKeyResponse)
async def create_key(key_in: schemas.ApiKeyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    masked = key_in.key_value[:6] + "..." + key_in.key_value[-4:] if len(key_in.key_value) > 10 else "***"
    status_str = await check_api_key_validity(key_in.provider, key_in.key_value)
    
    new_key = models.ApiKey(
        name=key_in.name,
        provider=key_in.provider,
        key_value=key_in.key_value,
        masked_key=masked,
        status=status_str,
        owner_id=current_user.id
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    if "active" in status_str.lower():
        log_simulated_usage(db, new_key.id)
        
    return new_key

@app.delete("/keys/{key_id}")
def delete_key(key_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_key = db.query(models.ApiKey).filter(models.ApiKey.id == key_id, models.ApiKey.owner_id == current_user.id).first()
    if not db_key:
         raise HTTPException(status_code=404, detail="Key not found")
    db.delete(db_key)
    db.commit()
    return {"ok": True}

@app.post("/keys/{key_id}/check", response_model=schemas.ApiKeyResponse)
async def recheck_key(key_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_key = db.query(models.ApiKey).filter(models.ApiKey.id == key_id, models.ApiKey.owner_id == current_user.id).first()
    if not db_key:
         raise HTTPException(status_code=404, detail="Key not found")
         
    status_str = await check_api_key_validity(db_key.provider, db_key.key_value)
    db_key.status = status_str
    db_key.last_checked = datetime.utcnow()
    
    if "active" in status_str.lower():
        log_simulated_usage(db, key_id)
        
    db.commit()
    db.refresh(db_key)
    return db_key
