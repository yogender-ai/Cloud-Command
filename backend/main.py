"""
Cloud Command — Unified DevOps Command Center
Main FastAPI application entry point.
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import date

from database import engine, SessionLocal
from models import Base, PlatformVisit
from config import settings
from limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


# ── Lifespan: DB init + background pinger ──

async def run_pinger_background():
    """Start the background pinger task."""
    from services.pinger import start_pinger
    await start_pinger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created/verified")

    # Safe migrations: add new nullable columns without losing existing data
    # create_all() never alters existing tables, so we do it manually.
    _safe_migrate()

    # Start background pinger
    pinger_task = asyncio.create_task(run_pinger_background())

    yield

    # Shutdown
    pinger_task.cancel()
    try:
        await pinger_task
    except asyncio.CancelledError:
        pass


def _safe_migrate():
    """
    Add new columns to existing tables without destroying data.
    Each statement uses IF NOT EXISTS (PostgreSQL ≥ 9.6) so it's
    idempotent — safe to run on every startup.
    """
    migrations = [
        # Category columns added in v2.1.0
        "ALTER TABLE monitors          ADD COLUMN IF NOT EXISTS category VARCHAR(100)",
        "ALTER TABLE api_keys          ADD COLUMN IF NOT EXISTS category VARCHAR(100)",
        "ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS category VARCHAR(100)",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(__import__("sqlalchemy").text(sql))
                conn.commit()
            except Exception as e:
                # PostgreSQL raises if column already exists (shouldn't with IF NOT EXISTS),
                # or if running SQLite which uses different syntax — just skip.
                print(f"⚠️  Migration skipped ({e.__class__.__name__}): {sql[:60]}")
    print("Safe migrations applied")


# ── App ──

app = FastAPI(
    title="Cloud Command",
    description="Unified DevOps Command Center — API Monitoring, Site Monitoring, Render & Vercel Management",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Rate Limiter ──
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Mount Routers ──

from routers.auth import router as auth_router
from routers.monitors import router as monitors_router
from routers.apikeys import router as apikeys_router
from routers.render import router as render_router
from routers.vercel import router as vercel_router
from routers.settings import router as settings_router
from routers.tracking import router as tracking_router

app.include_router(auth_router)
app.include_router(monitors_router)
app.include_router(apikeys_router)
app.include_router(render_router)
app.include_router(vercel_router)
app.include_router(settings_router)
app.include_router(tracking_router)


# ── Utility Endpoints ──

@app.get("/api/keep-alive")
def keep_alive():
    """Health check endpoint for uptime robots and self-ping."""
    return {"status": "alive", "service": "cloud-command"}


@app.post("/api/analytics/visit")
def record_visit():
    """Record a platform visit for analytics."""
    db = SessionLocal()
    try:
        today = date.today()
        visit = db.query(PlatformVisit).filter(PlatformVisit.date == today).first()
        if visit:
            visit.visits += 1
        else:
            visit = PlatformVisit(date=today, visits=1)
            db.add(visit)
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@app.get("/api/analytics/visits")
def get_visits():
    """Get platform visit analytics for the last 30 days."""
    db = SessionLocal()
    try:
        visits = (
            db.query(PlatformVisit)
            .order_by(PlatformVisit.date.desc())
            .limit(30)
            .all()
        )
        return [{"date": v.date.isoformat(), "visits": v.visits} for v in visits]
    finally:
        db.close()


# ── Self-Ping (prevent Render free tier sleep) ──

if settings.RENDER_EXTERNAL_URL:
    import httpx

    async def self_ping():
        while True:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"{settings.RENDER_EXTERNAL_URL}/api/keep-alive")
                    print(f"🏓 Self-ping: {resp.status_code}")
            except Exception as e:
                print(f"🏓 Self-ping error: {e}")
            await asyncio.sleep(600)  # 10 minutes

    @app.on_event("startup")
    async def start_self_ping():
        asyncio.create_task(self_ping())
