"""
AYC Global Market — Production Database
SQLite (dev) / PostgreSQL (prod) — SQLAlchemy 2.x
"""
from __future__ import annotations
import os
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, String, Float, Boolean,
    DateTime, Integer, Text, Enum as SAEnum, Index
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
import enum

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./ayc_market.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class TierEnum(str, enum.Enum):
    free  = "free"
    pro   = "pro"
    elite = "elite"


class ProviderEnum(str, enum.Enum):
    stripe        = "stripe"
    iyzico        = "iyzico"
    paytr         = "paytr"
    lemonsqueezy  = "lemonsqueezy"
    apple_iap     = "apple_iap"
    google_play   = "google_play"
    manual        = "manual"


class SubStatusEnum(str, enum.Enum):
    active    = "active"
    cancelled = "cancelled"
    expired   = "expired"
    pending   = "pending"


# ── Models ───────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id            = Column(String(36), primary_key=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    display_name  = Column(String(100))
    password_hash = Column(String(255), nullable=False)
    tier          = Column(SAEnum(TierEnum), default=TierEnum.free, nullable=False)
    language      = Column(String(8), default="tr")
    risk_level    = Column(String(10), default="medium")
    is_active     = Column(Boolean, default=True)
    email_verified= Column(Boolean, default=False)
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime(timezone=True))


class Subscription(Base):
    __tablename__ = "subscriptions"
    id            = Column(String(36), primary_key=True)
    user_id       = Column(String(36), nullable=False, index=True)
    plan          = Column(SAEnum(TierEnum), nullable=False)
    provider      = Column(SAEnum(ProviderEnum), nullable=False)
    provider_sub_id = Column(String(255))        # Stripe subscription ID
    status        = Column(SAEnum(SubStatusEnum), default=SubStatusEnum.active)
    price_usd     = Column(Float, default=0.0)
    price_try     = Column(Float, default=0.0)
    started_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at    = Column(DateTime(timezone=True))
    cancelled_at  = Column(DateTime(timezone=True))
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Transaction(Base):
    __tablename__ = "transactions"
    id            = Column(String(36), primary_key=True)
    user_id       = Column(String(36), nullable=False, index=True)
    subscription_id = Column(String(36))
    provider      = Column(SAEnum(ProviderEnum))
    provider_txn_id = Column(String(255))       # Stripe payment_intent id
    amount        = Column(Float, nullable=False)
    currency      = Column(String(8), default="USD")
    status        = Column(String(32))           # succeeded / failed / pending
    plan          = Column(SAEnum(TierEnum))
    extra_data     = Column(Text, default="{}")
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    token     = Column(String(255), primary_key=True)
    user_id   = Column(String(36), nullable=False, index=True)
    expires_at= Column(DateTime(timezone=True), nullable=False)
    revoked   = Column(Boolean, default=False)
    created_at= Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ── Helpers ──────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    print("[DB] Tables created / verified.")

