"""
AYC Global Market — Auth Service
JWT access + refresh tokens, bcrypt passwords
"""
from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4
from passlib.context import CryptContext
from jose import jwt, JWTError
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import User, RefreshToken, get_db

SECRET_KEY    = os.environ.get("SECRET_KEY", "ayc-global-market-secret-2026-CHANGE-THIS")
ALGORITHM     = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES  = 60 * 24          # 24h
REFRESH_TOKEN_EXPIRE_DAYS    = 30

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
bearer  = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    import bcrypt as _bcrypt
    return _bcrypt.hashpw(password[:72].encode(), _bcrypt.gensalt(12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    import bcrypt as _bcrypt
    try:
        return _bcrypt.checkpw(plain[:72].encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, tier: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "tier": tier, "exp": expire, "type": "access"},
        SECRET_KEY, algorithm=ALGORITHM,
    )


def create_refresh_token(user_id: str, db: Session) -> str:
    token = uuid4().hex + uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    rt = RefreshToken(token=token, user_id=user_id, expires_at=expires)
    db.add(rt)
    db.commit()
    return token


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Geçersiz token türü")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token geçersiz veya süresi dolmuş")


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor")
    payload = decode_access_token(creds.credentials)
    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


def get_current_user_optional(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Anonim erişim izinli endpoint'ler için."""
    try:
        return get_current_user(creds, db)
    except HTTPException:
        return None


def require_tier(min_tier: str):
    """Feature gating — Depends(require_tier("pro")) ile kullan."""
    TIER_RANK = {"free": 0, "pro": 1, "elite": 2}
    def dep(user: User = Depends(get_current_user)):
        if TIER_RANK.get(user.tier.value, 0) < TIER_RANK.get(min_tier, 0):
            raise HTTPException(
                status_code=403,
                detail=f"Bu özellik {min_tier.upper()} planı gerektirir",
                headers={"X-Upgrade-Required": min_tier},
            )
        return user
    return dep


