from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

import models
import schemas
from dependencies import get_db, get_current_user

router = APIRouter(prefix="/api/keygroups", tags=["key-groups"])

VALID_STRATEGIES = ["round-robin", "fallback", "random"]


def _build_member_response(member: models.ApiKeyGroupMember) -> schemas.ApiKeyGroupMemberResponse:
    """Build a member response with key info."""
    return schemas.ApiKeyGroupMemberResponse(
        id=member.id,
        api_key_id=member.api_key_id,
        key_name=member.api_key.name if member.api_key else None,
        provider=member.api_key.provider if member.api_key else None,
        masked_key=member.api_key.masked_key if member.api_key else None,
        status=member.api_key.status if member.api_key else None,
        priority=member.priority,
        is_enabled=member.is_enabled,
    )


def _build_group_response(group: models.ApiKeyGroup) -> schemas.ApiKeyGroupResponse:
    """Build a group response with all member details."""
    members = [_build_member_response(m) for m in sorted(group.members, key=lambda m: m.priority)]
    return schemas.ApiKeyGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        strategy=group.strategy,
        members=members,
        created_at=group.created_at,
    )


@router.get("", response_model=List[schemas.ApiKeyGroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List all key groups for the current user."""
    groups = (
        db.query(models.ApiKeyGroup)
        .filter(models.ApiKeyGroup.user_id == user.id)
        .order_by(models.ApiKeyGroup.created_at.desc())
        .all()
    )
    return [_build_group_response(g) for g in groups]


@router.post("", response_model=schemas.ApiKeyGroupResponse, status_code=201)
def create_group(
    req: schemas.ApiKeyGroupCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Create a new key group with optional initial members."""
    if req.strategy not in VALID_STRATEGIES:
        raise HTTPException(status_code=400, detail=f"Invalid strategy. Must be one of: {VALID_STRATEGIES}")

    group = models.ApiKeyGroup(
        user_id=user.id,
        name=req.name,
        description=req.description,
        strategy=req.strategy,
    )
    db.add(group)
    db.flush()

    # Add initial members if provided
    if req.member_ids:
        for priority, key_id in enumerate(req.member_ids):
            key = db.query(models.ApiKey).filter(
                models.ApiKey.id == key_id,
                models.ApiKey.user_id == user.id,
            ).first()
            if not key:
                raise HTTPException(status_code=404, detail=f"API key {key_id} not found")
            member = models.ApiKeyGroupMember(
                group_id=group.id,
                api_key_id=key_id,
                priority=priority,
            )
            db.add(member)

    db.commit()
    db.refresh(group)
    return _build_group_response(group)


@router.patch("/{group_id}", response_model=schemas.ApiKeyGroupResponse)
def update_group(
    group_id: int,
    req: schemas.ApiKeyGroupUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Update group name, description or strategy."""
    group = db.query(models.ApiKeyGroup).filter(
        models.ApiKeyGroup.id == group_id,
        models.ApiKeyGroup.user_id == user.id,
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Key group not found")

    if req.name is not None:
        group.name = req.name
    if req.description is not None:
        group.description = req.description
    if req.strategy is not None:
        if req.strategy not in VALID_STRATEGIES:
            raise HTTPException(status_code=400, detail=f"Invalid strategy. Must be one of: {VALID_STRATEGIES}")
        group.strategy = req.strategy

    db.commit()
    db.refresh(group)
    return _build_group_response(group)


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Delete a key group (does NOT delete the underlying API keys)."""
    group = db.query(models.ApiKeyGroup).filter(
        models.ApiKeyGroup.id == group_id,
        models.ApiKeyGroup.user_id == user.id,
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Key group not found")

    db.delete(group)
    db.commit()


@router.post("/{group_id}/members", response_model=schemas.ApiKeyGroupMemberResponse, status_code=201)
def add_member(
    group_id: int,
    req: schemas.ApiKeyGroupMemberCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Add an API key to a group."""
    group = db.query(models.ApiKeyGroup).filter(
        models.ApiKeyGroup.id == group_id,
        models.ApiKeyGroup.user_id == user.id,
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Key group not found")

    key = db.query(models.ApiKey).filter(
        models.ApiKey.id == req.api_key_id,
        models.ApiKey.user_id == user.id,
    ).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    # Check for duplicate
    existing = db.query(models.ApiKeyGroupMember).filter(
        models.ApiKeyGroupMember.group_id == group_id,
        models.ApiKeyGroupMember.api_key_id == req.api_key_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Key already in this group")

    member = models.ApiKeyGroupMember(
        group_id=group_id,
        api_key_id=req.api_key_id,
        priority=req.priority,
        is_enabled=req.is_enabled,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return _build_member_response(member)


@router.delete("/{group_id}/members/{member_id}", status_code=204)
def remove_member(
    group_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Remove a key from a group."""
    group = db.query(models.ApiKeyGroup).filter(
        models.ApiKeyGroup.id == group_id,
        models.ApiKeyGroup.user_id == user.id,
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Key group not found")

    member = db.query(models.ApiKeyGroupMember).filter(
        models.ApiKeyGroupMember.id == member_id,
        models.ApiKeyGroupMember.group_id == group_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()


@router.patch("/{group_id}/members/{member_id}", response_model=schemas.ApiKeyGroupMemberResponse)
def update_member(
    group_id: int,
    member_id: int,
    req: schemas.ApiKeyGroupMemberCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Update member priority or enabled status."""
    group = db.query(models.ApiKeyGroup).filter(
        models.ApiKeyGroup.id == group_id,
        models.ApiKeyGroup.user_id == user.id,
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Key group not found")

    member = db.query(models.ApiKeyGroupMember).filter(
        models.ApiKeyGroupMember.id == member_id,
        models.ApiKeyGroupMember.group_id == group_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.priority = req.priority
    member.is_enabled = req.is_enabled
    db.commit()
    db.refresh(member)
    return _build_member_response(member)
