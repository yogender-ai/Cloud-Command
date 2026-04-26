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
from sqlalchemy.orm import Session

from database import SessionLocal
import models


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


async def ping_url(client: httpx.AsyncClient, url: str) -> tuple[str, int]:
    """
    Ping a URL using HEAD first, then GET on failure.
    Returns (status_str, latency_ms).

    HEAD is faster and uses less bandwidth. Many sites (FB, IG, etc.) return
    405 Method Not Allowed on HEAD — we fall back to GET in that case.
    We treat any 200-499 status as UP (4xx means server is reachable),
    and only 5xx / connection errors as DOWN.
    """
    loop = asyncio.get_event_loop()

    is_hf_space = "hf.space" in url.lower()

    # --- Attempt HEAD first (unless it's a Hugging Face space) ---
    if not is_hf_space:
        try:
            start = loop.time()
            resp = await client.head(url, headers=HEADERS)
            latency = int((loop.time() - start) * 1000)

            # 405 = HEAD not allowed, try GET instead
            if resp.status_code == 405:
                raise httpx.HTTPStatusError("HEAD not allowed", request=resp.request, response=resp)

            if resp.status_code < 500:
                return "UP", latency
            return "DOWN", latency

        except (httpx.HTTPStatusError, Exception):
            pass  # fall through to GET

    # --- Fallback to GET ---
    try:
        start = loop.time()
        # Use a short timeout for GET to avoid hanging on large pages
        resp = await client.get(url, headers=HEADERS)
        latency = int((loop.time() - start) * 1000)

        if resp.status_code < 500:
            return "UP", latency
        if is_hf_space and resp.status_code == 503:
            return "AWAKENING", latency
        return "DOWN", latency

    except httpx.TimeoutException:
        return "DOWN", 0
    except httpx.ConnectError:
        return "DOWN", 0
    except Exception:
        return "DOWN", 0


async def ping_all_monitors():
    """Ping all monitors that are due for a check."""
    db: Session = SessionLocal()
    try:
        monitors = db.query(models.Monitor).filter(models.Monitor.user_id.isnot(None)).all()
        if not monitors:
            return

        now = datetime.now(timezone.utc)

        # Collect monitors that are due
        due = []
        for monitor in monitors:
            if monitor.last_checked:
                # Use astimezone to safely convert naive or aware datetimes to UTC
                last = monitor.last_checked
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                else:
                    last = last.astimezone(timezone.utc)
                elapsed = (now - last).total_seconds()
                if elapsed < monitor.interval_seconds - 2:
                    continue
            due.append(monitor)

        if not due:
            return

        # Reuse one client for the whole cycle — avoids per-ping DNS resolution overhead
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=12.0, write=5.0, pool=2.0),
            follow_redirects=True,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        ) as client:
            # Ping concurrently
            results = await asyncio.gather(
                *[ping_url(client, m.url) for m in due],
                return_exceptions=True,
            )

        for monitor, result in zip(due, results):
            if isinstance(result, Exception):
                raw_status, latency = "DOWN", 0
            else:
                raw_status, latency = result

            monitor_id = monitor.id

            # Consecutive failure guard: only flip to DOWN after N failures
            if raw_status == "DOWN":
                _consecutive_failures[monitor_id] = _consecutive_failures.get(monitor_id, 0) + 1
                if _consecutive_failures[monitor_id] < FAILURES_BEFORE_DOWN:
                    status = monitor.status  # keep current
                else:
                    status = "DOWN"
            elif raw_status == "AWAKENING":
                _consecutive_failures[monitor_id] = 0  # reset failure count while booting
                status = "AWAKENING"
            else:
                _consecutive_failures[monitor_id] = 0  # reset on success
                status = "UP"

            previous_status = monitor.status

            # Update monitor record
            monitor.status = status
            monitor.last_checked = now

            # Log every ping (including intermediate failures)
            log = models.MonitorLog(
                monitor_id=monitor_id,
                status=raw_status,  # log the raw result
                latency=latency,
            )
            db.add(log)

            # Alert only on confirmed status changes
            if previous_status != status:
                try:
                    owner = db.query(models.User).filter(models.User.id == monitor.user_id).first()
                    if owner:
                        alert_email = owner.notification_email or owner.email
                        if alert_email:
                            from services.mailer import send_status_change_email
                            send_status_change_email(
                                to=alert_email,
                                site_name=monitor.name,
                                site_url=monitor.url,
                                new_status=status,
                            )
                except Exception as e:
                    print(f"Alert email failed: {e}")

        db.commit()
        print(f"✅ Pinged {len(due)} monitor(s)")

    except Exception as e:
        print(f"Pinger error: {e}")
        db.rollback()
    finally:
        db.close()


async def start_pinger():
    """Run the pinger loop every 30 seconds."""
    print("🔄 Pinger engine started")
    while True:
        try:
            await ping_all_monitors()
            from services.scheduler import run_due_scheduled_jobs
            await run_due_scheduled_jobs()
        except Exception as e:
            print(f"Pinger loop error: {e}")
        await asyncio.sleep(30)
