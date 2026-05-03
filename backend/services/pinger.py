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
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlparse
from sqlalchemy.orm import Session

from database import SessionLocal
import models
from config import settings
from security import decrypt_value


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
_HF_SPACE_ID_PATTERNS = (
    re.compile(r'["\']spaceId["\']\s*:\s*["\']([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)["\']', re.IGNORECASE),
    re.compile(r'huggingface\.co/spaces/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)', re.IGNORECASE),
)
_DEFAULT_HF_SPACE_ALIASES = {
    # News-Intel Space 1 uses the hf.space host in Cloud Command, but the
    # runtime API needs the canonical repo id to inspect its real status.
    "yash213kadian-news-intel-hf-space-1": "YAsh213kadian/News_intel_HF_space_1",
    "yash213kadian-news-intel-hf-space-1.hf.space": "YAsh213kadian/News_intel_HF_space_1",
}


def _load_hf_space_aliases() -> dict[str, str]:
    raw = getattr(settings, "HF_SPACE_ALIASES_JSON", "") or ""
    if not raw.strip():
        return dict(_DEFAULT_HF_SPACE_ALIASES)

    try:
        payload = json.loads(raw)
    except Exception:
        return dict(_DEFAULT_HF_SPACE_ALIASES)

    aliases = dict(_DEFAULT_HF_SPACE_ALIASES)
    if isinstance(payload, dict):
        for key, value in payload.items():
            if isinstance(key, str) and isinstance(value, str) and "/" in value:
                aliases[key.strip().lower()] = value.strip()
    return aliases


_HF_SPACE_ALIASES = _load_hf_space_aliases()


def _is_hugging_face_url(url: str) -> bool:
    parsed = urlparse(url.lower())
    host = parsed.netloc
    return host.endswith("hf.space") or (
        host == "huggingface.co" and parsed.path.startswith("/spaces/")
    )


def _extract_hf_space_id(url: str, body: str = "") -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    host_slug = host[:-9] if host.endswith(".hf.space") else host
    alias = _HF_SPACE_ALIASES.get(host) or _HF_SPACE_ALIASES.get(host_slug)
    if alias:
        return alias

    if host == "huggingface.co":
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) >= 3 and parts[0].lower() == "spaces":
            return f"{parts[1]}/{parts[2]}"

    if body:
        for pattern in _HF_SPACE_ID_PATTERNS:
            match = pattern.search(body)
            if match:
                return match.group(1)

    return None


def _is_active_hf_key(api_key: models.ApiKey) -> bool:
    return "active" in (api_key.status or "").lower()


def _get_hf_monitor_token(user_id: int, category: str | None = None) -> str | None:
    db = SessionLocal()
    try:
        query = db.query(models.ApiKey).filter(
            models.ApiKey.user_id == user_id,
            models.ApiKey.provider == "huggingface",
        )
        candidates = [key for key in query.all() if _is_active_hf_key(key)]
        if category:
            normalized = category.strip().lower()
            category_matches = [
                key for key in candidates
                if (key.category or "").strip().lower() == normalized
            ]
            if category_matches:
                candidates = category_matches
        if not candidates:
            return None
        try:
            return decrypt_value(candidates[0].encrypted_key)
        except Exception:
            return None
    finally:
        db.close()


def _classify_hf_runtime_stage(stage: str | None) -> str | None:
    if not stage:
        return None

    normalized = str(stage).strip().upper()
    if normalized in {"RUNNING", "RUNNING_BUILDING", "READY"}:
        return "UP"
    if normalized in {"BUILDING", "STARTING", "PREPARING"}:
        return "AWAKENING"
    if normalized in {"SLEEPING", "STOPPED"}:
        return "SLEEPING"
    if normalized in {"PAUSED", "NO_APP_FILE", "CONFIG_ERROR", "BUILD_ERROR", "RUNTIME_ERROR", "DELETING"}:
        return "DOWN"
    return None


async def _get_hf_runtime_status(
    client: httpx.AsyncClient,
    space_id: str,
    hf_token: str | None = None,
) -> str | None:
    runtime_url = f"https://huggingface.co/api/spaces/{space_id}/runtime"
    headers = {"Accept": "application/json", **HEADERS}
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"
    try:
        resp = await client.get(runtime_url, headers=headers)
        if resp.status_code >= 400:
            return None
        payload = resp.json()
    except Exception:
        return None

    stage = payload.get("stage")
    if stage is None and isinstance(payload.get("runtime"), dict):
        stage = payload["runtime"].get("stage")
    return _classify_hf_runtime_stage(stage)


def _classify_response(url: str, status_code: int, body: str = "") -> str:
    if _is_hugging_face_url(url):
        lowered = body.lower()
        if status_code == 503:
            return "AWAKENING"
        if "sleeping" in lowered or '"stage":"sleeping"' in lowered or "'stage':'sleeping'" in lowered:
            return "SLEEPING"
        # Generic monitors treat 4xx as reachable, but Hugging Face Space
        # pages often return 401/403/404 for private or missing Spaces. Calling
        # those UP makes private/sleeping Space monitors look healthy when the
        # user cannot actually reach the app.
        if 200 <= status_code < 400:
            return "UP"
        return "DOWN"

    if status_code < 500:
        return "UP"
    return "DOWN"


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
    hf_token = None
    if is_hf_space:
        hf_token = await asyncio.to_thread(
            _get_hf_monitor_token,
            monitor["user_id"],
            monitor.get("category"),
        )

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

        if is_hf_space:
            space_id = _extract_hf_space_id(url, body_preview)
            if space_id:
                runtime_status = await _get_hf_runtime_status(client, space_id, hf_token)
                if runtime_status:
                    return runtime_status, latency

        return _classify_response(url, resp.status_code, body_preview), latency

    except httpx.TimeoutException:
        return "DOWN", 0
    except httpx.ConnectError:
        return "DOWN", 0
    except Exception:
        return "DOWN", 0


def _load_due_monitors():
    """Load due monitors using synchronous SQLAlchemy outside the event loop."""
    db: Session = SessionLocal()
    try:
        monitors = db.query(models.Monitor).filter(models.Monitor.user_id.isnot(None)).all()
        now = datetime.now(timezone.utc)
        due = []

        for monitor in monitors:
            if monitor.last_checked:
                last = monitor.last_checked
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                else:
                    last = last.astimezone(timezone.utc)
                interval = max(settings.MIN_MONITOR_INTERVAL_SECONDS, monitor.interval_seconds or 60)
                elapsed = (now - last).total_seconds()
                if elapsed < interval - 2:
                    continue
            due.append({
                "id": monitor.id,
                "url": monitor.url,
                "status": monitor.status,
                "user_id": monitor.user_id,
                "name": monitor.name,
                "category": monitor.category,
            })

        return due, now
    finally:
        db.close()


def _save_ping_results(due, results, now):
    """Persist ping results using synchronous SQLAlchemy outside the event loop."""
    db = SessionLocal()
    try:
        for monitor_data, result in zip(due, results):
            if isinstance(result, Exception):
                raw_status, latency = "DOWN", 0
            else:
                raw_status, latency = result

            monitor_id = monitor_data["id"]

            if raw_status == "DOWN":
                _consecutive_failures[monitor_id] = _consecutive_failures.get(monitor_id, 0) + 1
                if _consecutive_failures[monitor_id] < FAILURES_BEFORE_DOWN:
                    status = monitor_data["status"]
                else:
                    status = "DOWN"
            elif raw_status in {"AWAKENING", "SLEEPING"}:
                _consecutive_failures[monitor_id] = 0
                status = raw_status
            else:
                _consecutive_failures[monitor_id] = 0
                status = "UP"

            previous_status = monitor_data["status"]

            db.query(models.Monitor).filter(models.Monitor.id == monitor_id).update(
                {"status": status, "last_checked": now}
            )
            db.add(models.MonitorLog(monitor_id=monitor_id, status=raw_status, latency=latency))

            if previous_status != status:
                try:
                    owner = db.query(models.User).filter(models.User.id == monitor_data["user_id"]).first()
                    if owner:
                        alert_email = owner.notification_email or owner.email
                        if alert_email:
                            from services.mailer import send_status_change_email
                            send_status_change_email(
                                to=alert_email,
                                site_name=monitor_data["name"],
                                site_url=monitor_data["url"],
                                new_status=status,
                            )
                except Exception as e:
                    print(f"Alert email failed: {e}")

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
    due, now = await asyncio.to_thread(_load_due_monitors)
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
        await asyncio.sleep(60)
