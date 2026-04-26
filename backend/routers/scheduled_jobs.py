from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from dependencies import get_current_user, get_db
from security import encrypt_value
from services.scheduler import run_scheduled_job


router = APIRouter(prefix="/api/scheduled-jobs", tags=["scheduled-jobs"])


def _validate_method(method: str) -> str:
    cleaned = (method or "POST").upper()
    if cleaned not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
        raise HTTPException(status_code=400, detail="Unsupported HTTP method")
    return cleaned


def _next_run(interval_seconds: int):
    return datetime.now(timezone.utc) + timedelta(seconds=max(60, interval_seconds or 900))


@router.get("", response_model=List[schemas.ScheduledJobResponse])
def list_scheduled_jobs(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return (
        db.query(models.ScheduledJob)
        .filter(models.ScheduledJob.user_id == user.id)
        .order_by(models.ScheduledJob.created_at.desc())
        .all()
    )


@router.post("", response_model=schemas.ScheduledJobResponse, status_code=201)
def create_scheduled_job(
    req: schemas.ScheduledJobCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    interval = max(60, min(req.interval_seconds or 900, 86400))
    timeout = max(5, min(req.timeout_seconds or 60, 300))
    job = models.ScheduledJob(
        user_id=user.id,
        name=req.name,
        category=req.category or None,
        url=req.url,
        method=_validate_method(req.method),
        interval_seconds=interval,
        timeout_seconds=timeout,
        body_json=req.body_json or None,
        header_name=req.header_name or None,
        encrypted_header_value=encrypt_value(req.header_value) if req.header_value else None,
        is_enabled=req.is_enabled,
        next_run_at=datetime.now(timezone.utc) if req.is_enabled else _next_run(interval),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.patch("/{job_id}", response_model=schemas.ScheduledJobResponse)
def update_scheduled_job(
    job_id: int,
    req: schemas.ScheduledJobUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    job = (
        db.query(models.ScheduledJob)
        .filter(models.ScheduledJob.id == job_id, models.ScheduledJob.user_id == user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Scheduled job not found")

    if req.name is not None:
        job.name = req.name
    if req.url is not None:
        job.url = req.url
    if req.method is not None:
        job.method = _validate_method(req.method)
    if req.category is not None:
        job.category = req.category or None
    elif req.clear_category:
        job.category = None
    if req.interval_seconds is not None:
        job.interval_seconds = max(60, min(req.interval_seconds, 86400))
        job.next_run_at = _next_run(job.interval_seconds)
    if req.timeout_seconds is not None:
        job.timeout_seconds = max(5, min(req.timeout_seconds, 300))
    if req.body_json is not None:
        job.body_json = req.body_json or None
    if req.clear_header:
        job.header_name = None
        job.encrypted_header_value = None
    elif req.header_name is not None or req.header_value is not None:
        job.header_name = req.header_name or job.header_name
        if req.header_value:
            job.encrypted_header_value = encrypt_value(req.header_value)
    if req.is_enabled is not None:
        job.is_enabled = req.is_enabled
        if req.is_enabled and not job.next_run_at:
            job.next_run_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
def delete_scheduled_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    job = (
        db.query(models.ScheduledJob)
        .filter(models.ScheduledJob.id == job_id, models.ScheduledJob.user_id == user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Scheduled job not found")
    db.delete(job)
    db.commit()


@router.post("/{job_id}/run", response_model=dict)
async def run_job_now(
    job_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    job = (
        db.query(models.ScheduledJob)
        .filter(models.ScheduledJob.id == job_id, models.ScheduledJob.user_id == user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Scheduled job not found")
    await run_scheduled_job(job.id)
    return {"status": "completed"}


@router.get("/{job_id}/logs", response_model=List[schemas.ScheduledJobLogResponse])
def get_scheduled_job_logs(
    job_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    job = (
        db.query(models.ScheduledJob)
        .filter(models.ScheduledJob.id == job_id, models.ScheduledJob.user_id == user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Scheduled job not found")
    return (
        db.query(models.ScheduledJobLog)
        .filter(models.ScheduledJobLog.job_id == job_id)
        .order_by(models.ScheduledJobLog.created_at.desc())
        .limit(50)
        .all()
    )
