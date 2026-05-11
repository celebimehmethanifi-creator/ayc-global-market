"""
AYC Global Market — Price API Endpoints
GET /price/{symbol}            - tek sembol anlık fiyat
GET /price/batch?symbols=...   - toplu fiyat
GET /market/overview           - tüm kategoriler özet
"""
from __future__ import annotations
from fastapi import APIRouter, Query
from price_engine import get_price, get_prices_batch

router = APIRouter(tags=["prices"])

# Default watchlist — tüm piyasalar
WATCHLIST = {
    "crypto":   ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","AVAXUSDT"],
    "us":       ["AAPL","NVDA","TSLA","MSFT","AMZN","GOOGL","META","JPM"],
    "turkey":   ["THYAO.IS","GARAN.IS","SAHOL.IS","EREGL.IS","ISCTR.IS","BIMAS.IS","KCHOL.IS","ASELS.IS"],
    "precious": ["XAUUSD","XAGUSD","GC=F","SI=F"],
    "energy":   ["CL=F","NG=F","BZ=F"],
    "forex":    ["EURUSD","GBPUSD","USDJPY","USDTRY","AUDUSD"],
    "index":    ["SPX","NASDAQ","DJI","BIST100","VIX"],
}

@router.get("/price/{symbol}")
async def price_single(symbol: str):
    """Tek sembol gerçek zamanlı fiyat."""
    data = await get_price(symbol.upper())
    return {**data, "symbol": symbol.upper()}


@router.get("/price/batch")
async def price_batch(symbols: str = Query(..., description="Virgülle ayrılmış semboller: BTCUSDT,AAPL,XAUUSD")):
    """Toplu fiyat — aynı anda 30 sembol destekler."""
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()][:30]
    prices = await get_prices_batch(sym_list)
    return {
        "count": len(prices),
        "prices": prices,
    }


@router.get("/market/overview")
async def market_overview():
    """Tüm piyasalar özet — dashboard için."""
    import asyncio
    all_syms = []
    for syms in WATCHLIST.values():
        all_syms.extend(syms)

    prices = await get_prices_batch(all_syms)

    result = {}
    for category, syms in WATCHLIST.items():
        result[category] = [
            {
                "symbol": s,
                "price": prices.get(s, {}).get("price", 0),
                "change_pct": prices.get(s, {}).get("change_pct", 0),
                "high_24h": prices.get(s, {}).get("high_24h", 0),
                "low_24h": prices.get(s, {}).get("low_24h", 0),
                "source": prices.get(s, {}).get("source", "?"),
            }
            for s in syms
        ]
    return {"categories": result, "count": len(all_syms)}


@router.get("/market/ticker")
async def market_ticker():
    """MarketTicker component için — en önemli 20 varlık."""
    key_symbols = [
        "BTCUSDT","ETHUSDT","XAUUSD","EURUSD","USDTRY",
        "SPX","NASDAQ","AAPL","NVDA","TSLA",
        "THYAO.IS","GARAN.IS","CL=F","SOLUSDT","BNBUSDT",
        "XAGUSD","BIST100","MSFT","AMZN","DJI",
    ]
    prices = await get_prices_batch(key_symbols)
    tickers = [
        {
            "symbol": s,
            "price": prices.get(s, {}).get("price", 0),
            "change_pct": prices.get(s, {}).get("change_pct", 0),
            "source": prices.get(s, {}).get("source", "?"),
        }
        for s in key_symbols
        if prices.get(s, {}).get("price", 0) > 0
    ]
    return {"tickers": tickers, "count": len(tickers)}
