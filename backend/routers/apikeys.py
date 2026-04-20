from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta, timezone
import random
import string

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


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


# ── Vault OTP endpoints ──

@router.post("/request-view-otp")
def request_vault_otp(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Send OTP to user's verified email to unlock the API Vault."""
    alert_email = user.notification_email
    if not alert_email:
        raise HTTPException(
            status_code=400,
            detail="No verified email found. Please verify an email in Settings first.",
        )

    code = _generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    otp = models.OTP(user_id=user.id, email=alert_email, code=code, expires_at=expires)
    db.add(otp)
    db.commit()

    try:
        from services.mailer import send_otp_email
        send_otp_email(alert_email, code, purpose="vault")
    except Exception as e:
        print(f"Vault OTP email failed: {e}")

    masked = alert_email[:3] + "***" + alert_email[alert_email.index("@"):]
    return {"message": f"OTP sent to {masked}"}


@router.post("/verify-view-otp")
def verify_vault_otp(
    req: schemas.VaultOtpVerify,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Verify OTP and authorize vault access for this session."""
    alert_email = user.notification_email
    if not alert_email:
        raise HTTPException(status_code=400, detail="No verified email found.")

    otp = (
        db.query(models.OTP)
        .filter(
            models.OTP.user_id == user.id,
            models.OTP.email == alert_email,
            models.OTP.code == req.code,
            models.OTP.expires_at > datetime.now(timezone.utc),
        )
        .order_by(models.OTP.created_at.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    db.delete(otp)
    db.commit()
    return {"authorized": True}


# ── Standard CRUD ──

@router.get("", response_model=List[schemas.ApiKeyResponse])
def list_keys(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """List all API keys for the current user."""
    keys = (
        db.query(models.ApiKey)
        .filter(models.ApiKey.user_id == user.id)
        .order_by(models.ApiKey.created_at.desc())
        .all()
    )
    for k in keys:
        k.tokens_used = (
            db.query(func.sum(models.ApiUsageLog.tokens_used))
            .filter(models.ApiUsageLog.api_key_id == k.id)
            .scalar()
        ) or 0
    return keys


@router.post("", response_model=schemas.ApiKeyResponse, status_code=201)
async def create_key(
    req: schemas.ApiKeyCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Add and validate a new API key (encrypted with Fernet AES)."""
    # Require verified notification email
    if not user.notification_email:
        raise HTTPException(
            status_code=403,
            detail="You must verify an email address in Settings before adding API keys.",
        )

    count = db.query(models.ApiKey).filter(models.ApiKey.user_id == user.id).count()
    if count >= settings.MAX_API_KEYS_PER_USER:
        raise HTTPException(status_code=403, detail=f"API key limit reached ({settings.MAX_API_KEYS_PER_USER})")

    # Validate key against provider
    status_str = await check_api_key_validity(req.provider, req.key_value)
    masked = _mask_key(req.key_value)

    api_key = models.ApiKey(
        user_id=user.id,
        name=req.name,
        provider=req.provider.lower(),
        category=req.category,
        encrypted_key=encrypt_value(req.key_value),
        masked_key=masked,
        status=status_str,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    # Email notification
    try:
        from services.mailer import send_api_key_email
        alert_to = user.notification_email or user.email
        send_api_key_email(
            to=alert_to,
            action="added",
            key_name=req.name,
            provider=req.provider,
            masked_key=masked,
        )
    except Exception as e:
        print(f"API key add email failed: {e}")

    api_key.tokens_used = 0
    return api_key


@router.patch("/{key_id}", response_model=schemas.ApiKeyResponse)
def update_key(
    key_id: int,
    req: schemas.MonitorUpdate,  # reuse: name + category + clear_category
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Update name and/or category of an existing API key."""
    key = (
        db.query(models.ApiKey)
        .filter(models.ApiKey.id == key_id, models.ApiKey.user_id == user.id)
        .first()
    )
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    if req.name is not None:
        key.name = req.name
    if req.category is not None:
        key.category = req.category
    elif req.clear_category:
        key.category = None
    db.commit()
    db.refresh(key)
    key.tokens_used = (
        db.query(func.sum(models.ApiUsageLog.tokens_used))
        .filter(models.ApiUsageLog.api_key_id == key.id)
        .scalar()
    ) or 0
    return key


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

    key_name = key.name
    provider = key.provider
    masked = key.masked_key
    db.delete(key)
    db.commit()

    # Email notification
    try:
        from services.mailer import send_api_key_email
        alert_to = user.notification_email or user.email
        send_api_key_email(
            to=alert_to,
            action="deleted",
            key_name=key_name,
            provider=provider,
            masked_key=masked,
        )
    except Exception as e:
        print(f"API key delete email failed: {e}")


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
    key.tokens_used = (
        db.query(func.sum(models.ApiUsageLog.tokens_used))
        .filter(models.ApiUsageLog.api_key_id == key.id)
        .scalar()
    ) or 0
    return key


@router.get("/summary", response_model=schemas.ApiKeySummary)
def get_summary(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get API key usage summary for the dashboard."""
    keys = db.query(models.ApiKey).filter(models.ApiKey.user_id == user.id).all()
    key_ids = [k.id for k in keys]

    total = len(keys)
    active = len([k for k in keys if "active" in k.status.lower()])

    today = datetime.now().date()  # User expects local local dashboard date
    tokens_today = (
        db.query(func.sum(models.ApiUsageLog.tokens_used))
        .filter(
            models.ApiUsageLog.api_key_id.in_(key_ids),
            func.date(models.ApiUsageLog.timestamp) == today,
        )
        .scalar()
    ) or 0

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
