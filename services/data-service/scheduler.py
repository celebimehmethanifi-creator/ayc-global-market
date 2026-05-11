"""Data Service Scheduler"""
from __future__ import annotations
import asyncio
import json
import logging
import uuid
from datetime import datetime

log = logging.getLogger("scheduler")

from fetchers.yahoo     import fetch_yahoo_batch, ALL_YAHOO_SYMBOLS
from fetchers.coingecko import fetch_coingecko_batch

CRYPTO_INTERVAL   = 60
STOCK_INTERVAL    = 300
DB_FLUSH_INTERVAL = 600


class DataScheduler:
    def __init__(self, redis, db_url: str):
        self.redis   = redis
        self.db_url  = db_url
        self._engine = None
        self._Session = None

    def _get_session(self):
        if self._engine is None:
            from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
            is_sqlite = self.db_url.startswith("sqlite")
            if is_sqlite:
                self._engine = create_async_engine(
                    self.db_url, echo=False,
                    connect_args={"check_same_thread": False}
                )
            else:
                self._engine = create_async_engine(self.db_url, echo=False, pool_size=5)
            self._Session = async_sessionmaker(self._engine, class_=AsyncSession, expire_on_commit=False)
        return self._Session

    async def run_periodic_fetches(self):
        log.info("DataScheduler running")
        t_crypto = t_stock = t_flush = 0.0
        while True:
            now = asyncio.get_event_loop().time()
            if now - t_crypto >= CRYPTO_INTERVAL:
                asyncio.create_task(self._fetch_crypto())
                t_crypto = now
            if now - t_stock >= STOCK_INTERVAL:
                asyncio.create_task(self._fetch_stocks())
                t_stock = now
            if now - t_flush >= DB_FLUSH_INTERVAL:
                asyncio.create_task(self._flush_to_db())
                t_flush = now
            await asyncio.sleep(10)

    async def _fetch_crypto(self):
        try:
            results = await fetch_coingecko_batch()
            for data in results:
                sym = data.get("symbol", "").replace("USDT", "")
                if sym:
                    await self.redis.setex(f"price:{sym}", 300, json.dumps(data))
            log.info(f"Crypto cached: {len(results)} symbols")
        except Exception as e:
            log.warning(f"CoinGecko fetch error: {e}")

    async def _fetch_stocks(self):
        try:
            results = await fetch_yahoo_batch(ALL_YAHOO_SYMBOLS[:50])
            for data in results:
                sym = data.get("symbol", "")
                if sym:
                    await self.redis.setex(f"price:{sym}", 600, json.dumps(data))
            log.info(f"Stocks cached: {len(results)} symbols")
        except Exception as e:
            log.warning(f"Yahoo fetch error: {e}")

    async def _flush_to_db(self):
        try:
            Session = self._get_session()
            from sqlalchemy import text
            async with Session() as db:
                await db.execute(text("""
                    CREATE TABLE IF NOT EXISTS price_snapshots (
                        id TEXT PRIMARY KEY,
                        symbol TEXT, price REAL, change_pct REAL,
                        source TEXT, fetched_at TEXT
                    )
                """))
                await db.commit()
                keys = await self.redis.keys("price:*")
                for k in keys[:200]:
                    raw = await self.redis.get(k)
                    if not raw:
                        continue
                    try:
                        d = json.loads(raw)
                        await db.execute(text("""
                            INSERT OR IGNORE INTO price_snapshots
                                (id, symbol, price, change_pct, source, fetched_at)
                            VALUES (:id, :sym, :price, :chg, :src, :ts)
                        """), {
                            "id":    str(uuid.uuid4()),
                            "sym":   d.get("symbol", k.replace("price:", "")),
                            "price": d.get("price", 0),
                            "chg":   d.get("change_pct", 0),
                            "src":   d.get("source", ""),
                            "ts":    datetime.utcnow().isoformat(),
                        })
                    except Exception:
                        pass
                await db.commit()
        except Exception as e:
            log.debug(f"DB flush skipped: {e}")