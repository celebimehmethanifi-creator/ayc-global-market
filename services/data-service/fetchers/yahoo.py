"""Yahoo Finance fetcher using yfinance"""
from __future__ import annotations
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional

import yfinance as yf

_executor = ThreadPoolExecutor(max_workers=4)

# BIST30 + major US stocks mapped to Yahoo symbols
BIST_SYMBOLS = [
    "THYAO.IS", "GARAN.IS", "AKBNK.IS", "SISE.IS", "EREGL.IS",
    "KCHOL.IS", "TUPRS.IS", "ASELS.IS", "BIMAS.IS", "SAHOL.IS",
    "PETKM.IS", "TOASO.IS", "FROTO.IS", "ISCTR.IS", "HALKB.IS",
    "VAKBN.IS", "KOZAL.IS", "TCELL.IS", "ARCLK.IS", "PGSUS.IS",
    "DOHOL.IS", "EKGYO.IS", "KRDMD.IS", "TAVHL.IS", "SODA.IS",
    "TTKOM.IS", "MGROS.IS", "ULKER.IS", "YKBNK.IS", "OYAKC.IS",
]

US_SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
    "META", "TSLA", "NFLX", "AMD", "INTC",
    "JPM", "GS", "BAC", "WFC", "V",
    "MA", "PYPL", "SQ", "COIN", "MSTR",
]

COMMODITY_SYMBOLS = ["GC=F", "SI=F", "CL=F", "NG=F", "HG=F"]  # Gold, Silver, Oil, NatGas, Copper
FOREX_SYMBOLS = ["EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDTRY=X", "EURTRY=X"]
INDEX_SYMBOLS = ["^GSPC", "^IXIC", "^DJI", "^BIST100", "^FTSE", "^N225", "^DAX"]
ETF_SYMBOLS = ["SPY", "QQQ", "GLD", "TLT", "VTI", "ARKK"]


def _sync_fetch(symbols: list[str]) -> list[dict]:
    results = []
    if not symbols:
        return results
    tickers = yf.Tickers(" ".join(symbols))
    for symbol in symbols:
        try:
            t = tickers.tickers.get(symbol)
            if not t:
                continue
            info = t.fast_info
            results.append({
                "symbol": symbol,
                "price": float(getattr(info, "last_price", 0) or 0),
                "open": float(getattr(info, "open", 0) or 0),
                "high": float(getattr(info, "day_high", 0) or 0),
                "low": float(getattr(info, "day_low", 0) or 0),
                "volume": float(getattr(info, "three_month_average_volume", 0) or 0),
                "change_pct": float(getattr(info, "previous_close", 0) or 0),
                "source": "yahoo",
                "fetched_at": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            pass  # skip failed tickers silently
    return results


async def fetch_yahoo_batch(symbols: list[str]) -> list[dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _sync_fetch, symbols)


ALL_YAHOO_SYMBOLS = BIST_SYMBOLS + US_SYMBOLS + COMMODITY_SYMBOLS + FOREX_SYMBOLS + INDEX_SYMBOLS + ETF_SYMBOLS
