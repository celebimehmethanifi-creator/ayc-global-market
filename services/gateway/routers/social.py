"""Social router — votes + sentiment + contrarian"""
from __future__ import annotations
import hashlib
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from db import get_db

router = APIRouter(prefix="/social", tags=["social"])


class VoteIn(BaseModel):
    direction: str  # bullish | bearish | neutral


@router.get("/{asset_id}/votes")
async def get_votes(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT direction, count(*) as votes
            FROM social_votes WHERE asset_id = :aid
            AND created_at >= now() - interval '24 hours'
            GROUP BY direction
        """),
        {"aid": str(asset_id)},
    )
    rows = result.mappings().all()
    vote_map = {r["direction"]: int(r["votes"]) for r in rows}
    total = sum(vote_map.values())
    return {
        "asset_id": str(asset_id),
        "bullish": vote_map.get("bullish", 0),
        "bearish": vote_map.get("bearish", 0),
        "neutral": vote_map.get("neutral", 0),
        "total": total,
        "bullish_pct": round(vote_map.get("bullish", 0) / total * 100, 1) if total > 0 else 0,
        "bearish_pct": round(vote_map.get("bearish", 0) / total * 100, 1) if total > 0 else 0,
    }


@router.post("/{asset_id}/vote")
async def vote(asset_id: UUID, body: VoteIn, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    # Anon hash — one vote per user per asset per day
    today = __import__("datetime").date.today().isoformat()
    anon_hash = hashlib.sha256(f"{uid}{str(asset_id)}{today}".encode()).hexdigest()

    existing = await db.execute(
        text("SELECT id FROM social_votes WHERE anon_hash = :h"),
        {"h": anon_hash},
    )
    if existing.mappings().first():
        raise HTTPException(status_code=409, detail="Bugün için zaten oy kullandınız")

    vote_id = str(uuid4())
    await db.execute(
        text("INSERT INTO social_votes (id, asset_id, direction, anon_hash) VALUES (:id, :aid, :dir, :hash)"),
        {"id": vote_id, "aid": str(asset_id), "dir": body.direction, "hash": anon_hash},
    )
    await db.commit()
    return {"message": "Oy kaydedildi", "id": vote_id}


@router.get("/{asset_id}/contrarian")
async def contrarian_analysis(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    # Get crowd distribution
    result = await db.execute(
        text("""
            SELECT direction, count(*) as votes
            FROM social_votes WHERE asset_id = :aid
            AND created_at >= now() - interval '24 hours'
            GROUP BY direction
        """),
        {"aid": str(asset_id)},
    )
    rows = result.mappings().all()
    vote_map = {r["direction"]: int(r["votes"]) for r in rows}
    total = sum(vote_map.values())
    # Get latest AI signal direction
    sig_result = await db.execute(
        text("SELECT direction, confidence FROM signals WHERE asset_id = :aid ORDER BY created_at DESC LIMIT 1"),
        {"aid": str(asset_id)},
    )
    sig = sig_result.mappings().first()
    contrarian = False
    contrarian_detail = None
    if total >= 10 and sig:
        dominant = max(vote_map, key=vote_map.get)
        dominant_pct = vote_map.get(dominant, 0) / total * 100
        ai_dir = sig["direction"]
        direction_map = {"long": "bullish", "short": "bearish", "neutral": "neutral"}
        if dominant_pct >= 80 and direction_map.get(ai_dir) != dominant:
            contrarian = True
            contrarian_detail = {
                "crowd_dominant": dominant,
                "crowd_pct": round(dominant_pct, 1),
                "ai_direction": ai_dir,
                "ai_confidence": float(sig["confidence"]),
                "message": f"Kitle %{dominant_pct:.0f} {dominant} yönünde, ancak AI {ai_dir} sinyali veriyor.",
            }
    return {
        "asset_id": str(asset_id),
        "contrarian_signal": contrarian,
        "detail": contrarian_detail,
        "disclaimer": "Bu içerik yatırım tavsiyesi değildir.",
    }
