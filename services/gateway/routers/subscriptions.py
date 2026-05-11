"""Subscriptions router — Stripe + iyzico"""
from __future__ import annotations
import os
import json
from fastapi import APIRouter, Depends, Request, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

PLANS = {
    "free": {"name": "Free", "price_try": 0, "price_usd": 0, "features": ["1 sinyal/gün", "Simülasyon modu", "Temel Kalkan"]},
    "pro": {"name": "Pro", "price_try": 299, "price_usd": 9.99, "features": ["Sınırsız sinyal", "Tam Kalkan", "AI Copilot", "Evrim sistemi"]},
    "elite": {"name": "Elite", "price_try": 799, "price_usd": 24.99, "features": ["Pro + Öncelikli sinyal", "What-If simülatör", "VIP destek"]},
}


@router.get("/plans")
async def get_plans():
    return {"plans": PLANS, "disclaimer": "Fiyatlar KDV hariçtir."}


@router.get("/status")
async def get_status(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    result = await db.execute(
        text("SELECT tier FROM users WHERE id = :uid"), {"uid": uid}
    )
    row = result.mappings().first()
    tier = row["tier"] if row else "free"
    return {"tier": tier, "plan": PLANS.get(tier, PLANS["free"])}


@router.post("/checkout")
async def create_checkout(body: dict, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    plan = body.get("plan", "pro")
    payment_provider = body.get("provider", "stripe")  # stripe | iyzico

    if payment_provider == "stripe":
        try:
            import stripe
            stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
            price_id = os.environ.get(f"STRIPE_PRICE_{plan.upper()}", "")
            session = stripe.checkout.Session.create(
                mode="subscription",
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                metadata={"user_id": uid, "plan": plan},
                success_url=os.environ.get("APP_URL", "https://neura.app") + "/subscribe/success",
                cancel_url=os.environ.get("APP_URL", "https://neura.app") + "/subscribe",
            )
            return {"checkout_url": session.url, "provider": "stripe"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Stripe hatası: {str(e)}")
    else:
        return {"message": "iyzico entegrasyonu yakında aktif olacak.", "provider": "iyzico"}


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None), db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    try:
        import stripe
        stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, os.environ["STRIPE_WEBHOOK_SECRET"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] == "customer.subscription.created":
        meta = event["data"]["object"].get("metadata", {})
        uid = meta.get("user_id")
        plan = meta.get("plan", "pro")
        if uid:
            await db.execute(
                text("UPDATE users SET tier = :tier WHERE id = :uid"),
                {"tier": plan, "uid": uid},
            )
            await db.commit()
    elif event["type"] == "customer.subscription.deleted":
        meta = event["data"]["object"].get("metadata", {})
        uid = meta.get("user_id")
        if uid:
            await db.execute(
                text("UPDATE users SET tier = 'free' WHERE id = :uid"),
                {"uid": uid},
            )
            await db.commit()

    return {"received": True}
