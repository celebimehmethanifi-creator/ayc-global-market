"""Assets router — SQLite compatible"""
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from db import get_db

router = APIRouter(prefix="/assets", tags=["assets"])

DISCLAIMER = "Bu içerik yatırım tavsiyesi değildir. Yatırım kararlarınızı kendi araştırmalarınıza dayandırınız."


@router.get("")
async def list_assets(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    q = "SELECT id, symbol, name, category, exchange, currency, data_source, is_active, meta FROM assets WHERE is_active = 1"
    params: dict = {}
    if category and category != "ALL":
        q += " AND category = :category"
        params["category"] = category
    if search:
        q += " AND (upper(symbol) LIKE upper(:search) OR upper(name) LIKE upper(:search))"
        params["search"] = f"%{search}%"
    q += " ORDER BY symbol LIMIT :limit OFFSET :offset"
    params.update({"limit": limit, "offset": offset})
    result = await db.execute(text(q), params)
    rows = result.mappings().all()
    return {"items": [dict(r) for r in rows], "offset": offset, "limit": limit, "disclaimer": DISCLAIMER}


@router.get("/market/overview")
async def market_overview(db: AsyncSession = Depends(get_db)):
    """Per-category asset count."""
    q = text("SELECT category, count(*) as total FROM assets WHERE is_active = 1 GROUP BY category")
    result = await db.execute(q)
    rows = result.mappings().all()
    return {"categories": [dict(r) for r in rows], "disclaimer": DISCLAIMER}


@router.get("/{asset_id}")
async def get_asset(asset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM assets WHERE id = :id"), {"id": asset_id}
    )
    row = result.mappings().first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"asset": dict(row), "disclaimer": DISCLAIMER}


@router.get("/{asset_id}/price")
async def get_asset_price(asset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT ap.*, a.symbol FROM asset_prices ap
            JOIN assets a ON a.id = ap.asset_id
            WHERE ap.asset_id = :id
            ORDER BY ap.fetched_at DESC LIMIT 1
        """),
        {"id": asset_id},
    )
    row = result.mappings().first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Price data not found")
    return {"price": dict(row)}


@router.get("/{asset_id}/history")
async def get_asset_history(
    asset_id: str,
    interval: str = Query("1d"),
    from_ts: Optional[str] = Query(None, alias="from"),
    to_ts: Optional[str] = Query(None, alias="to"),
    limit: int = Query(100, le=1000),
    db: AsyncSession = Depends(get_db),
):
    q = "SELECT * FROM asset_prices WHERE asset_id = :id"
    params: dict = {"id": asset_id}
    if from_ts:
        q += " AND fetched_at >= :from_ts"
        params["from_ts"] = from_ts
    if to_ts:
        q += " AND fetched_at <= :to_ts"
        params["to_ts"] = to_ts
    q += " ORDER BY fetched_at DESC LIMIT :limit"
    params["limit"] = limit
    result = await db.execute(text(q), params)
    rows = result.mappings().all()
    return {"history": [dict(r) for r in rows], "interval": interval}
