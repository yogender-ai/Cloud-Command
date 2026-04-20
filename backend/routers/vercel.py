"""
Vercel Account Management — Proxy routes to Vercel's REST API.
Supports up to 10 accounts per user.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import httpx

import models
import schemas
from dependencies import get_db, get_current_user
from security import encrypt_value, decrypt_value
from config import settings

router = APIRouter(prefix="/api/vercel", tags=["vercel"])

VERCEL_API = "https://api.vercel.com"


def _get_account(db: Session, user: models.User, account_id: int) -> models.PlatformAccount:
    account = (
        db.query(models.PlatformAccount)
        .filter(
            models.PlatformAccount.id == account_id,
            models.PlatformAccount.user_id == user.id,
            models.PlatformAccount.provider == "vercel",
        )
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Vercel account not found")
    return account


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── Account Management ──


@router.get("/accounts", response_model=List[schemas.PlatformAccountResponse])
def list_accounts(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """List all connected Vercel accounts."""
    return (
        db.query(models.PlatformAccount)
        .filter(models.PlatformAccount.user_id == user.id, models.PlatformAccount.provider == "vercel")
        .order_by(models.PlatformAccount.created_at.desc())
        .all()
    )


@router.post("/accounts", response_model=schemas.PlatformAccountResponse, status_code=201)
async def connect_account(
    req: schemas.PlatformAccountCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Connect a new Vercel account (validates the token first)."""
    count = (
        db.query(models.PlatformAccount)
        .filter(models.PlatformAccount.user_id == user.id, models.PlatformAccount.provider == "vercel")
        .count()
    )
    if count >= settings.MAX_PLATFORM_ACCOUNTS_PER_USER:
        raise HTTPException(status_code=403, detail=f"Max {settings.MAX_PLATFORM_ACCOUNTS_PER_USER} Vercel accounts")

    # Validate token
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{VERCEL_API}/v2/user", headers=_headers(req.api_token))
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Vercel token — could not authenticate")

    account = models.PlatformAccount(
        user_id=user.id,
        provider="vercel",
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
    """Disconnect a Vercel account."""
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
    """Update the label and/or category of a connected Vercel account."""
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


# ── Projects ──


@router.get("/accounts/{account_id}/projects")
async def list_projects(
    account_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List all projects for a Vercel account."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{VERCEL_API}/v9/projects", headers=_headers(token))
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch projects from Vercel")
        return resp.json()


@router.get("/accounts/{account_id}/projects/{project_id}")
async def get_project(
    account_id: int,
    project_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get details for a specific Vercel project."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{VERCEL_API}/v9/projects/{project_id}", headers=_headers(token))
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch project")
        return resp.json()


@router.get("/accounts/{account_id}/deployments")
async def list_deployments(
    account_id: int,
    project_id: str = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List recent deployments for a Vercel account (optionally filtered by project)."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    params = {"limit": 20}
    if project_id:
        params["projectId"] = project_id

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{VERCEL_API}/v6/deployments", headers=_headers(token), params=params)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch deployments")
        return resp.json()


@router.get("/accounts/{account_id}/deployments/{deployment_id}/events")
async def get_deployment_events(
    account_id: int,
    deployment_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get build logs / events for a specific deployment."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{VERCEL_API}/v2/deployments/{deployment_id}/events", headers=_headers(token))
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch deployment events")
        return resp.json()


@router.post("/accounts/{account_id}/projects/{project_id}/redeploy")
async def redeploy_project(
    account_id: int,
    project_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Trigger a redeployment for the latest production deployment of a project."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get latest deployment
        resp = await client.get(
            f"{VERCEL_API}/v6/deployments",
            headers=_headers(token),
            params={"projectId": project_id, "limit": 1, "target": "production"},
        )
        if resp.status_code != 200 or not resp.json().get("deployments"):
            raise HTTPException(status_code=400, detail="No deployments found to redeploy")

        latest = resp.json()["deployments"][0]

        # Redeploy
        redeploy_resp = await client.post(
            f"{VERCEL_API}/v13/deployments",
            headers=_headers(token),
            json={"name": latest.get("name"), "deploymentId": latest["uid"], "target": "production"},
        )
        if redeploy_resp.status_code not in (200, 201):
            raise HTTPException(status_code=redeploy_resp.status_code, detail="Failed to trigger redeployment")
        return redeploy_resp.json()


@router.get("/accounts/{account_id}/projects/{project_id}/env")
async def get_env_vars(
    account_id: int,
    project_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get environment variables for a Vercel project."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{VERCEL_API}/v9/projects/{project_id}/env",
            headers=_headers(token),
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch env vars")
        return resp.json()


@router.get("/accounts/{account_id}/domains")
async def list_domains(
    account_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List all domains for a Vercel account."""
    account = _get_account(db, user, account_id)
    token = decrypt_value(account.encrypted_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{VERCEL_API}/v5/domains", headers=_headers(token))
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch domains")
        return resp.json()
