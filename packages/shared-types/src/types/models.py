"""
NEURA Shared Pydantic Models
Used by all Python services via: from packages.shared_types import ...
"""
from __future__ import annotations
from enum import Enum
from typing import Any, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AssetCategory(str, Enum):
    ALL = "ALL"
    BIST = "BIST"
    US = "US"
    CRYPTO = "CRYPTO"
    COMMODITY = "COMMODITY"
    ENERGY = "ENERGY"
    FOREX = "FOREX"
    INDEX = "INDEX"
    ETF = "ETF"


class SignalDirection(str, Enum):
    LONG = "long"
    SHORT = "short"
    NEUTRAL = "neutral"


class UserTier(str, Enum):
    FREE = "free"
    PRO = "pro"
    ELITE = "elite"


class AlarmType(str, Enum):
    PRICE = "price"
    SIGNAL = "signal"
    DRAWDOWN = "drawdown"
    CONTRARIAN = "contrarian"
    EMOTIONAL = "emotional"
    KALKAN = "kalkan"


class VoteDirection(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


# ---------------------------------------------------------------------------
# Asset Models
# ---------------------------------------------------------------------------

class AssetBase(BaseModel):
    symbol: str
    name: str
    category: AssetCategory
    exchange: Optional[str] = None
    currency: str = "USD"
    data_source: list[str] = []
    meta: dict[str, Any] = {}


class AssetOut(AssetBase):
    id: UUID
    is_active: bool

    class Config:
        from_attributes = True


class PriceData(BaseModel):
    asset_id: UUID
    symbol: str
    price: Decimal
    open: Optional[Decimal] = None
    high: Optional[Decimal] = None
    low: Optional[Decimal] = None
    volume: Optional[Decimal] = None
    change_pct: Optional[Decimal] = None
    source: str
    fetched_at: datetime


# ---------------------------------------------------------------------------
# Signal Models
# ---------------------------------------------------------------------------

class ModelVote(BaseModel):
    model: str
    direction: SignalDirection
    confidence: float
    entry_price: Optional[Decimal] = None
    target_price: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    reasoning: str


class ConsensusData(BaseModel):
    votes: list[ModelVote]
    final_direction: SignalDirection
    final_confidence: float
    direction_agreement: bool
    weights_used: dict[str, float]


class KalkanResult(BaseModel):
    blocked: bool
    reasons: list[str]
    block_level: str  # "hard" | "soft" | "none"


class SignalBase(BaseModel):
    asset_id: UUID
    direction: SignalDirection
    confidence: float
    entry_price: Optional[Decimal] = None
    target_price: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    risk_reward: Optional[float] = None
    timeframe: str = "1d"
    ai_reasoning: str = ""
    consensus_data: Optional[ConsensusData] = None
    kalkan_block: bool = False
    kalkan_reasons: list[str] = []


class SignalOut(SignalBase):
    id: UUID
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StrategyCard(BaseModel):
    signal_id: UUID
    asset_id: UUID
    symbol: str
    direction: SignalDirection
    entry_price: Decimal
    target1: Decimal
    target2: Optional[Decimal] = None
    stop_loss: Decimal
    risk_reward: float
    risk_amount_per_100: float  # 100 TL koyarsan max kayıp X
    reward_amount_per_100: float
    entry_timing: dict[str, Any] = {}
    exit_strategy: dict[str, Any] = {}
    disclaimer: str = "Bu içerik yatırım tavsiyesi değildir. Yatırım kararlarınızı kendi araştırmalarınıza dayandırınız."


# ---------------------------------------------------------------------------
# User Models
# ---------------------------------------------------------------------------

class RiskProfile(BaseModel):
    max_drawdown_pct: Optional[float] = None
    risk_tolerance: str = "medium"  # low | medium | high


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: Optional[str] = None
    tier: UserTier
    language: str = "tr"
    timezone: str = "Europe/Istanbul"
    risk_profile: RiskProfile = RiskProfile()
    investor_iq: int = 0

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Portfolio Models
# ---------------------------------------------------------------------------

class PositionBase(BaseModel):
    asset_id: UUID
    entry_price: Decimal
    quantity: Decimal
    entry_date: str
    notes: Optional[str] = None
    is_simulation: bool = False


class PositionOut(PositionBase):
    id: UUID
    portfolio_id: UUID
    current_price: Optional[Decimal] = None
    pnl: Optional[Decimal] = None
    pnl_pct: Optional[float] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Alarm Models
# ---------------------------------------------------------------------------

class AlarmBase(BaseModel):
    asset_id: Optional[UUID] = None
    alarm_type: AlarmType
    condition: dict[str, Any]


class AlarmOut(AlarmBase):
    id: UUID
    user_id: UUID
    is_active: bool
    triggered_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Social Models
# ---------------------------------------------------------------------------

class SocialVoteIn(BaseModel):
    direction: VoteDirection


class SentimentOut(BaseModel):
    asset_id: UUID
    symbol: str
    overall_score: float  # -100 to +100
    news_score: Optional[float] = None
    social_score: Optional[float] = None
    onchain_score: Optional[float] = None
    crowd_bullish_pct: float = 0
    crowd_bearish_pct: float = 0
    crowd_neutral_pct: float = 0
    contrarian_signal: bool = False
    analyzed_at: datetime


# ---------------------------------------------------------------------------
# Copilot Models
# ---------------------------------------------------------------------------

class CopilotChatIn(BaseModel):
    message: str
    context: dict[str, Any] = {}


class CopilotChatOut(BaseModel):
    reply: str
    referenced_signals: list[SignalOut] = []
    kalkan_warning: Optional[KalkanResult] = None
    suggested_actions: list[str] = []
    disclaimer: str = "Bu içerik yatırım tavsiyesi değildir."


# ---------------------------------------------------------------------------
# Common Response Wrappers
# ---------------------------------------------------------------------------

class PagedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    has_next: bool


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None
