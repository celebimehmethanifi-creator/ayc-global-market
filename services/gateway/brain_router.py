"""
AYC Global Market - Brain Router
Gercek piyasa verisi: Global AI Engine
"""
from __future__ import annotations
import os, sys, time
from pathlib import Path
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

ENGINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ENGINE_DIR))

router = APIRouter(prefix="/brain", tags=["brain"])

_loaded = False
_scan_market = _analyze_asset = _search_assets = _fetch_asset_history = None
_MARKETS = _ASSET_UNIVERSE = None

def _load():
    global _loaded, _scan_market, _analyze_asset, _search_assets, _fetch_asset_history, _MARKETS, _ASSET_UNIVERSE
    if _loaded: return True
    try:
        env_file = ENGINE_DIR / ".env"
        if env_file.exists():
            from dotenv import load_dotenv
            load_dotenv(env_file)
        from engine.global_engine import scan_market, analyze_asset, search_assets, fetch_asset_history
        from engine.universe import MARKETS, ASSET_UNIVERSE
        _scan_market = scan_market; _analyze_asset = analyze_asset
        _search_assets = search_assets; _fetch_asset_history = fetch_asset_history
        _MARKETS = MARKETS; _ASSET_UNIVERSE = ASSET_UNIVERSE
        _loaded = True; return True
    except Exception as e:
        print(f"[brain] Engine yuklenemedi: {e}"); return False

@router.get("/markets")
async def get_markets():
    return {"markets": [
        {"key":"all","label":"Tum Piyasalar"},{"key":"turkey","label":"BIST / Turkiye"},
        {"key":"us","label":"ABD Borsasi"},{"key":"crypto","label":"Kripto"},
        {"key":"precious","label":"Degerli Emtia"},{"key":"energy","label":"Enerji"},
        {"key":"forex","label":"Forex"},{"key":"index","label":"Endeksler"},{"key":"etf","label":"ETF"},
    ]}

@router.get("/scan")
async def scan(market: str = Query("all"), limit: int = Query(50, ge=1, le=200), min_confidence: float = Query(0)):
    if not _load(): return JSONResponse(503, {"error": "Engine baslatılamadı"})
    try:
        t0 = time.perf_counter()
        result = _scan_market(market, limit=limit)
        ms = int((time.perf_counter() - t0) * 1000)
        items = result if isinstance(result, list) else result.get("signals", result.get("items", []))
        if min_confidence > 0: items = [i for i in items if (i.get("confidence") or 0) >= min_confidence]
        return {"market": market, "count": len(items), "elapsed_ms": ms, "items": items}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/analyze/{symbol}")
async def analyze(symbol: str, market: str = Query("crypto")):
    if not _load(): return JSONResponse(503, {"error": "Engine baslatılamadı"})
    try:
        sym = symbol.upper()
        asset = next((a for a in (_ASSET_UNIVERSE or []) if a["symbol"].upper()==sym or a["display"].upper()==sym), None)
        if not asset: asset = {"symbol":symbol,"display":symbol,"name":symbol,"assetClass":"other","market":market}
        result = _analyze_asset(asset)
        return {"symbol": symbol, "data": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    if not _load(): return JSONResponse(503, {"error": "Engine baslatılamadı"})
    try:
        results = _search_assets(q)
        items = results if isinstance(results, list) else results.get("results", [])
        return {"query": q, "count": len(items), "items": items}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/history/{symbol}")
async def history(symbol: str, timeframe: str = Query("1D")):
    if not _load(): return JSONResponse(503, {"error": "Engine baslatılamadı"})
    try:
        sym = symbol.upper()
        asset = next((a for a in (_ASSET_UNIVERSE or []) if a["symbol"].upper()==sym or a["display"].upper()==sym), None)
        if not asset: asset = {"symbol":symbol,"display":symbol,"name":symbol,"assetClass":"crypto","market":"crypto"}
        result = _fetch_asset_history(asset, timeframe)
        return {"symbol": symbol, "timeframe": timeframe, "data": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/universe")
async def universe(market: str = Query("all")):
    if not _load(): return JSONResponse(503, {"error": "Engine baslatılamadı"})
    items = _ASSET_UNIVERSE or []
    if market != "all": items = [a for a in items if a.get("market") == market]
    return {"market": market, "count": len(items), "items": items}