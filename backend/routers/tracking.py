"""
Public visitor tracking endpoint — no auth required.
POST /api/track/{monitor_id}
Called from users' websites via injected JS snippet.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import date, datetime, timezone
from pydantic import BaseModel
from typing import Optional

from database import SessionLocal
import models

router = APIRouter(prefix="/api/track", tags=["tracking"])


class TrackPayload(BaseModel):
    path: Optional[str] = "/"
    ref: Optional[str] = ""
    ua: Optional[str] = ""


@router.post("/{monitor_id}")
async def track_visit(monitor_id: int, payload: TrackPayload = TrackPayload()):
    """
    Public endpoint — records a visitor hit for a monitored site.
    No auth required. Always returns 200 so visitor browsers never see errors.
    """
    try:
        db: Session = SessionLocal()
        try:
            monitor = db.query(models.Monitor).filter(models.Monitor.id == monitor_id).first()
            if not monitor:
                return JSONResponse({"ok": True})  # silent — don't reveal if ID exists

            today = date.today()
            hour = datetime.now(timezone.utc).hour

            visit = (
                db.query(models.MonitorVisit)
                .filter(
                    models.MonitorVisit.monitor_id == monitor_id,
                    models.MonitorVisit.date == today,
                    models.MonitorVisit.hour == hour,
                )
                .first()
            )
            if visit:
                visit.visits += 1
            else:
                visit = models.MonitorVisit(
                    monitor_id=monitor_id,
                    date=today,
                    hour=hour,
                    visits=1,
                )
                db.add(visit)
            db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"[TRACK] Error: {e}")

    return JSONResponse({"ok": True})
