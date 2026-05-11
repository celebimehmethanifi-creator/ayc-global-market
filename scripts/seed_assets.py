#!/usr/bin/env python3
"""Seed initial asset catalog — BIST30, SP500 top 20, Crypto top 15, Commodities, Forex, Indices, ETFs"""
from __future__ import annotations
import asyncio
import os
import uuid

from dotenv import load_dotenv
load_dotenv()

import asyncpg

ASSETS = [
    # BIST30
    {"symbol": "THYAO.IS", "name": "Türk Hava Yolları", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "GARAN.IS", "name": "Garanti BBVA", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "AKBNK.IS", "name": "Akbank", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "SISE.IS", "name": "Şişe Cam", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "EREGL.IS", "name": "Ereğli Demir Çelik", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "KCHOL.IS", "name": "Koç Holding", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "TUPRS.IS", "name": "Tüpraş", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "ASELS.IS", "name": "Aselsan", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "BIMAS.IS", "name": "BİM Mağazaları", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "SAHOL.IS", "name": "Sabancı Holding", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "PETKM.IS", "name": "Petkim", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "TOASO.IS", "name": "Tofaş Otomobil", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "FROTO.IS", "name": "Ford Otosan", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "ISCTR.IS", "name": "İş Bankası C", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "HALKB.IS", "name": "Halkbank", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "VAKBN.IS", "name": "VakıfBank", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "KOZAL.IS", "name": "Koza Altın", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "TCELL.IS", "name": "Turkcell", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "ARCLK.IS", "name": "Arçelik", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "PGSUS.IS", "name": "Pegasus Havayolları", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "DOHOL.IS", "name": "Doğan Holding", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "EKGYO.IS", "name": "Emlak Konut GYO", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "KRDMD.IS", "name": "Kardemir D", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "TAVHL.IS", "name": "TAV Havalimanları", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "SODA.IS", "name": "Soda Sanayii", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "TTKOM.IS", "name": "Türk Telekom", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "MGROS.IS", "name": "Migros Ticaret", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "ULKER.IS", "name": "Ülker Bisküvi", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "YKBNK.IS", "name": "Yapı Kredi Bankası", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "OYAKC.IS", "name": "Oyak Çimento", "category": "BIST", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    # US
    {"symbol": "AAPL", "name": "Apple Inc.", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "META", "name": "Meta Platforms", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "TSLA", "name": "Tesla Inc.", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "NFLX", "name": "Netflix Inc.", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "AMD", "name": "Advanced Micro Devices", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "INTC", "name": "Intel Corp.", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "JPM", "name": "JPMorgan Chase", "category": "US", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "GS", "name": "Goldman Sachs", "category": "US", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "BAC", "name": "Bank of America", "category": "US", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "V", "name": "Visa Inc.", "category": "US", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "MA", "name": "Mastercard Inc.", "category": "US", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "PYPL", "name": "PayPal Holdings", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "COIN", "name": "Coinbase Global", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "MSTR", "name": "MicroStrategy", "category": "US", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    # CRYPTO
    {"symbol": "BTCUSDT", "name": "Bitcoin", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "ETHUSDT", "name": "Ethereum", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "SOLUSDT", "name": "Solana", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "BNBUSDT", "name": "BNB", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "XRPUSDT", "name": "Ripple", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "ADAUSDT", "name": "Cardano", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "DOGEUSDT", "name": "Dogecoin", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "AVAXUSDT", "name": "Avalanche", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "DOTUSDT", "name": "Polkadot", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "LINKUSDT", "name": "Chainlink", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "MATICUSDT", "name": "Polygon", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "LTCUSDT", "name": "Litecoin", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "ATOMUSDT", "name": "Cosmos", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "UNIUSDT", "name": "Uniswap", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    {"symbol": "AAVEUSDT", "name": "Aave", "category": "CRYPTO", "exchange": "BINANCE", "currency": "USDT", "data_source": ["binance", "coingecko"]},
    # COMMODITY
    {"symbol": "GC=F", "name": "Altın Spot", "category": "COMMODITY", "exchange": "COMEX", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "SI=F", "name": "Gümüş Spot", "category": "COMMODITY", "exchange": "COMEX", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "HG=F", "name": "Bakır", "category": "COMMODITY", "exchange": "COMEX", "currency": "USD", "data_source": ["yahoo"]},
    # ENERGY
    {"symbol": "CL=F", "name": "Brent Ham Petrol", "category": "ENERGY", "exchange": "NYMEX", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "NG=F", "name": "Doğalgaz", "category": "ENERGY", "exchange": "NYMEX", "currency": "USD", "data_source": ["yahoo"]},
    # FOREX
    {"symbol": "EURUSD=X", "name": "Euro / USD", "category": "FOREX", "exchange": "FOREX", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "GBPUSD=X", "name": "GBP / USD", "category": "FOREX", "exchange": "FOREX", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "USDJPY=X", "name": "USD / JPY", "category": "FOREX", "exchange": "FOREX", "currency": "JPY", "data_source": ["yahoo"]},
    {"symbol": "USDTRY=X", "name": "USD / TRY", "category": "FOREX", "exchange": "FOREX", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "EURTRY=X", "name": "EUR / TRY", "category": "FOREX", "exchange": "FOREX", "currency": "TRY", "data_source": ["yahoo"]},
    # INDEX
    {"symbol": "^GSPC", "name": "S&P 500", "category": "INDEX", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "^IXIC", "name": "NASDAQ Composite", "category": "INDEX", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "^DJI", "name": "Dow Jones Industrial", "category": "INDEX", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "^BIST100", "name": "BIST 100", "category": "INDEX", "exchange": "BIST", "currency": "TRY", "data_source": ["yahoo"]},
    {"symbol": "^FTSE", "name": "FTSE 100", "category": "INDEX", "exchange": "LSE", "currency": "GBP", "data_source": ["yahoo"]},
    {"symbol": "^N225", "name": "Nikkei 225", "category": "INDEX", "exchange": "TSE", "currency": "JPY", "data_source": ["yahoo"]},
    {"symbol": "^DAX", "name": "DAX 40", "category": "INDEX", "exchange": "XETRA", "currency": "EUR", "data_source": ["yahoo"]},
    # ETF
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF", "category": "ETF", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "QQQ", "name": "Invesco QQQ ETF", "category": "ETF", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "GLD", "name": "SPDR Gold Shares ETF", "category": "ETF", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "TLT", "name": "iShares 20+ Year Treasury ETF", "category": "ETF", "exchange": "NASDAQ", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "VTI", "name": "Vanguard Total Stock Market ETF", "category": "ETF", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
    {"symbol": "ARKK", "name": "ARK Innovation ETF", "category": "ETF", "exchange": "NYSE", "currency": "USD", "data_source": ["yahoo"]},
]


async def seed():
    db_url = os.environ["DATABASE_URL"]
    # asyncpg uses standard postgres:// URL
    conn = await asyncpg.connect(db_url)
    inserted = 0
    skipped = 0

    for asset in ASSETS:
        try:
            await conn.execute(
                """
                INSERT INTO assets (id, symbol, name, category, exchange, currency, data_source, is_active, meta)
                VALUES ($1, $2, $3, $4, $5, $6, $7, true, '{}')
                ON CONFLICT (symbol) DO NOTHING
                """,
                str(uuid.uuid4()),
                asset["symbol"],
                asset["name"],
                asset["category"],
                asset.get("exchange", ""),
                asset.get("currency", "USD"),
                asset.get("data_source", []),
            )
            inserted += 1
        except Exception as e:
            print(f"  Skip {asset['symbol']}: {e}")
            skipped += 1

    await conn.close()
    print(f"Seeded: {inserted} assets, {skipped} skipped.")
    print(f"Total categories: BIST={sum(1 for a in ASSETS if a['category']=='BIST')}, "
          f"US={sum(1 for a in ASSETS if a['category']=='US')}, "
          f"CRYPTO={sum(1 for a in ASSETS if a['category']=='CRYPTO')}, "
          f"other={sum(1 for a in ASSETS if a['category'] not in ('BIST','US','CRYPTO'))}")


if __name__ == "__main__":
    asyncio.run(seed())
