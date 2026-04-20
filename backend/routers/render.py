"""
Render Account Management — Proxy routes to Render's REST API.
Supports up to 10 accounts per user.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import httpx

import models
import schemas
from dependencies import get_db, get_current_user
from security import encrypt_value, decrypt_value
from config import settings

router = APIRouter(prefix="/api/render", tags=["render"])

RENDER_API = "https://api.render.com/v1"


def _get_account(db: Session, user: models.User, account_id: int) -> models.PlatformAccount:
    """Get a verified Render account for the user."""
    account = (
        db.query(models.PlatformAccount)
        .filter(
            models.PlatformAccount.id == account_id,
            models.PlatformAccount.user_id == user.id,
            models.PlatformAccount.provider == "render",
        )
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Render account not found")
    return account


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


# ── Account Management ──


@router.get("/accounts", response_model=List[schemas.PlatformAccountResponse])
def list_accounts(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """List all connected Render accounts."""
    return (
        db.query(models.PlatformAccount)
        .filter(models.PlatformAccount.user_id == user.id, models.PlatformAccount.provider == "render")
        .order_by(models.PlatformAccount.created_at.desc())
        .all()
    )


@router.post("/accounts", response_model=schemas.PlatformAccountResponse, status_code=201)
async def connect_account(
    req: schemas.PlatformAccountCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Connect a new Render account (validates the token first)."""
    count = (
        db.query(models.PlatformAccount)
        .filter(models.PlatformAccount.user_id == user.id, models.PlatformAccount.provider == "render")
        .count()
    )
    if count >= settings.MAX_PLATFORM_ACCOUNTS_PER_USER:
        raise HTTPException(status_code=403, detail=f"Max {settings.MAX_PLATFORM_ACCOUNTS_PER_USER} Render accounts")

    # Validate token by calling Render API
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{RENDER_API}/owners", headers=_headers(req.api_token))
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Render API key — could not authenticate")

    account = models.PlatformAccount(
        user_id=user.id,
        provider="render",
        account_name=req.account_name,
        category=req.category,
        encrypted_token=encrypt_value(req.api_token),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/accounts/{account_id}", status_code=204)
def disconnect_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Disconnect a Render account."""
    account = _get_account(db, user, account_id)
    db.delete(account)
    db.commit()


@router.patch("/accounts/{account_id}", response_model=schemas.PlatformAccountResponse)
def update_account(
    account_id: int,
    req: schemas.MonitorUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Update the label and/or category of a connected Render account."""
    account = _get_account(db, user, account_id)
    if req.name is not None:
        account.account_name = req.name
    if req.category is not None:
        account.category = req.category
    elif req.clear_category:
        account.category = None
    db.commit()
    db.refresh(account)
    return account


# ── Services ──


@router.get("/accounts/{account_id}/services")
async def list_services(
    account_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List all services for a Render account."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{RENDER_API}/services", headers=_headers(token), params={"limit": 50})
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch services from Render")
        return resp.json()


@router.get("/accounts/{account_id}/services/{service_id}")
async def get_service(
    account_id: int,
    service_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get details for a specific Render service."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{RENDER_API}/services/{service_id}", headers=_headers(token))
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch service")
        return resp.json()


@router.get("/accounts/{account_id}/services/{service_id}/deploys")
async def list_deploys(
    account_id: int,
    service_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List recent deploys for a Render service."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{RENDER_API}/services/{service_id}/deploys",
            headers=_headers(token),
            params={"limit": 20},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch deploys")
        return resp.json()


@router.post("/accounts/{account_id}/services/{service_id}/deploys")
async def trigger_deploy(
    account_id: int,
    service_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Trigger a manual deploy for a Render service."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{RENDER_API}/services/{service_id}/deploys",
            headers=_headers(token),
        )
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=resp.status_code, detail="Failed to trigger deploy")
        return resp.json()


@router.post("/accounts/{account_id}/services/{service_id}/suspend")
async def suspend_service(
    account_id: int,
    service_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Suspend a Render service."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{RENDER_API}/services/{service_id}/suspend",
            headers=_headers(token),
        )
        if resp.status_code not in (200, 202):
            raise HTTPException(status_code=resp.status_code, detail="Failed to suspend service")
        return {"status": "suspended"}


@router.post("/accounts/{account_id}/services/{service_id}/resume")
async def resume_service(
    account_id: int,
    service_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Resume a suspended Render service."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{RENDER_API}/services/{service_id}/resume",
            headers=_headers(token),
        )
        if resp.status_code not in (200, 202):
            raise HTTPException(status_code=resp.status_code, detail="Failed to resume service")
        return {"status": "resumed"}


@router.get("/accounts/{account_id}/services/{service_id}/env")
async def get_env_vars(
    account_id: int,
    service_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get environment variables for a Render service."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{RENDER_API}/services/{service_id}/env-vars",
            headers=_headers(token),
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch env vars")
        return resp.json()
