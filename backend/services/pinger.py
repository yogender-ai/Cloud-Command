"""
Site Pinger — Background task that pings all monitored URLs.

Key design decisions:
- Reuses a single httpx.AsyncClient per cycle to avoid per-request DNS overhead
- Tries HEAD first (faster, less bandwidth), falls back to GET if HEAD is blocked
  This prevents false DOWN on sites like Facebook that reject server-side GETs
- Requires 2 consecutive failures before marking a site DOWN (reduces false alarms)
- Timezone-safe comparison using .astimezone(utc) instead of .replace()
"""

import asyncio
import httpx
from datetime import datetime, timezone
from threading import RLock
from urllib.parse import urlparse
from sqlalchemy.orm import Session

from database import SessionLocal
import models
from config import settings


# Realistic browser headers to avoid being blocked by CDNs / rate limiters
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "no-cache",
}

# Track consecutive failures per monitor id to avoid immediate false DOWN
_consecutive_failures: dict[int, int] = {}
FAILURES_BEFORE_DOWN = 2  # require this many consecutive failures to mark DOWN

_monitor_cache: dict[int, dict] = {}
_monitor_cache_loaded_at: datetime | None = None
_cache_lock = RLock()


def _is_hugging_face_url(url: str) -> bool:
    parsed = urlparse(url.lower())
    host = parsed.netloc
    return host.endswith("hf.space") or (
        host == "huggingface.co" and parsed.path.startswith("/spaces/")
    )

def _classify_response(url: str, status_code: int, body: str = "") -> str:
    if _is_hugging_face_url(url):
        lowered = body.lower()
        if status_code == 503:
            return "AWAKENING"
        if "sleeping" in lowered or '"stage":"sleeping"' in lowered or "'stage':'sleeping'" in lowered:
            return "SLEEPING"
        if "building" in lowered or "starting" in lowered or "preparing" in lowered:
            return "AWAKENING"
        if "runtime error" in lowered or "build error" in lowered or "config error" in lowered:
            return "DOWN"
        # For Space monitors we trust the live app response more than any
        # inferred metadata. If the app host answers with a non-5xx response,
        # Cloud Command should treat the Space as reachable.
        if 200 <= status_code < 400:
            return "UP"
        if 400 <= status_code < 500:
            return "UP"
        return "DOWN"

    if status_code < 500:
        return "UP"
    return "DOWN"


def _monitor_to_cache_entry(monitor, alert_email: str | None = None, existing: dict | None = None) -> dict:
    existing = existing or {}
    return {
        "id": monitor.id,
        "url": monitor.url,
        "status": existing.get("status", monitor.status),
        "db_status": monitor.status,
        "user_id": monitor.user_id,
        "name": monitor.name,
        "category": monitor.category,
        "interval_seconds": max(settings.MIN_MONITOR_INTERVAL_SECONDS, monitor.interval_seconds or 60),
        "alert_email": alert_email or existing.get("alert_email"),
        "last_checked": existing.get("last_checked"),
        "last_latency": existing.get("last_latency"),
        "last_error": existing.get("last_error"),
    }


def refresh_monitor_cache(force: bool = False) -> int:
    """Refresh ping targets from Neon rarely, then run the wake loop from memory."""
    global _monitor_cache_loaded_at

    now = datetime.now(timezone.utc)
    with _cache_lock:
        cache_age = (now - _monitor_cache_loaded_at).total_seconds() if _monitor_cache_loaded_at else None
        if not force and _monitor_cache and cache_age is not None and cache_age < settings.PINGER_CACHE_REFRESH_SECONDS:
            return len(_monitor_cache)

    db: Session = SessionLocal()
    try:
        rows = (
            db.query(models.Monitor, models.User.email, models.User.notification_email)
            .join(models.User, models.Monitor.user_id == models.User.id)
            .filter(models.Monitor.user_id.isnot(None))
            .all()
        )
        next_cache = {}
        with _cache_lock:
            for monitor, email, notification_email in rows:
                alert_email = notification_email or email
                next_cache[monitor.id] = _monitor_to_cache_entry(
                    monitor,
                    alert_email=alert_email,
                    existing=_monitor_cache.get(monitor.id),
                )
            _monitor_cache.clear()
            _monitor_cache.update(next_cache)
            _monitor_cache_loaded_at = now
            return len(_monitor_cache)
    finally:
        db.close()


def upsert_monitor_cache(monitor, alert_email: str | None = None) -> None:
    with _cache_lock:
        _monitor_cache[monitor.id] = _monitor_to_cache_entry(
            monitor,
            alert_email=alert_email,
            existing=_monitor_cache.get(monitor.id),
        )


def remove_monitor_cache(monitor_id: int) -> None:
    with _cache_lock:
        _monitor_cache.pop(monitor_id, None)
        _consecutive_failures.pop(monitor_id, None)


def get_monitor_cache_snapshot() -> dict[int, dict]:
    with _cache_lock:
        return {monitor_id: dict(data) for monitor_id, data in _monitor_cache.items()}


async def _probe_hf_space(client: httpx.AsyncClient, url: str) -> tuple[str, int]:
    loop = asyncio.get_event_loop()
    candidates = []

    normalized = url.rstrip("/")
    if normalized:
        candidates.append(normalized)
    if normalized.endswith(".hf.space"):
        candidates.append(f"{normalized}/config")

    best_status = "DOWN"
    best_latency = 0

    for candidate in dict.fromkeys(candidates):
        try:
            start = loop.time()
            resp = await client.get(candidate, headers=HEADERS)
            latency = int((loop.time() - start) * 1000)
            body_preview = resp.text[:20000]
            status = _classify_response(candidate, resp.status_code, body_preview)

            if status == "UP":
                return status, latency
            if status in {"AWAKENING", "SLEEPING"}:
                best_status, best_latency = status, latency
            elif best_status == "DOWN":
                best_status, best_latency = status, latency
        except httpx.TimeoutException:
            continue
        except httpx.ConnectError:
            continue
        except Exception:
            continue

    return best_status, best_latency


async def ping_url(client: httpx.AsyncClient, monitor: dict) -> tuple[str, int]:
    """
    Ping a URL using HEAD first, then GET on failure.
    Returns (status_str, latency_ms).

    HEAD is faster and uses less bandwidth. Many sites (FB, IG, etc.) return
    405 Method Not Allowed on HEAD — we fall back to GET in that case.
    We treat any 200-499 status as UP (4xx means server is reachable),
    and only 5xx / connection errors as DOWN.
    """
    loop = asyncio.get_event_loop()

    url = monitor["url"]
    is_hf_space = _is_hugging_face_url(url)
    if is_hf_space:
        return await _probe_hf_space(client, url)

    # --- Attempt HEAD first (unless it's a Hugging Face space) ---
    if not is_hf_space:
        try:
            start = loop.time()
            resp = await client.head(url, headers=HEADERS)
            latency = int((loop.time() - start) * 1000)

            # 405 = HEAD not allowed, try GET instead
            if resp.status_code == 405:
                raise httpx.HTTPStatusError("HEAD not allowed", request=resp.request, response=resp)

            return _classify_response(url, resp.status_code), latency

        except (httpx.HTTPStatusError, Exception):
            pass  # fall through to GET

    # --- Fallback to GET ---
    try:
        start = loop.time()
        # Use a short timeout for GET to avoid hanging on large pages
        resp = await client.get(url, headers=HEADERS)
        latency = int((loop.time() - start) * 1000)
        body_preview = resp.text[:20000]

        return _classify_response(url, resp.status_code, body_preview), latency

    except httpx.TimeoutException:
        return "DOWN", 0
    except httpx.ConnectError:
        return "DOWN", 0
    except Exception:
        return "DOWN", 0


def _load_due_monitors_from_cache():
    """Load due monitors from memory so the wake loop does not wake Neon."""
    now = datetime.now(timezone.utc)
    due = []
    with _cache_lock:
        for monitor in _monitor_cache.values():
            last = monitor.get("last_checked")
            interval = max(settings.MIN_MONITOR_INTERVAL_SECONDS, monitor.get("interval_seconds") or 60)
            if last and (now - last).total_seconds() < interval - 2:
                continue
            due.append(dict(monitor))
    return due, now


def _apply_ping_results_to_cache(due, results, now):
    changed = []
    with _cache_lock:
        for monitor_data, result in zip(due, results):
            if isinstance(result, Exception):
                raw_status, latency = "DOWN", 0
            else:
                raw_status, latency = result

            monitor_id = monitor_data["id"]
            cached = _monitor_cache.get(monitor_id)
            if not cached:
                continue

            if raw_status == "DOWN":
                _consecutive_failures[monitor_id] = _consecutive_failures.get(monitor_id, 0) + 1
                if _consecutive_failures[monitor_id] < FAILURES_BEFORE_DOWN:
                    status = cached.get("status", monitor_data["status"])
                else:
                    status = "DOWN"
            elif raw_status in {"AWAKENING", "SLEEPING"}:
                _consecutive_failures[monitor_id] = 0
                status = raw_status
            else:
                _consecutive_failures[monitor_id] = 0
                status = "UP"

            previous_status = cached.get("status")
            cached.update(
                {
                    "status": status,
                    "raw_status": raw_status,
                    "last_checked": now,
                    "last_latency": latency,
                    "last_error": None if status == "UP" else raw_status,
                }
            )
            if previous_status != status:
                changed.append(dict(cached))
    return changed


def _save_ping_results(due, results, now):
    """Optionally persist ping results; disabled by default to protect Neon Free."""
    if not settings.PINGER_WRITE_RESULTS:
        return

    db = SessionLocal()
    try:
        for monitor_data, result in zip(due, results):
            if isinstance(result, Exception):
                raw_status, latency = "DOWN", 0
            else:
                raw_status, latency = result

            monitor_id = monitor_data["id"]
            with _cache_lock:
                status = _monitor_cache.get(monitor_id, {}).get("status", raw_status)

            db.query(models.Monitor).filter(models.Monitor.id == monitor_id).update(
                {"status": status, "last_checked": now}
            )
            db.add(models.MonitorLog(monitor_id=monitor_id, status=raw_status, latency=latency))

            if settings.MONITOR_LOG_RETENTION_PER_MONITOR > 0:
                old_log_ids = [
                    row.id
                    for row in (
                        db.query(models.MonitorLog.id)
                        .filter(models.MonitorLog.monitor_id == monitor_id)
                        .order_by(models.MonitorLog.created_at.desc())
                        .offset(settings.MONITOR_LOG_RETENTION_PER_MONITOR)
                        .limit(100)
                        .all()
                    )
                ]
                if old_log_ids:
                    db.query(models.MonitorLog).filter(models.MonitorLog.id.in_(old_log_ids)).delete(
                        synchronize_session=False
                    )

        db.commit()
        print(f"Pinged {len(due)} monitor(s)")
    except Exception as e:
        print(f"Pinger error: {e}")
        db.rollback()
    finally:
        db.close()


async def ping_all_monitors():
    """Ping all monitors that are due for a check without blocking FastAPI."""
    await asyncio.to_thread(refresh_monitor_cache)
    due, now = _load_due_monitors_from_cache()
    if not due:
        return

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=2.0),
        follow_redirects=True,
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    ) as client:
        results = await asyncio.gather(
            *[ping_url(client, m) for m in due],
            return_exceptions=True,
        )

    changed = _apply_ping_results_to_cache(due, results, now)
    for monitor in changed:
        alert_email = monitor.get("alert_email")
        if not alert_email:
            continue
        try:
            from services.mailer import send_status_change_email
            send_status_change_email(
                to=alert_email,
                site_name=monitor["name"],
                site_url=monitor["url"],
                new_status=monitor["status"],
            )
        except Exception as e:
            print(f"Alert email failed: {e}")

    await asyncio.to_thread(_save_ping_results, due, results, now)


async def start_pinger():
    """Run enabled background workers on a calm cadence."""
    print("🔄 Pinger engine started")
    while True:
        try:
            if settings.ENABLE_BACKGROUND_PINGER:
                await asyncio.wait_for(ping_all_monitors(), timeout=25)
            if settings.ENABLE_SCHEDULED_JOBS:
                from services.scheduler import run_due_scheduled_jobs
                await asyncio.wait_for(run_due_scheduled_jobs(), timeout=25)
        except asyncio.TimeoutError:
            print("Background worker cycle timed out; skipping this tick")
        except Exception as e:
            print(f"Background worker loop error: {e}")
        await asyncio.sleep(settings.BACKGROUND_WORKER_INTERVAL_SECONDS)
