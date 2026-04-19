"""
Cloud Command — Unified DevOps Command Center
Main FastAPI application entry point.
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import date

from database import engine, SessionLocal
from models import Base, PlatformVisit
from config import settings


# ── Lifespan: DB init + background pinger ──

async def run_pinger_background():
    """Start the background pinger task."""
    from services.pinger import start_pinger
    await start_pinger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created/verified")

    # Start background pinger
    pinger_task = asyncio.create_task(run_pinger_background())

    yield

    # Shutdown
    pinger_task.cancel()
    try:
        await pinger_task
    except asyncio.CancelledError:
        pass


# ── App ──

app = FastAPI(
    title="Cloud Command",
    description="Unified DevOps Command Center — API Monitoring, Site Monitoring, Render & Vercel Management",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Mount Routers ──

from routers.auth import router as auth_router
from routers.monitors import router as monitors_router
from routers.apikeys import router as apikeys_router
from routers.render import router as render_router
from routers.vercel import router as vercel_router
from routers.settings import router as settings_router

app.include_router(auth_router)
app.include_router(monitors_router)
app.include_router(apikeys_router)
app.include_router(render_router)
app.include_router(vercel_router)
app.include_router(settings_router)


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
