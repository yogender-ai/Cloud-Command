from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
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
    if not keys:
        return keys
    key_ids = [k.id for k in keys]
    # Single aggregate query instead of N separate queries
    token_sums = db.query(
        models.ApiUsageLog.api_key_id,
        func.coalesce(func.sum(models.ApiUsageLog.tokens_used), 0),
    ).filter(
        models.ApiUsageLog.api_key_id.in_(key_ids),
    ).group_by(models.ApiUsageLog.api_key_id).all()
    token_map = {row[0]: int(row[1]) for row in token_sums}
    for k in keys:
        k.tokens_used = token_map.get(k.id, 0)
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
        model_name=req.model_name,
        daily_request_limit=req.daily_request_limit,
        daily_token_limit=req.daily_token_limit,
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
    req: schemas.ApiKeyUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Update properties of an existing API key."""
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
        
    if req.model_name is not None:
        key.model_name = req.model_name
    elif req.clear_model_name:
        key.model_name = None
        
    if req.daily_request_limit is not None:
        key.daily_request_limit = req.daily_request_limit
    elif req.clear_limits:
        key.daily_request_limit = None
        
    if req.daily_token_limit is not None:
        key.daily_token_limit = req.daily_token_limit
    elif req.clear_limits:
        key.daily_token_limit = None

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


@router.get("/summary")
def get_summary(
    time_range: str = Query("7d", alias="range"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get API key usage summary — optimized with SQL-level aggregation."""
    keys = db.query(models.ApiKey).filter(models.ApiKey.user_id == user.id).all()
    key_ids = [k.id for k in keys]
    key_name_map = {k.id: k.name for k in keys}

    total = len(keys)
    active = len([k for k in keys if "active" in (k.status or "").lower()])

    now = datetime.now()
    today = now.date()

    if not key_ids:
        return {
            "total_keys": total, "active_keys": active,
            "tokens_today": 0, "requests_today": 0, "errors_today": 0,
            "usage_history": [], "per_key": [],
            "key_groups": [], "recent_errors": [],
        }

    # ── Today's totals (single aggregate query) ──
    today_agg = db.query(
        func.coalesce(func.sum(models.ApiUsageLog.tokens_used), 0),
        func.count(models.ApiUsageLog.id),
        func.coalesce(func.sum(case((models.ApiUsageLog.is_error == True, 1), else_=0)), 0),
    ).filter(
        models.ApiUsageLog.api_key_id.in_(key_ids),
        func.date(models.ApiUsageLog.timestamp) == today,
    ).first()
    tokens_today = int(today_agg[0])
    requests_today = int(today_agg[1])
    errors_today = int(today_agg[2])

    # ── History (single aggregate query with GROUP BY) ──
    if time_range in ("1h", "1d"):
        cutoff_dt = now - (timedelta(hours=1) if time_range == "1h" else timedelta(hours=24))
        history = _build_history_recent(db, key_ids, keys, key_name_map, cutoff_dt, now,
                                        "minute" if time_range == "1h" else "hour")
    else:
        days_map = {"1m": 30, "1y": 365, "all": 90, "7d": 7}
        cutoff_date = today - timedelta(days=days_map.get(time_range, 7))
        history = _build_history_daily(db, key_ids, keys, key_name_map, cutoff_date, today)

    # ── Per-key breakdown (2 aggregate queries instead of 4×N) ──
    per_key_agg = db.query(
        models.ApiUsageLog.api_key_id,
        func.coalesce(func.sum(models.ApiUsageLog.tokens_used), 0),
        func.count(models.ApiUsageLog.id),
        func.coalesce(func.sum(case((models.ApiUsageLog.is_error == True, 1), else_=0)), 0),
    ).filter(
        models.ApiUsageLog.api_key_id.in_(key_ids),
    ).group_by(models.ApiUsageLog.api_key_id).all()
    per_key_totals = {r[0]: {"tokens": int(r[1]), "requests": int(r[2]), "errors": int(r[3])} for r in per_key_agg}

    per_key_today_q = db.query(
        models.ApiUsageLog.api_key_id,
        func.coalesce(func.sum(models.ApiUsageLog.tokens_used), 0),
        func.count(models.ApiUsageLog.id),
    ).filter(
        models.ApiUsageLog.api_key_id.in_(key_ids),
        func.date(models.ApiUsageLog.timestamp) == today,
    ).group_by(models.ApiUsageLog.api_key_id).all()
    per_key_today_map = {r[0]: {"tokens": int(r[1]), "requests": int(r[2])} for r in per_key_today_q}

    per_key = []
    for k in keys:
        totals = per_key_totals.get(k.id, {"tokens": 0, "requests": 0, "errors": 0})
        td = per_key_today_map.get(k.id, {"tokens": 0, "requests": 0})
        per_key.append({
            "id": k.id, "name": k.name, "provider": k.provider,
            "category": k.category, "model_name": k.model_name,
            "daily_request_limit": k.daily_request_limit,
            "daily_token_limit": k.daily_token_limit,
            "masked_key": k.masked_key,
            "total_tokens": totals["tokens"], "total_requests": totals["requests"],
            "failed_requests": totals["errors"],
            "today_tokens": td["tokens"], "today_requests": td["requests"],
        })

    # ── Key groups ──
    groups = db.query(models.ApiKeyGroup).filter(models.ApiKeyGroup.user_id == user.id).all()
    groups_data = []
    for g in groups:
        members_data = [{
            "id": m.id, "api_key_id": m.api_key_id,
            "key_name": m.api_key.name if m.api_key else None,
            "provider": m.api_key.provider if m.api_key else None,
            "masked_key": m.api_key.masked_key if m.api_key else None,
            "status": m.api_key.status if m.api_key else None,
            "priority": m.priority, "is_enabled": m.is_enabled,
        } for m in sorted(g.members, key=lambda x: x.priority)]
        groups_data.append({
            "id": g.id, "name": g.name, "description": g.description,
            "strategy": g.strategy, "members": members_data,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })

    # ── Recent errors ──
    recent_errors_q = (
        db.query(models.ApiUsageLog)
        .filter(models.ApiUsageLog.api_key_id.in_(key_ids), models.ApiUsageLog.is_error == True)
        .order_by(models.ApiUsageLog.timestamp.desc()).limit(20).all()
    )
    recent_errors_data = [{
        "id": e.id,
        "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        "key_name": next((x.name for x in keys if x.id == e.api_key_id), e.api_key_name),
        "provider": next((x.provider for x in keys if x.id == e.api_key_id), None),
        "status_code": e.status_code, "error_message": e.error_message,
    } for e in recent_errors_q]

    return {
        "total_keys": total, "active_keys": active,
        "tokens_today": tokens_today, "requests_today": requests_today,
        "errors_today": errors_today, "usage_history": history,
        "per_key": per_key, "key_groups": groups_data,
        "recent_errors": recent_errors_data,
    }


def _build_history_daily(db, key_ids, keys, key_name_map, cutoff, today):
    """Build daily usage history using a single GROUP BY query."""
    from collections import defaultdict
    rows = db.query(
        func.date(models.ApiUsageLog.timestamp).label("day"),
        models.ApiUsageLog.api_key_id,
        func.coalesce(func.sum(models.ApiUsageLog.tokens_used), 0),
        func.count(models.ApiUsageLog.id),
        func.coalesce(func.sum(case((models.ApiUsageLog.is_error == True, 1), else_=0)), 0),
    ).filter(
        models.ApiUsageLog.api_key_id.in_(key_ids),
        func.date(models.ApiUsageLog.timestamp) >= cutoff,
    ).group_by("day", models.ApiUsageLog.api_key_id).all()

    buckets = defaultdict(lambda: {k.name: {"t": 0, "r": 0, "e": 0} for k in keys})
    for day, kid, tokens, reqs, errs in rows:
        name = key_name_map.get(kid)
        if name and day:
            buckets[str(day)][name] = {"t": int(tokens), "r": int(reqs), "e": int(errs)}

    history = []
    for i in range((today - cutoff).days, -1, -1):
        ds = (today - timedelta(days=i)).isoformat()
        b = buckets.get(ds, {k.name: {"t": 0, "r": 0, "e": 0} for k in keys})
        history.append({
            "date": ds,
            "total_tokens": sum(d["t"] for d in b.values()),
            "total_requests": sum(d["r"] for d in b.values()),
            "failed_requests": sum(d["e"] for d in b.values()),
            "per_key_tokens": {n: d["t"] for n, d in b.items()},
            "per_key_requests": {n: d["r"] for n, d in b.items()},
            "per_key_errors": {n: d["e"] for n, d in b.items()},
        })
    return history


def _build_history_recent(db, key_ids, keys, key_name_map, cutoff, now, grain):
    """Build hourly/minute history using a single GROUP BY query."""
    from collections import defaultdict
    extract_fn = func.date_trunc("hour" if grain == "hour" else "minute", models.ApiUsageLog.timestamp)
    steps = 24 if grain == "hour" else 60
    step_delta = timedelta(hours=1) if grain == "hour" else timedelta(minutes=1)
    start = (now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=23)) if grain == "hour" else \
            (now.replace(second=0, microsecond=0) - timedelta(minutes=59))

    rows = db.query(
        extract_fn.label("bucket"),
        models.ApiUsageLog.api_key_id,
        func.coalesce(func.sum(models.ApiUsageLog.tokens_used), 0),
        func.count(models.ApiUsageLog.id),
        func.coalesce(func.sum(case((models.ApiUsageLog.is_error == True, 1), else_=0)), 0),
    ).filter(
        models.ApiUsageLog.api_key_id.in_(key_ids),
        models.ApiUsageLog.timestamp >= cutoff,
    ).group_by("bucket", models.ApiUsageLog.api_key_id).all()

    buckets = defaultdict(lambda: {k.name: {"t": 0, "r": 0, "e": 0} for k in keys})
    for bucket_ts, kid, tokens, reqs, errs in rows:
        name = key_name_map.get(kid)
        if name and bucket_ts:
            key_str = bucket_ts.strftime("%H:%M") if hasattr(bucket_ts, "strftime") else str(bucket_ts)
            buckets[key_str][name] = {"t": int(tokens), "r": int(reqs), "e": int(errs)}

    history = []
    for i in range(steps):
        t = start + step_delta * i
        ts = t.strftime("%H:%M")
        b = buckets.get(ts, {k.name: {"t": 0, "r": 0, "e": 0} for k in keys})
        history.append({
            "date": ts,
            "total_tokens": sum(d["t"] for d in b.values()),
            "total_requests": sum(d["r"] for d in b.values()),
            "failed_requests": sum(d["e"] for d in b.values()),
            "per_key_tokens": {n: d["t"] for n, d in b.items()},
            "per_key_requests": {n: d["r"] for n, d in b.items()},
            "per_key_errors": {n: d["e"] for n, d in b.items()},
        })
    return history


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
