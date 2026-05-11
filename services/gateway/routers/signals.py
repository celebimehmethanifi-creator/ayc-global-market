"""Signals router"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/signals", tags=["signals"])
DISCLAIMER = "Bu icerik yatirim tavsiyesi degildir. Gecmis performans gelecek sonuclari garanti etmez."
MIN_CONFIDENCE = 50.0

@router.get("")
async def list_signals(
    category: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    min_confidence: float = Query(MIN_CONFIDENCE),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    tier = getattr(request.state, "user_tier", "free") if request else "free"
    eff_limit = min(limit, 20)  # free tier gets all for now

    q = """
        SELECT s.*, a.symbol as sym, a.name as asset_name, a.category as asset_category
        FROM signals s
        JOIN assets a ON a.id = s.asset_id
        WHERE s.confidence >= :min_conf AND s.kalkan_block = 0
    """
    params: dict = {"min_conf": min_confidence}
    if category and category.upper() not in ("ALL",""):
        q += " AND a.category = :category"
        params["category"] = category
    if direction:
        q += " AND s.direction = :direction"
        params["direction"] = direction.upper()
    q += " ORDER BY s.confidence DESC, s.created_at DESC LIMIT :limit OFFSET :offset"
    params.update({"limit": eff_limit, "offset": offset})

    result = await db.execute(text(q), params)
    rows = result.mappings().all()
    items = []
    for r in rows:
        d = dict(r)
        d.setdefault("signal_type", d.get("direction", "NEUTRAL"))
        items.append(d)
    return {"items": items, "total": len(items), "disclaimer": DISCLAIMER}


@router.get("/featured")
async def featured_signals(db: AsyncSession = Depends(get_db)):
    q = text("""
        SELECT s.*, a.symbol, a.name, a.category FROM signals s
        JOIN assets a ON a.id = s.asset_id
        WHERE s.kalkan_block = 0 AND s.is_featured = 1
        ORDER BY s.confidence DESC LIMIT 20
    """)
    rows = (await db.execute(q)).mappings().all()
    return {"items": [dict(r) for r in rows], "disclaimer": DISCLAIMER}


@router.get("/{signal_id}")
async def get_signal(signal_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT s.*, a.symbol, a.name, a.category FROM signals s JOIN assets a ON a.id = s.asset_id WHERE s.id = :id"),
        {"id": signal_id},
    )
    row = result.mappings().first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Signal not found")
    return {"signal": dict(row), "disclaimer": DISCLAIMER}


@router.get("/{signal_id}/strategy")
async def get_signal_strategy(signal_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""SELECT s.*, a.symbol, a.name, s.direction, s.confidence, s.reason
               FROM signals s JOIN assets a ON a.id = s.asset_id WHERE s.id = :id"""),
        {"id": signal_id},
    )
    row = result.mappings().first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Strategy not found")
    return {"strategy": dict(row), "disclaimer": DISCLAIMER}