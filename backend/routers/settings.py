from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import random
import string

import models
import schemas
from dependencies import get_db, get_current_user
from security import hash_password, verify_password
from limiter import limiter

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


@router.get("/profile", response_model=schemas.UserResponse)
def get_profile(user: models.User = Depends(get_current_user)):
    """Get the current user's profile."""
    return user


@router.post("/notification-email/request-otp")
@limiter.limit("3/minute")
def request_otp(
    request: Request,
    req: schemas.NotificationEmailRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Request an OTP to verify a notification email."""
    code = _generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    try:
        from services.mailer import get_last_mail_error, send_otp_email
        sent = send_otp_email(req.email, code)
    except Exception as e:
        print(f"Failed to send OTP email: {e}")
        sent = False

    if not sent:
        raise HTTPException(
            status_code=503,
            detail=f"Could not send OTP. {get_last_mail_error() or 'Check backend mail logs.'}",
        )

    otp = models.OTP(user_id=user.id, email=req.email, code=code, expires_at=expires)
    db.add(otp)
    db.commit()

    return {"message": f"OTP sent to {req.email}"}


@router.post("/notification-email/verify-otp")
@limiter.limit("5/minute")
def verify_otp(
    request: Request,
    req: schemas.OTPVerifyRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Verify OTP and update notification email."""
    otp = (
        db.query(models.OTP)
        .filter(
            models.OTP.user_id == user.id,
            models.OTP.email == req.email,
            models.OTP.code == req.code,
            models.OTP.expires_at > datetime.now(timezone.utc),
        )
        .order_by(models.OTP.created_at.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user.notification_email = req.email
    db.delete(otp)
    db.commit()

    return {"message": "Notification email updated successfully"}


@router.post("/change-password")
@limiter.limit("3/minute")
def change_password(
    request: Request,
    req: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Change the current user's password after verifying the old one."""
    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"message": "Password changed successfully"}
