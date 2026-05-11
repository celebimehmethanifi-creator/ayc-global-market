"""Signal Scheduler — triggers AI analysis for tracked assets (SQLite/PG fallback)"""
from __future__ import annotations
import asyncio
import json
import logging
import os
import uuid
from datetime import datetime

import httpx

from scorer import SignalScorer

log = logging.getLogger("signal-scheduler")

_DATABASE_URL_RAW = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./neura_signal.db")
if _DATABASE_URL_RAW.startswith("postgresql://"):
    DATABASE_URL = _DATABASE_URL_RAW.replace("postgresql://", "postgresql+asyncpg://")
elif _DATABASE_URL_RAW.startswith("postgres://"):
    DATABASE_URL = _DATABASE_URL_RAW.replace("postgres://", "postgresql+asyncpg://")
else:
    DATABASE_URL = _DATABASE_URL_RAW

_engine = None
_Session = None


def _get_session():
    global _engine, _Session
    if _engine is None:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
        _engine = create_async_engine(DATABASE_URL, echo=False)
        _Session = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    return _Session


scorer = SignalScorer()
SIGNAL_RUN_INTERVAL = 3600


class SignalScheduler:
    def __init__(self, redis, ai_service_url: str):
        self.redis = redis
        self.ai_url = ai_service_url

    async def run(self):
        log.info("Signal scheduler started")
        while True:
            try:
                await self._generate_signals_for_all()
            except Exception as e:
                log.error(f"Signal run error: {e}")
            await asyncio.sleep(SIGNAL_RUN_INTERVAL)

    async def _generate_signals_for_all(self):
        try:
            Session = _get_session()
            from sqlalchemy import text
            async with Session() as db:
                # SQLite uses 1/0 for booleans
                result = await db.execute(
                    text("SELECT id, symbol, category FROM assets WHERE is_active = 1 LIMIT 200")
                )
                assets = [dict(r) for r in result.mappings().all()]
        except Exception as e:
            log.warning(f"DB fetch skipped (no assets table yet): {e}")
            return

        log.info(f"Generating signals for {len(assets)} assets")
        tasks = [self._process_asset(a) for a in assets]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _process_asset(self, asset: dict):
        symbol = asset["symbol"]
        price_raw = await self.redis.get(f"price:{symbol}") if self.redis else None
        if not price_raw:
            return

        price_data = json.loads(price_raw)
        payload = {
            "asset_id": str(asset["id"]),
            "symbol": symbol,
            "category": asset["category"],
            "price_data": price_data,
            "user_context": {},
            "portfolio_context": {},
            "social_context": {},
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(f"{self.ai_url}/analysis/signal", json=payload)
                resp.raise_for_status()
                result = resp.json()
        except Exception as e:
            log.debug(f"AI call failed for {symbol}: {e}")
            return

        signal = result.get("signal")
        if not signal or not scorer.passes_filter(signal):
            return

        strategy = scorer.build_strategy_card(signal, symbol)
        await self._persist_signal(signal, strategy)

    async def _persist_signal(self, signal: dict, strategy: dict):
        try:
            Session = _get_session()
            from sqlalchemy import text
            async with Session() as db:
                sig_id = signal.get("id") or str(uuid.uuid4())
                # SQLite-compatible (no ::jsonb cast, INSERT OR IGNORE)
                await db.execute(
                    text("""
                        INSERT OR IGNORE INTO signals (
                            id, asset_id, direction, confidence, entry_price, target_price,
                            stop_loss, risk_reward, timeframe, ai_reasoning, consensus_data,
                            kalkan_block, kalkan_reasons, expires_at
                        ) VALUES (
                            :id, :aid, :dir, :conf, :ep, :tp, :sl, :rr,
                            :tf, :reasoning, :consensus, :kb, :kr, :exp
                        )
                    """),
                    {
                        "id": sig_id, "aid": signal["asset_id"],
                        "dir": signal["direction"], "conf": signal["confidence"],
                        "ep": signal.get("entry_price"), "tp": signal.get("target_price"),
                        "sl": signal.get("stop_loss"), "rr": signal.get("risk_reward"),
                        "tf": signal.get("timeframe", "1d"),
                        "reasoning": signal.get("ai_reasoning", ""),
                        "consensus": json.dumps(signal.get("consensus_data", {})),
                        "kb": 1 if signal.get("kalkan_block") else 0,
                        "kr": json.dumps(signal.get("kalkan_reasons", [])),
                        "exp": signal.get("expires_at"),
                    }
                )
                await db.execute(
                    text("""
                        INSERT OR IGNORE INTO strategies (id, asset_id, signal_id, entry_price, target1, target2, stop_loss, risk_reward, entry_timing, exit_strategy)
                        VALUES (:id, :aid, :sid, :ep, :t1, :t2, :sl, :rr, :et, :es)
                    """),
                    {
                        "id": str(uuid.uuid4()), "aid": signal["asset_id"], "sid": sig_id,
                        "ep": strategy["entry_price"], "t1": strategy["target1"],
                        "t2": strategy.get("target2"), "sl": strategy["stop_loss"],
                        "rr": strategy["risk_reward"],
                        "et": json.dumps(strategy["entry_timing"]),
                        "es": json.dumps(strategy["exit_strategy"]),
                    }
                )
                await db.commit()
        except Exception as e:
            log.debug(f"Persist error (non-fatal): {e}")
