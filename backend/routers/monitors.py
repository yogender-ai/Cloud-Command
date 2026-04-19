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
        interval_seconds=req.interval_seconds,
        status="UP",
    )
    db.add(monitor)
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

    db.delete(monitor)
    db.commit()


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
