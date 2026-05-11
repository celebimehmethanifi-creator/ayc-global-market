"""Binance WebSocket — Redis optional, in-memory fallback"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from datetime import datetime

log = logging.getLogger("binance-ws")

CRYPTO_STREAMS = [
    "btcusdt","ethusdt","solusdt","bnbusdt","xrpusdt",
    "adausdt","dogeusdt","avaxusdt","dotusdt","linkusdt",
]

WS_URL = "wss://stream.binance.com:9443/stream?streams=" + "/".join(
    f"{s}@miniTicker" for s in CRYPTO_STREAMS
)

SYMBOL_MAP = {
    "btcusdt":"BTC","ethusdt":"ETH","solusdt":"SOL","bnbusdt":"BNB",
    "xrpusdt":"XRP","adausdt":"ADA","dogeusdt":"DOGE","avaxusdt":"AVAX",
    "dotusdt":"DOT","linkusdt":"LINK",
}


class BinanceWSClient:
    def __init__(self, redis):
        self.redis = redis

    async def run(self):
        """WebSocket stream — hata olursa 30s bekleyip yeniden bağlanır."""
        while True:
            try:
                await self._stream()
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.warning(f"Binance WS disconnected: {e} — retry in 30s")
                await asyncio.sleep(30)

    async def _stream(self):
        try:
            import websockets
        except ImportError:
            log.warning("websockets not installed — Binance WS disabled")
            await asyncio.sleep(3600)
            return

        log.info(f"Binance WS connecting: {len(CRYPTO_STREAMS)} streams")
        async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=10) as ws:
            async for raw in ws:
                try:
                    msg  = json.loads(raw)
                    data = msg.get("data", msg)
                    sym  = SYMBOL_MAP.get(data.get("s","").lower())
                    if not sym:
                        continue
                    price  = float(data.get("c", 0))
                    high   = float(data.get("h", 0))
                    low    = float(data.get("l", 0))
                    vol    = float(data.get("v", 0))
                    prev   = float(data.get("o", price))
                    chg    = ((price - prev) / prev * 100) if prev else 0
                    payload = {
                        "symbol":     sym,
                        "price":      price,
                        "high":       high,
                        "low":        low,
                        "volume":     vol,
                        "change_pct": round(chg, 4),
                        "source":     "binance_ws",
                        "fetched_at": datetime.utcnow().isoformat(),
                    }
                    await self.redis.setex(f"price:{sym}", 120, json.dumps(payload))
                except Exception:
                    pass