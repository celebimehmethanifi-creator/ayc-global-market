"""Alarms router"""
from __future__ import annotations
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from db import get_db

router = APIRouter(prefix="/alarms", tags=["alarms"])


class AlarmIn(BaseModel):
    asset_id: Optional[UUID] = None
    alarm_type: str
    condition: dict


class DrawdownLockIn(BaseModel):
    max_drawdown_pct: float


@router.get("")
async def list_alarms(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("SELECT a.*, ast.symbol FROM alarms a LEFT JOIN assets ast ON ast.id = a.asset_id WHERE a.user_id = :uid ORDER BY a.created_at DESC"),
        {"uid": uid},
    )
    rows = result.mappings().all()
    return {"alarms": [dict(r) for r in rows]}


@router.post("")
async def create_alarm(body: AlarmIn, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    alarm_id = str(uuid4())
    await db.execute(
        text("INSERT INTO alarms (id, user_id, asset_id, alarm_type, condition) VALUES (:id, :uid, :aid, :atype, :cond::jsonb)"),
        {"id": alarm_id, "uid": uid, "aid": str(body.asset_id) if body.asset_id else None,
         "atype": body.alarm_type, "cond": __import__("json").dumps(body.condition)},
    )
    await db.commit()
    return {"id": alarm_id, "message": "Alarm oluşturuldu"}


@router.put("/{alarm_id}")
async def update_alarm(alarm_id: UUID, body: AlarmIn, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    await db.execute(
        text("UPDATE alarms SET alarm_type=:atype, condition=:cond::jsonb WHERE id=:id AND user_id=:uid"),
        {"atype": body.alarm_type, "cond": __import__("json").dumps(body.condition), "id": str(alarm_id), "uid": uid},
    )
    await db.commit()
    return {"message": "Güncellendi"}


@router.delete("/{alarm_id}")
async def delete_alarm(alarm_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    await db.execute(
        text("DELETE FROM alarms WHERE id=:id AND user_id=:uid"),
        {"id": str(alarm_id), "uid": uid},
    )
    await db.commit()
    return {"message": "Silindi"}


@router.post("/drawdown-lock")
async def set_drawdown_lock(body: DrawdownLockIn, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    await db.execute(
        text("UPDATE users SET risk_profile = risk_profile || :rp::jsonb WHERE id = :uid"),
        {"rp": __import__("json").dumps({"max_drawdown_pct": body.max_drawdown_pct}), "uid": uid},
    )
    await db.commit()
    return {"message": f"Drawdown kilidi %{body.max_drawdown_pct} olarak ayarlandı"}


@router.get("/kalkan-status")
async def kalkan_status(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("SELECT * FROM alarms WHERE user_id = :uid AND alarm_type = 'kalkan' AND is_active = true"),
        {"uid": uid},
    )
    rows = result.mappings().all()
    return {"active_kalkan_blocks": [dict(r) for r in rows]}
