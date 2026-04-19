from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta, timezone

import models
import schemas
from dependencies import get_db, get_current_user
from security import encrypt_value, decrypt_value
from config import settings
from services.api_validator import check_api_key_validity

router = APIRouter(prefix="/api/apikeys", tags=["api-keys"])


def _mask_key(key: str) -> str:
    """Create a masked representation of an API key."""
    if len(key) > 10:
        return key[:6] + "..." + key[-4:]
    return "***"


@router.get("", response_model=List[schemas.ApiKeyResponse])
def list_keys(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """List all API keys for the current user."""
    return (
        db.query(models.ApiKey)
        .filter(models.ApiKey.user_id == user.id)
        .order_by(models.ApiKey.created_at.desc())
        .all()
    )


@router.post("", response_model=schemas.ApiKeyResponse, status_code=201)
async def create_key(
    req: schemas.ApiKeyCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Add and validate a new API key (encrypted with Fernet AES)."""
    count = db.query(models.ApiKey).filter(models.ApiKey.user_id == user.id).count()
    if count >= settings.MAX_API_KEYS_PER_USER:
        raise HTTPException(status_code=403, detail=f"API key limit reached ({settings.MAX_API_KEYS_PER_USER})")

    # Validate key against provider
    status_str = await check_api_key_validity(req.provider, req.key_value)

    api_key = models.ApiKey(
        user_id=user.id,
        name=req.name,
        provider=req.provider.lower(),
        encrypted_key=encrypt_value(req.key_value),
        masked_key=_mask_key(req.key_value),
        status=status_str,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return api_key


@router.delete("/{key_id}", status_code=204)
def delete_key(
    key_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Delete an API key owned by the current user."""
    key = (
        db.query(models.ApiKey)
        .filter(models.ApiKey.id == key_id, models.ApiKey.user_id == user.id)
        .first()
    )
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    db.delete(key)
    db.commit()


@router.post("/{key_id}/check", response_model=schemas.ApiKeyResponse)
async def recheck_key(
    key_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Re-validate an API key against its provider."""
    key = (
        db.query(models.ApiKey)
        .filter(models.ApiKey.id == key_id, models.ApiKey.user_id == user.id)
        .first()
    )
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    plaintext = decrypt_value(key.encrypted_key)
    status_str = await check_api_key_validity(key.provider, plaintext)

    key.status = status_str
    key.last_checked = datetime.now(timezone.utc)
    db.commit()
    db.refresh(key)
    return key


@router.get("/summary", response_model=schemas.ApiKeySummary)
def get_summary(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get API key usage summary for the dashboard."""
    keys = db.query(models.ApiKey).filter(models.ApiKey.user_id == user.id).all()
    key_ids = [k.id for k in keys]

    total = len(keys)
    active = len([k for k in keys if "active" in k.status.lower()])

    today = datetime.now(timezone.utc).date()
    tokens_today = (
        db.query(func.sum(models.ApiUsageLog.tokens_used))
        .filter(
            models.ApiUsageLog.api_key_id.in_(key_ids),
            func.date(models.ApiUsageLog.timestamp) == today,
        )
        .scalar()
    ) or 0

    # Last 7 days history
    history = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_tokens = (
            db.query(func.sum(models.ApiUsageLog.tokens_used))
            .filter(
                models.ApiUsageLog.api_key_id.in_(key_ids),
                func.date(models.ApiUsageLog.timestamp) == day,
            )
            .scalar()
        ) or 0
        history.append({"date": day.isoformat(), "total_tokens": day_tokens})

    return {
        "total_keys": total,
        "active_keys": active,
        "tokens_today": tokens_today,
        "usage_history": history,
    }


@router.get("/{key_id}/usage", response_model=List[schemas.ApiKeyUsageResponse])
def get_key_usage(
    key_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get usage logs for a specific API key."""
    key = (
        db.query(models.ApiKey)
        .filter(models.ApiKey.id == key_id, models.ApiKey.user_id == user.id)
        .first()
    )
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    return (
        db.query(models.ApiUsageLog)
        .filter(models.ApiUsageLog.api_key_id == key_id)
        .order_by(models.ApiUsageLog.timestamp.desc())
        .limit(100)
        .all()
    )
