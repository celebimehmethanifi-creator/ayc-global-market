"""User router"""
from __future__ import annotations
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional

from db import get_db

router = APIRouter(prefix="/user", tags=["user"])


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None


@router.get("/profile")
async def get_profile(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("SELECT id, email, display_name, tier, language, timezone, risk_profile, investor_iq FROM users WHERE id = :uid"),
        {"uid": uid},
    )
    row = result.mappings().first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return {"profile": dict(row)}


@router.put("/profile")
async def update_profile(body: ProfileUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["uid"] = uid
        await db.execute(text(f"UPDATE users SET {set_clause} WHERE id = :uid"), updates)
        await db.commit()
    return {"message": "Profil güncellendi"}


@router.get("/scores")
async def get_scores(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("SELECT * FROM scores WHERE user_id = :uid ORDER BY calculated_at DESC LIMIT 1"),
        {"uid": uid},
    )
    row = result.mappings().first()
    return {"scores": dict(row) if row else {}}


@router.get("/behavior")
async def get_behavior(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("""
            SELECT event_type, count(*) as count,
                   max(recorded_at) as last_seen
            FROM user_behavior WHERE user_id = :uid
            AND recorded_at >= now() - interval '30 days'
            GROUP BY event_type ORDER BY count DESC
        """),
        {"uid": uid},
    )
    rows = result.mappings().all()
    return {"behavior_patterns": [dict(r) for r in rows]}


@router.get("/leaderboard")
async def leaderboard(period: str = "weekly", db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT u.display_name, s.investor_iq, s.win_rate, s.kalkan_obedience, s.leaderboard_rank
            FROM scores s JOIN users u ON u.id = s.user_id
            WHERE s.leaderboard_rank IS NOT NULL
            ORDER BY s.investor_iq DESC LIMIT 100
        """)
    )
    rows = result.mappings().all()
    return {"leaderboard": [dict(r) for r in rows], "period": period}


@router.delete("")
async def delete_account(request: Request, db: AsyncSession = Depends(get_db)):
    """KVKK uyum — hesap silme (soft delete, 30 gün sonra hard delete)."""
    uid = request.state.user_id
    # Anonymize user data
    await db.execute(
        text("""
            UPDATE users SET
                email = 'deleted_' || id || '@neura.deleted',
                display_name = 'Silinmiş Kullanıcı',
                risk_profile = '{}'::jsonb
            WHERE id = :uid
        """),
        {"uid": uid},
    )
    await db.commit()
    return {"message": "Hesap silme talebiniz alındı. 30 gün içinde verileriniz kalıcı olarak silinecektir."}
