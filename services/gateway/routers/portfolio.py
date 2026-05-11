"""Portfolio router — manual entries + watchlist"""
from __future__ import annotations
from typing import Optional
from uuid import UUID, uuid4
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from db import get_db

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class PositionIn(BaseModel):
    asset_id: UUID
    entry_price: float
    quantity: float
    entry_date: str
    notes: Optional[str] = None
    is_simulation: bool = False


@router.get("")
async def get_portfolio(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("SELECT * FROM portfolios WHERE user_id = :uid"), {"uid": uid}
    )
    portfolio = result.mappings().first()
    if not portfolio:
        # Auto-create default portfolio
        pid = str(uuid4())
        await db.execute(
            text("INSERT INTO portfolios (id, user_id, name, currency) VALUES (:id, :uid, 'Ana Portföy', 'TRY')"),
            {"id": pid, "uid": uid},
        )
        await db.commit()
        portfolio = {"id": pid, "user_id": uid, "name": "Ana Portföy", "currency": "TRY"}
    return {"portfolio": dict(portfolio)}


@router.get("/positions")
async def list_positions(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("""
            SELECT pp.*, a.symbol, a.name, a.category,
                   ap.price as current_price,
                   ROUND((ap.price - pp.entry_price) * pp.quantity, 2) as pnl,
                   ROUND(((ap.price - pp.entry_price) / pp.entry_price) * 100, 2) as pnl_pct
            FROM portfolio_positions pp
            JOIN portfolios p ON p.id = pp.portfolio_id
            JOIN assets a ON a.id = pp.asset_id
            LEFT JOIN LATERAL (
                SELECT price FROM asset_prices WHERE asset_id = pp.asset_id ORDER BY fetched_at DESC LIMIT 1
            ) ap ON true
            WHERE p.user_id = :uid
            ORDER BY pp.created_at DESC
        """),
        {"uid": uid},
    )
    rows = result.mappings().all()
    return {"positions": [dict(r) for r in rows]}


@router.post("/positions")
async def add_position(body: PositionIn, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    # get or create portfolio
    port = (await db.execute(text("SELECT id FROM portfolios WHERE user_id = :uid"), {"uid": uid})).mappings().first()
    if not port:
        pid = str(uuid4())
        await db.execute(
            text("INSERT INTO portfolios (id, user_id) VALUES (:id, :uid)"),
            {"id": pid, "uid": uid},
        )
    else:
        pid = port["id"]

    pos_id = str(uuid4())
    await db.execute(
        text("""
            INSERT INTO portfolio_positions (id, portfolio_id, asset_id, entry_price, quantity, entry_date, notes, is_simulation)
            VALUES (:id, :pid, :asset_id, :entry_price, :quantity, :entry_date, :notes, :is_sim)
        """),
        {
            "id": pos_id, "pid": pid, "asset_id": str(body.asset_id),
            "entry_price": body.entry_price, "quantity": body.quantity,
            "entry_date": body.entry_date, "notes": body.notes, "is_sim": body.is_simulation,
        },
    )
    await db.commit()
    return {"id": pos_id, "message": "Pozisyon eklendi"}


@router.delete("/positions/{position_id}")
async def delete_position(position_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("""
            DELETE FROM portfolio_positions pp
            USING portfolios p
            WHERE pp.portfolio_id = p.id AND p.user_id = :uid AND pp.id = :pid
        """),
        {"uid": uid, "pid": str(position_id)},
    )
    await db.commit()
    return {"message": "Silindi"}


@router.get("/watchlist")
async def get_watchlist(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("""
            SELECT w.*, a.symbol, a.name, a.category, ap.price, ap.change_pct
            FROM watchlist w
            JOIN assets a ON a.id = w.asset_id
            LEFT JOIN LATERAL (
                SELECT price, change_pct FROM asset_prices WHERE asset_id = w.asset_id ORDER BY fetched_at DESC LIMIT 1
            ) ap ON true
            WHERE w.user_id = :uid ORDER BY w.added_at DESC
        """),
        {"uid": uid},
    )
    rows = result.mappings().all()
    return {"watchlist": [dict(r) for r in rows]}


@router.post("/watchlist")
async def add_to_watchlist(asset_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    wid = str(uuid4())
    try:
        await db.execute(
            text("INSERT INTO watchlist (id, user_id, asset_id) VALUES (:id, :uid, :aid)"),
            {"id": wid, "uid": uid, "aid": str(asset_id)},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Zaten watchlist'te")
    return {"message": "Eklendi", "id": wid}


@router.delete("/watchlist/{asset_id}")
async def remove_from_watchlist(asset_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    await db.execute(
        text("DELETE FROM watchlist WHERE user_id = :uid AND asset_id = :aid"),
        {"uid": uid, "aid": str(asset_id)},
    )
    await db.commit()
    return {"message": "Kaldırıldı"}


@router.get("/pnl")
async def get_pnl_summary(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("""
            SELECT
                SUM((ap.price - pp.entry_price) * pp.quantity) as total_pnl,
                SUM(pp.entry_price * pp.quantity) as total_invested,
                COUNT(*) as position_count
            FROM portfolio_positions pp
            JOIN portfolios p ON p.id = pp.portfolio_id
            LEFT JOIN LATERAL (
                SELECT price FROM asset_prices WHERE asset_id = pp.asset_id ORDER BY fetched_at DESC LIMIT 1
            ) ap ON true
            WHERE p.user_id = :uid AND pp.is_simulation = false
        """),
        {"uid": uid},
    )
    row = result.mappings().first()
    data = dict(row) if row else {}
    if data.get("total_invested") and float(data["total_invested"]) > 0:
        data["total_pnl_pct"] = round(float(data["total_pnl"] or 0) / float(data["total_invested"]) * 100, 2)
    return {"pnl": data}
