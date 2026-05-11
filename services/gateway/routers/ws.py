"""WebSocket router — price stream + signal stream"""
from __future__ import annotations
import asyncio
import json
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/prices/{asset_id}")
async def ws_prices(websocket: WebSocket, asset_id: str):
    await websocket.accept()
    redis: aioredis.Redis = websocket.app.state.redis
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"prices:{asset_id}")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"prices:{asset_id}")
        await pubsub.close()


@router.websocket("/ws/signals")
async def ws_signals(websocket: WebSocket):
    await websocket.accept()
    redis: aioredis.Redis = websocket.app.state.redis
    pubsub = redis.pubsub()
    await pubsub.subscribe("signals:new")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe("signals:new")
        await pubsub.close()
