from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import secrets
import hashlib

import models
import schemas
from dependencies import get_db, get_current_user
from config import settings

router = APIRouter(prefix="/api/gateway-keys", tags=["gateway_keys"])

def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()

@router.get("", response_model=List[schemas.GatewayApiKeyResponse])
def get_gateway_keys(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.GatewayApiKey).filter(models.GatewayApiKey.user_id == current_user.id).all()

@router.post("", response_model=schemas.GatewayApiKeyRevealResponse)
def create_gateway_key(key_in: schemas.GatewayApiKeyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Generate the actual token string
    raw_token = "cc-sk-" + secrets.token_urlsafe(32)
    prefix = raw_token[:12] + "..."
    key_hash = _hash_key(raw_token)
    
    new_key = models.GatewayApiKey(
        user_id=current_user.id,
        name=key_in.name,
        key_hash=key_hash,
        prefix=prefix
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    # Return the plaintext key exactly once
    return schemas.GatewayApiKeyRevealResponse(
        id=new_key.id,
        name=new_key.name,
        prefix=new_key.prefix,
        last_used_at=new_key.last_used_at,
        created_at=new_key.created_at,
        key_value=raw_token,
        gateway_url=settings.GATEWAY_PUBLIC_URL,
    )

@router.delete("/{key_id}")
def delete_gateway_key(key_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    key = db.query(models.GatewayApiKey).filter(
        models.GatewayApiKey.id == key_id,
        models.GatewayApiKey.user_id == current_user.id
    ).first()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    db.delete(key)
    db.commit()
    return {"status": "deleted"}
