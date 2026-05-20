"""CoinGecko API fetcher with API key support"""
from __future__ import annotations
import asyncio
import logging
import os
from datetime import datetime
import httpx

log = logging.getLogger("coingecko")

COINGECKO_KEY = os.environ.get("COINGECKO_API_KEY", "").strip()


def _coingecko_headers() -> dict:
    headers: dict = {"Accept": "application/json"}
    if COINGECKO_KEY:
        headers["x-cg-demo-api-key"] = COINGECKO_KEY
    return headers

COINGECKO_COINS = [
    "bitcoin", "ethereum", "solana", "binancecoin", "ripple",
    "cardano", "dogecoin", "avalanche-2", "polkadot", "chainlink",
    "matic-network", "litecoin", "cosmos", "uniswap", "aave",
    "sui", "arbitrum", "optimism", "near", "aptos",
]

BASE_URL = "https://api.coingecko.com/api/v3"


async def fetch_coingecko_batch(coins: list[str] | None = None) -> list[dict]:
    coins = coins or COINGECKO_COINS
    ids = ",".join(coins)
    url = f"{BASE_URL}/coins/markets"
    params = {
        "vs_currency": "usd",
        "ids": ids,
        "order": "market_cap_desc",
        "per_page": 50,
        "page": 1,
        "sparkline": False,
        "price_change_percentage": "24h",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, params=params, headers=_coingecko_headers())
            resp.raise_for_status()
            data = resp.json()
            results = []
            for item in data:
                results.append({
                    "symbol": item["symbol"].upper() + "USDT",
                    "name": item["name"],
                    "price": float(item.get("current_price") or 0),
                    "open": float(item.get("current_price") or 0),
                    "high": float(item.get("high_24h") or 0),
                    "low": float(item.get("low_24h") or 0),
                    "volume": float(item.get("total_volume") or 0),
                    "change_pct": float(item.get("price_change_percentage_24h") or 0),
                    "market_cap": float(item.get("market_cap") or 0),
                    "source": "coingecko",
                    "fetched_at": datetime.utcnow().isoformat(),
                    "coingecko_id": item["id"],
                })
            log.info(f"CoinGecko: fetched {len(results)} coins")
            return results
        except Exception as e:
            log.warning(f"CoinGecko fetch failed: {e}")
            return []