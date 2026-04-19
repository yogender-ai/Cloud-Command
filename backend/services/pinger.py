"""
Site Pinger — Background task that pings all monitored URLs.
Ported from the original Node.js site-monitoring pinger.
"""

import asyncio
import httpx
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from database import SessionLocal
import models


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


async def ping_url(url: str, retries: int = 3) -> tuple[str, int]:
    """
    Ping a URL with retries. Returns (status, latency_ms).
    """
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                start = asyncio.get_event_loop().time()
                resp = await client.get(url, headers=HEADERS)
                latency = int((asyncio.get_event_loop().time() - start) * 1000)

                if 200 <= resp.status_code < 400:
                    return "UP", latency
                else:
                    if attempt < retries - 1:
                        await asyncio.sleep(1)
                        continue
                    return "DOWN", latency
        except Exception:
            if attempt < retries - 1:
                await asyncio.sleep(1)
                continue
            return "DOWN", 0

    return "DOWN", 0


async def ping_all_monitors():
    """Ping all monitors that are due for a check."""
    db: Session = SessionLocal()
    try:
        monitors = db.query(models.Monitor).filter(models.Monitor.user_id.isnot(None)).all()

        for monitor in monitors:
            now = datetime.now(timezone.utc)
            if monitor.last_checked:
                elapsed = (now - monitor.last_checked.replace(tzinfo=timezone.utc)).total_seconds()
                if elapsed < monitor.interval_seconds - 2:
                    continue

            previous_status = monitor.status
            status, latency = await ping_url(monitor.url)

            # Update monitor
            monitor.status = status
            monitor.last_checked = now

            # Log
            log = models.MonitorLog(
                monitor_id=monitor.id,
                status=status,
                latency=latency,
            )
            db.add(log)

            # Send alerts on status change
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
    except Exception as e:
        print(f"Pinger error: {e}")
        db.rollback()
    finally:
        db.close()


async def start_pinger():
    """Run the pinger loop every 30 seconds."""
    print("🔄 Pinger engine started")
    while True:
        await ping_all_monitors()
        await asyncio.sleep(30)
