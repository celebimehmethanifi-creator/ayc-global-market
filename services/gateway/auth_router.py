"""
AYC Global Market — Auth Router
POST /auth/register   → kayıt
POST /auth/login      → giriş  
POST /auth/refresh    → token yenile
POST /auth/logout     → çıkış
GET  /auth/me         → profil
PUT  /auth/me         → profil güncelle
POST /auth/change-password
"""
from __future__ import annotations
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from database import User, RefreshToken, get_db
from auth_service import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user,
)

router = APIRouter(tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: str
    password: str
    name: str = ""

class LoginIn(BaseModel):
    email: str
    password: str

class RefreshIn(BaseModel):
    refresh_token: str

class UpdateProfileIn(BaseModel):
    display_name: str | None = None
    language: str | None = None
    risk_level: str | None = None

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


def _user_out(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name or u.email.split("@")[0],
        "tier": u.tier.value if hasattr(u.tier, "value") else u.tier,
        "language": u.language,
        "risk_level": u.risk_level,
        "email_verified": u.email_verified,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ── Endpoints ────────────────────────────────────────────────────

@router.post("/auth/register", status_code=201)
async def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Geçerli bir e-posta girin")
    if len(body.password) < 6:
        raise HTTPException(400, "Şifre en az 6 karakter olmalı")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Bu e-posta zaten kayıtlı")

    user = User(
        id=str(uuid4()),
        email=email,
        display_name=body.name or email.split("@")[0],
        password_hash=hash_password(body.password),
        tier="free",
    )
    db.add(user); db.commit(); db.refresh(user)

    access  = create_access_token(user.id, user.tier.value if hasattr(user.tier,"value") else user.tier)
    refresh = create_refresh_token(user.id, db)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer", "user": _user_out(user)}


@router.post("/auth/login")
async def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user  = db.query(User).filter(User.email == email, User.is_active == True).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "E-posta veya şifre hatalı")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    access  = create_access_token(user.id, user.tier.value if hasattr(user.tier,"value") else user.tier)
    refresh = create_refresh_token(user.id, db)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer", "user": _user_out(user)}


@router.post("/auth/refresh")
async def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    rt = db.query(RefreshToken).filter(
        RefreshToken.token == body.refresh_token,
        RefreshToken.revoked == False,
    ).first()
    if not rt or rt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(401, "Refresh token geçersiz veya süresi dolmuş")

    user = db.query(User).filter(User.id == rt.user_id).first()
    if not user:
        raise HTTPException(401, "Kullanıcı bulunamadı")

    rt.revoked = True; db.commit()
    new_access  = create_access_token(user.id, user.tier.value if hasattr(user.tier,"value") else user.tier)
    new_refresh = create_refresh_token(user.id, db)
    return {"access_token": new_access, "refresh_token": new_refresh, "token_type": "bearer"}


@router.post("/auth/logout")
async def logout(body: RefreshIn, db: Session = Depends(get_db)):
    rt = db.query(RefreshToken).filter(RefreshToken.token == body.refresh_token).first()
    if rt:
        rt.revoked = True; db.commit()
    return {"message": "Çıkış yapıldı"}


@router.get("/auth/me")
async def me(user: User = Depends(get_current_user)):
    return {"user": _user_out(user)}


@router.put("/auth/me")
async def update_me(body: UpdateProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.display_name is not None: user.display_name = body.display_name
    if body.language     is not None: user.language     = body.language
    if body.risk_level   is not None: user.risk_level   = body.risk_level
    db.commit(); db.refresh(user)
    return {"user": _user_out(user)}


@router.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Mevcut şifre hatalı")
    if len(body.new_password) < 6:
        raise HTTPException(400, "Yeni şifre en az 6 karakter olmalı")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Şifre değiştirildi"}
