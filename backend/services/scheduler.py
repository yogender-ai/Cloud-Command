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


def _classify_response_status(status_code: int | None, response_text: str | None) -> tuple[str, str | None]:
    if status_code is not None and status_code >= 400:
        return "FAILED", (response_text or "")[:500]

    try:
        payload = json.loads(response_text or "{}")
    except Exception:
        payload = {}

    app_status = ""
    if isinstance(payload, dict):
        app_status = str(payload.get("status") or "").lower()
        result = payload.get("result")
        if not app_status and isinstance(result, dict):
            app_status = str(result.get("status") or "").lower()

    if app_status in {"deferred", "ai_deferred"}:
        return "DEFERRED", None
    if app_status in {"skipped", "idle"}:
        return app_status.upper(), None
    if app_status in {"failed", "error"}:
        return "FAILED", (response_text or "")[:500]
    return "SUCCESS", None


async def run_scheduled_job(job_id: int) -> None:
    job_data = await asyncio.to_thread(_load_scheduled_job, job_id)
    if not job_data:
        return

    started = _utcnow()
    status = "SUCCESS"
    status_code = None
    response_preview = None
    error = None

    try:
        async with httpx.AsyncClient(timeout=max(5, job_data["timeout_seconds"] or 60), follow_redirects=True) as client:
            response = await client.request(
                job_data["method"].upper(),
                job_data["url"],
                headers=job_data["headers"],
                content=job_data["content"],
            )
        status_code = response.status_code
        response_preview = response.text[:1000]
        status, error = _classify_response_status(response.status_code, response.text)
    except Exception as exc:
        status = "FAILED"
        error = str(exc)[:500]

    latency_ms = int((_utcnow() - started).total_seconds() * 1000)
    await asyncio.to_thread(
        _save_scheduled_job_result,
        job_id,
        status,
        status_code,
        latency_ms,
        error,
        response_preview,
        job_data["interval_seconds"],
    )


def _load_scheduled_job(job_id: int) -> dict | None:
    db: Session = SessionLocal()
    try:
        job = db.query(models.ScheduledJob).filter(models.ScheduledJob.id == job_id).first()
        if not job:
            return None

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

        return {
            "method": job.method,
            "url": job.url,
            "headers": headers,
            "content": content,
            "timeout_seconds": job.timeout_seconds,
            "interval_seconds": job.interval_seconds,
        }
    except Exception as exc:
        print(f"Scheduled job load failed: {exc}")
        return None
    finally:
        db.close()


def _save_scheduled_job_result(
    job_id: int,
    status: str,
    status_code: int | None,
    latency_ms: int,
    error: str | None,
    response_preview: str | None,
    interval_seconds: int | None,
) -> None:
    db: Session = SessionLocal()
    try:
        job = db.query(models.ScheduledJob).filter(models.ScheduledJob.id == job_id).first()
        if not job:
            return
        now = _utcnow()
        job.status = status
        job.last_run_at = now
        job.next_run_at = now + timedelta(seconds=max(60, interval_seconds or 900))
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
        print(f"Scheduled job save failed: {exc}")
    finally:
        db.close()


def _claim_due_scheduled_jobs() -> list[int]:
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
        return job_ids
    except Exception as exc:
        db.rollback()
        print(f"Scheduler scan failed: {exc}")
        return []
    finally:
        db.close()


async def run_due_scheduled_jobs() -> None:
    job_ids = await asyncio.to_thread(_claim_due_scheduled_jobs)

    if job_ids:
        await asyncio.gather(*(run_scheduled_job(job_id) for job_id in job_ids[:3]), return_exceptions=True)
