import asyncio
import json
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from database import SessionLocal
import models
from security import decrypt_value


def _utcnow():
    return datetime.now(timezone.utc)


def _coerce_aware(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def run_scheduled_job(job_id: int) -> None:
    db: Session = SessionLocal()
    try:
        job = db.query(models.ScheduledJob).filter(models.ScheduledJob.id == job_id).first()
        if not job:
            return

        headers = {"User-Agent": "CloudCommand-Scheduler/1.0"}
        if job.header_name and job.encrypted_header_value:
            headers[job.header_name] = decrypt_value(job.encrypted_header_value)

        content = None
        if job.body_json:
            try:
                parsed = json.loads(job.body_json)
                content = json.dumps(parsed)
                headers["Content-Type"] = "application/json"
            except Exception:
                content = job.body_json

        started = _utcnow()
        status = "SUCCESS"
        status_code = None
        response_preview = None
        error = None

        try:
            async with httpx.AsyncClient(timeout=max(5, job.timeout_seconds or 60), follow_redirects=True) as client:
                response = await client.request(
                    job.method.upper(),
                    job.url,
                    headers=headers,
                    content=content,
                )
            status_code = response.status_code
            response_preview = response.text[:1000]
            if response.status_code >= 400:
                status = "FAILED"
                error = response_preview[:500]
        except Exception as exc:
            status = "FAILED"
            error = str(exc)[:500]

        latency_ms = int((_utcnow() - started).total_seconds() * 1000)
        now = _utcnow()
        job.status = status
        job.last_run_at = now
        job.next_run_at = now + timedelta(seconds=max(60, job.interval_seconds or 900))
        job.last_status_code = status_code
        job.last_latency_ms = latency_ms
        job.last_error = error
        db.add(
            models.ScheduledJobLog(
                job_id=job.id,
                status=status,
                status_code=status_code,
                latency_ms=latency_ms,
                error_message=error,
                response_preview=response_preview,
            )
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"Scheduled job failed: {exc}")
    finally:
        db.close()


async def run_due_scheduled_jobs() -> None:
    db: Session = SessionLocal()
    try:
        now = _utcnow()
        due_jobs = (
            db.query(models.ScheduledJob)
            .filter(models.ScheduledJob.is_enabled == True)
            .filter(models.ScheduledJob.next_run_at <= now)
            .limit(10)
            .all()
        )
        job_ids = [job.id for job in due_jobs]
        # Move next_run_at forward before executing so overlapping scheduler ticks
        # do not queue the same job repeatedly.
        for job in due_jobs:
            job.next_run_at = now + timedelta(seconds=max(60, job.interval_seconds or 900))
            job.status = "RUNNING"
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"Scheduler scan failed: {exc}")
        return
    finally:
        db.close()

    if job_ids:
        await asyncio.gather(*(run_scheduled_job(job_id) for job_id in job_ids), return_exceptions=True)
