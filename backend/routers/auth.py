from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

import models
import schemas
from dependencies import get_db, get_current_user
from security import hash_password, verify_password, create_access_token
from limiter import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, req: schemas.RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account with Argon2id-hashed password."""
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = models.User(
        email=req.email,
        password_hash=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"user_id": user.id, "email": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=schemas.TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, req: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT access token."""
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token({"user_id": user.id, "email": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return current_user
