from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from dependencies import get_db, get_current_user
from config import settings

router = APIRouter(prefix="/api/monitors", tags=["monitors"])


@router.get("", response_model=List[schemas.MonitorResponse])
def list_monitors(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """List all monitors belonging to the current user."""
    return (
        db.query(models.Monitor)
        .filter(models.Monitor.user_id == user.id)
        .order_by(models.Monitor.created_at.desc())
        .all()
    )


@router.post("", response_model=schemas.MonitorResponse, status_code=201)
def create_monitor(
    req: schemas.MonitorCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Create a new site monitor."""
    count = db.query(models.Monitor).filter(models.Monitor.user_id == user.id).count()
    if count >= settings.MAX_MONITORS_PER_USER:
        raise HTTPException(
            status_code=403,
            detail=f"Monitor limit reached ({settings.MAX_MONITORS_PER_USER})"
        )

    monitor = models.Monitor(
        user_id=user.id,
        url=req.url,
        name=req.name,
        category=req.category,
        interval_seconds=req.interval_seconds,
        status="UP",
    )
    db.add(monitor)
    db.commit()
    db.refresh(monitor)

    # Notify user
    try:
        from services.mailer import send_monitor_action_email
        alert_to = user.notification_email or user.email
        send_monitor_action_email(to=alert_to, action="added", url=req.url)
    except Exception as e:
        print(f"Monitor add email failed: {e}")

    return monitor


@router.patch("/{monitor_id}", response_model=schemas.MonitorResponse)
def update_monitor(
    monitor_id: int,
    req: schemas.MonitorUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Update name and/or category of an existing monitor."""
    monitor = (
        db.query(models.Monitor)
        .filter(models.Monitor.id == monitor_id, models.Monitor.user_id == user.id)
        .first()
    )
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    if req.name is not None:
        monitor.name = req.name
    if req.category is not None:
        monitor.category = req.category
    elif req.clear_category:
        monitor.category = None
    db.commit()
    db.refresh(monitor)
    return monitor


@router.delete("/{monitor_id}", status_code=204)
def delete_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Delete a monitor owned by the current user."""
    monitor = (
        db.query(models.Monitor)
        .filter(models.Monitor.id == monitor_id, models.Monitor.user_id == user.id)
        .first()
    )
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    monitor_url = monitor.url
    db.delete(monitor)
    db.commit()

    # Notify user
    try:
        from services.mailer import send_monitor_action_email
        alert_to = user.notification_email or user.email
        send_monitor_action_email(to=alert_to, action="deleted", url=monitor_url)
    except Exception as e:
        print(f"Monitor delete email failed: {e}")


@router.get("/{monitor_id}/logs", response_model=List[schemas.MonitorLogResponse])
def get_monitor_logs(
    monitor_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get the last 50 ping logs for a monitor."""
    monitor = (
        db.query(models.Monitor)
        .filter(models.Monitor.id == monitor_id, models.Monitor.user_id == user.id)
        .first()
    )
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    return (
        db.query(models.MonitorLog)
        .filter(models.MonitorLog.monitor_id == monitor_id)
        .order_by(models.MonitorLog.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/{monitor_id}/logs/csv")
def export_logs_csv(
    monitor_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Export monitor logs as a CSV file."""
    from fastapi.responses import Response

    monitor = (
        db.query(models.Monitor)
        .filter(models.Monitor.id == monitor_id, models.Monitor.user_id == user.id)
        .first()
    )
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    logs = (
        db.query(models.MonitorLog)
        .filter(models.MonitorLog.monitor_id == monitor_id)
        .order_by(models.MonitorLog.created_at.desc())
        .all()
    )

    csv = "Timestamp,Status,Latency(ms)\n"
    for log in logs:
        csv += f"{log.created_at.isoformat()},{log.status},{log.latency}\n"

    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="monitor-{monitor_id}-logs.csv"'},
    )


@router.get("/{monitor_id}/analytics")
def get_monitor_analytics(
    monitor_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get visitor analytics for a specific monitor."""
    from datetime import date, timedelta
    from sqlalchemy import func

    monitor = (
        db.query(models.Monitor)
        .filter(models.Monitor.id == monitor_id, models.Monitor.user_id == user.id)
        .first()
    )
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    today = date.today()

    # Hourly visits for today
    hourly = (
        db.query(models.MonitorVisit.hour, func.sum(models.MonitorVisit.visits))
        .filter(
            models.MonitorVisit.monitor_id == monitor_id,
            models.MonitorVisit.date == today,
        )
        .group_by(models.MonitorVisit.hour)
        .all()
    )
    hourly_data = [{"hour": h, "visits": v} for h, v in hourly]

    # Daily visits for last 30 days
    thirty_days_ago = today - timedelta(days=30)
    daily = (
        db.query(models.MonitorVisit.date, func.sum(models.MonitorVisit.visits))
        .filter(
            models.MonitorVisit.monitor_id == monitor_id,
            models.MonitorVisit.date >= thirty_days_ago,
        )
        .group_by(models.MonitorVisit.date)
        .order_by(models.MonitorVisit.date.desc())
        .all()
    )
    daily_data = [{"date": d.isoformat(), "visits": v} for d, v in daily]

    return {"hourlyVisits": hourly_data, "dailyVisits": daily_data}


@router.get("/{monitor_id}/inspect")
async def inspect_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Fetch SSL certificate, HTTP headers and status for a monitored site."""
    import ssl
    import socket
    import httpx
    from urllib.parse import urlparse
    from datetime import datetime, timezone

    monitor = (
        db.query(models.Monitor)
        .filter(models.Monitor.id == monitor_id, models.Monitor.user_id == user.id)
        .first()
    )
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    result = {
        "ssl": None,
        "headers": {},
        "status_code": None,
        "redirect_chain": [],
    }

    parsed = urlparse(monitor.url)
    hostname = parsed.hostname or ""
    is_https = parsed.scheme == "https"

    # SSL certificate info
    if is_https and hostname:
        try:
            ctx = ssl.create_default_context()
            with socket.create_connection((hostname, 443), timeout=8) as sock:
                with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    not_after_str = cert.get("notAfter", "")
                    expire_dt = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc) if not_after_str else None
                    days_left = (expire_dt - datetime.now(timezone.utc)).days if expire_dt else None
                    issuer = dict(x[0] for x in cert.get("issuer", []))
                    subject = dict(x[0] for x in cert.get("subject", []))
                    result["ssl"] = {
                        "valid": True,
                        "issuer": issuer.get("organizationName", issuer.get("commonName", "Unknown")),
                        "subject": subject.get("commonName", hostname),
                        "expires": expire_dt.strftime("%Y-%m-%d") if expire_dt else None,
                        "days_left": days_left,
                    }
        except ssl.SSLCertVerificationError:
            result["ssl"] = {"valid": False, "issuer": None, "subject": hostname, "expires": None, "days_left": None}
        except Exception as e:
            result["ssl"] = {"valid": None, "error": str(e)}

    # HTTP headers
    KEEP_HEADERS = [
        "content-type", "server", "x-frame-options", "strict-transport-security",
        "x-content-type-options", "cache-control", "x-powered-by",
        "content-security-policy", "referrer-policy", "cf-ray",
    ]
    redirect_chain = []
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.head(monitor.url, headers={"User-Agent": "CloudCommand/1.0"})
            result["status_code"] = resp.status_code
            result["headers"] = {
                k: v for k, v in resp.headers.items()
                if k.lower() in KEEP_HEADERS
            }
            for r in resp.history:
                redirect_chain.append({"from": str(r.url), "status": r.status_code})
            result["redirect_chain"] = redirect_chain
    except Exception as e:
        result["headers"] = {"error": str(e)}

    return result

