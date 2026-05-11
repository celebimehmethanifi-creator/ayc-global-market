from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()

API_KEYS = {
    "openai": env("OPENAI_API_KEY"),
    "gemini": env("GEMINI_API_KEY"),
    "claude": env("ANTHROPIC_API_KEY") or env("CLAUDE_API_KEY"),
    "finnhub": env("FINNHUB_API_KEY"),
    "twelvedata": env("TWELVEDATA_API_KEY"),
    "alphavantage": env("ALPHAVANTAGE_API_KEY"),
    "fmp": env("FMP_API_KEY"),
    "fred": env("FRED_API_KEY"),
    "evds": env("EVDS_API_KEY"),
    "binance_key": env("BINANCE_API_KEY"),
    "binance_secret": env("BINANCE_SECRET_KEY"),
    "bybit": env("BYBIT_API_KEY"),
    "bybit_secret": env("BYBIT_SECRET_KEY"),
    "okx": env("OKX_API_KEY"),
    "okx_secret": env("OKX_SECRET_KEY"),
    "okx_passphrase": env("OKX_PASSPHRASE"),
    "cryptoquant": env("CRYPTOQUANT_API_KEY"),
    "coinmarketcap": env("COINMARKETCAP_API_KEY"),
    "coingecko": env("COINGECKO_API_KEY"),
    "santiment": env("SANTIMENT_API_KEY"),
    "newsapi": env("NEWSAPI_KEY"),
    "dune": env("DUNE_API_KEY"),
}
