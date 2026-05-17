"""
AYC Global Market - Billing Router
Secure subscription lifecycle:
- plan changes only from verified provider webhooks in production
- demo verify endpoint disabled in production
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_service import get_current_user
from database import (
    ProviderEnum,
    SubStatusEnum,
    Subscription,
    TierEnum,
    Transaction,
    User,
    get_db,
)

router = APIRouter(tags=["billing"])

ENV_NAME = (os.environ.get("ENVIRONMENT") or os.environ.get("NODE_ENV") or "development").lower()
IS_PRODUCTION = ENV_NAME in {"production", "prod"}
ALLOW_INSECURE_WEBHOOKS_FOR_TESTS = (
    os.environ.get("ALLOW_INSECURE_WEBHOOKS_FOR_TESTS", "").strip().lower() == "true"
)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
LEMON_API_KEY = os.environ.get("LEMON_API_KEY", "").strip()
LEMON_WEBHOOK_SECRET = os.environ.get("LEMON_WEBHOOK_SECRET", "").strip()
LEMON_STORE_ID = os.environ.get("LEMON_STORE_ID", "").strip()
LEMON_PRO_VARIANT_ID = (
    os.environ.get("LEMON_PRO_VARIANT_ID", "").strip()
    or os.environ.get("LEMON_VARIANT_PRO", "").strip()
)
LEMON_ELITE_VARIANT_ID = (
    os.environ.get("LEMON_ELITE_VARIANT_ID", "").strip()
    or os.environ.get("LEMON_VARIANT_ELITE", "").strip()
)

PLANS = {
    "pro": {
        "name": "AYC Pro",
        "price_usd": 9.99,
        "price_try": 299,
        "stripe_price_id": os.environ.get("STRIPE_PRICE_PRO", "").strip(),
    },
    "elite": {
        "name": "AYC Elite",
        "price_usd": 24.99,
        "price_try": 799,
        "stripe_price_id": os.environ.get("STRIPE_PRICE_ELITE", "").strip(),
    },
}


def _ensure_secret_in_production(name: str, value: str) -> None:
    if IS_PRODUCTION and not value:
        raise HTTPException(status_code=503, detail=f"{name} production ortaminda zorunlu.")


def _coerce_tier(plan: str) -> TierEnum:
    try:
        return TierEnum(plan)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Gecersiz plan.") from exc


def _coerce_provider(provider: str) -> ProviderEnum:
    normalized = (provider or "manual").lower()
    try:
        return ProviderEnum(normalized)
    except Exception:
        return ProviderEnum.manual


def _activate_subscription(
    user_id: str,
    plan: str,
    provider: str,
    provider_sub_id: str,
    db: Session,
) -> Subscription:
    tier = _coerce_tier(plan)
    provider_enum = _coerce_provider(provider)

    db.query(Subscription).filter(
        Subscription.user_id == user_id,
        Subscription.status == SubStatusEnum.active,
    ).update({"status": SubStatusEnum.cancelled})

    expires = datetime.now(timezone.utc) + timedelta(days=31)
    sub = Subscription(
        id=str(uuid4()),
        user_id=user_id,
        plan=tier,
        provider=provider_enum,
        provider_sub_id=provider_sub_id,
        status=SubStatusEnum.active,
        price_usd=PLANS.get(plan, {}).get("price_usd", 0),
        price_try=PLANS.get(plan, {}).get("price_try", 0),
        expires_at=expires,
    )
    db.add(sub)
    db.query(User).filter(User.id == user_id).update({"tier": tier})
    db.commit()
    return sub


async def _stripe_create_checkout(plan: str, user_email: str, user_id: str) -> dict:
    import httpx

    cfg = PLANS[plan]
    price_id = cfg["stripe_price_id"]

    if not STRIPE_SECRET_KEY:
        if IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="Stripe konfigrasyonu eksik.")
        sid = f"cs_demo_{uuid4().hex[:16]}"
        return {
            "provider": "stripe",
            "session_id": sid,
            "checkout_url": f"{FRONTEND_URL}/subscribe/success?plan={plan}&provider=stripe&session_id={sid}&demo=1",
            "demo": True,
        }

    form_data: dict[str, str] = {
        "mode": "subscription",
        "success_url": f"{FRONTEND_URL}/subscribe/success?plan={plan}&provider=stripe&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{FRONTEND_URL}/subscribe",
        "customer_email": user_email,
        "metadata[user_id]": user_id,
        "metadata[plan]": plan,
    }
    if price_id:
        form_data["line_items[0][price]"] = price_id
        form_data["line_items[0][quantity]"] = "1"
    else:
        form_data.update(
            {
                "line_items[0][price_data][currency]": "usd",
                "line_items[0][price_data][product_data][name]": cfg["name"],
                "line_items[0][price_data][unit_amount]": str(int(cfg["price_usd"] * 100)),
                "line_items[0][price_data][recurring][interval]": "month",
                "line_items[0][quantity]": "1",
            }
        )

    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.post(
            "https://api.stripe.com/v1/checkout/sessions",
            data=form_data,
            headers={"Authorization": f"Bearer {STRIPE_SECRET_KEY}"},
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Stripe checkout olusturulamadi: {response.text[:200]}")

    session = response.json()
    return {
        "provider": "stripe",
        "session_id": session["id"],
        "checkout_url": session["url"],
        "demo": False,
    }


async def _lemon_create_checkout(plan: str, user_email: str, user_id: str) -> dict:
    import httpx

    variant_id = LEMON_PRO_VARIANT_ID if plan == "pro" else LEMON_ELITE_VARIANT_ID
    if not LEMON_API_KEY or not LEMON_STORE_ID or not variant_id:
        if IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="Lemon Squeezy konfigrasyonu eksik.")
        sid = f"ls_demo_{uuid4().hex[:16]}"
        return {
            "provider": "lemonsqueezy",
            "order_id": sid,
            "checkout_url": f"{FRONTEND_URL}/subscribe/success?plan={plan}&provider=lemonsqueezy&session_id={sid}&demo=1",
            "demo": True,
        }

    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_options": {"embed": False, "media": True, "logo": True},
                "checkout_data": {"email": user_email, "custom": {"user_id": user_id, "plan": plan}},
            },
            "relationships": {
                "store": {"data": {"type": "stores", "id": str(LEMON_STORE_ID)}},
                "variant": {"data": {"type": "variants", "id": str(variant_id)}},
            },
        }
    }

    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.post(
            "https://api.lemonsqueezy.com/v1/checkouts",
            json=payload,
            headers={
                "Authorization": f"Bearer {LEMON_API_KEY}",
                "Accept": "application/vnd.api+json",
                "Content-Type": "application/vnd.api+json",
            },
        )
    if response.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Lemon checkout olusturulamadi: {response.text[:200]}")

    data = response.json()
    return {
        "provider": "lemonsqueezy",
        "order_id": data["data"]["id"],
        "checkout_url": data["data"]["attributes"].get("url", ""),
        "demo": False,
    }


@router.get("/billing/plans")
async def get_plans():
    return {
        "plans": {
            "free": {
                "name": "Free",
                "price_try": 0,
                "price_usd": 0,
                "features": ["gunluk sinyal", "temel analiz"],
            },
            "pro": {
                "name": "Pro",
                "price_try": 299,
                "price_usd": 9.99,
                "features": ["sinirsiz sinyal", "ai copilot", "kalkan pro"],
            },
            "elite": {
                "name": "Elite",
                "price_try": 799,
                "price_usd": 24.99,
                "features": ["pro dahil", "api erisimi", "vip destek"],
            },
        }
    }


class CheckoutIn(BaseModel):
    plan: str
    provider: str = "lemonsqueezy"  # lemonsqueezy | stripe


@router.post("/billing/checkout")
async def create_checkout(body: CheckoutIn, user: User = Depends(get_current_user)):
    if body.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Gecersiz plan.")

    if body.provider == "stripe":
        return await _stripe_create_checkout(body.plan, user.email, user.id)
    return await _lemon_create_checkout(body.plan, user.email, user.id)


@router.post("/billing/verify")
async def verify_payment(request: Request, db: Session = Depends(get_db)):
    """
    Manual/demo verify endpoint.
    Production'da kapali: plan degisimi sadece provider webhooks ile yapilir.
    """
    if IS_PRODUCTION:
        raise HTTPException(
            status_code=403,
            detail="Manual verify production ortaminda kapali. Webhook kullanin.",
        )

    body = await request.json()
    plan = str(body.get("plan", "pro")).lower()
    user_id = str(body.get("user_id", ""))
    provider = str(body.get("provider", "manual")).lower()
    session_id = str(body.get("session_id", ""))

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id gerekli.")
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail="Gecersiz plan.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanici bulunamadi.")

    sub = _activate_subscription(user_id, plan, provider, session_id or f"manual_{uuid4().hex[:8]}", db)
    return {
        "verified": True,
        "plan": plan,
        "tier": plan,
        "expires_at": sub.expires_at.isoformat(),
        "message": f"{plan.upper()} plani aktif edildi (dev/test).",
    }


@router.post("/billing/webhook/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str = Header(default=""),
):
    body = await request.body()
    _ensure_secret_in_production("STRIPE_WEBHOOK_SECRET", STRIPE_WEBHOOK_SECRET)

    if STRIPE_WEBHOOK_SECRET:
        try:
            import stripe as stripe_lib

            event = stripe_lib.Webhook.construct_event(body, stripe_signature, STRIPE_WEBHOOK_SECRET)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Stripe webhook imzasi hatali.") from exc
    else:
        if IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="Stripe webhook secret eksik.")
        if not ALLOW_INSECURE_WEBHOOKS_FOR_TESTS:
            raise HTTPException(
                status_code=401,
                detail="Stripe webhook secret yok. Test bypass icin ALLOW_INSECURE_WEBHOOKS_FOR_TESTS=true gerekli.",
            )
        try:
            event = json.loads(body)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid body.") from exc

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        user_id = str(data.get("metadata", {}).get("user_id", ""))
        plan = str(data.get("metadata", {}).get("plan", "pro")).lower()
        subscription_id = str(data.get("subscription", ""))

        if user_id and plan in PLANS:
            _activate_subscription(user_id, plan, "stripe", subscription_id, db)
            txn = Transaction(
                id=str(uuid4()),
                user_id=user_id,
                provider=ProviderEnum.stripe,
                provider_txn_id=data.get("payment_intent", ""),
                amount=(data.get("amount_total", 0) or 0) / 100,
                currency=str(data.get("currency", "usd")).upper(),
                status="succeeded",
                plan=TierEnum(plan),
            )
            db.add(txn)
            db.commit()

    elif event_type == "customer.subscription.deleted":
        subscription_id = str(data.get("id", ""))
        db.query(Subscription).filter(Subscription.provider_sub_id == subscription_id).update(
            {"status": SubStatusEnum.cancelled, "cancelled_at": datetime.now(timezone.utc)}
        )
        user_id = str(data.get("metadata", {}).get("user_id", ""))
        if user_id:
            db.query(User).filter(User.id == user_id).update({"tier": TierEnum.free})
        db.commit()

    return {"received": True}


@router.post("/billing/webhook/lemonsqueezy")
async def lemonsqueezy_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_signature: str = Header(default="", alias="X-Signature"),
):
    body = await request.body()
    _ensure_secret_in_production("LEMON_WEBHOOK_SECRET", LEMON_WEBHOOK_SECRET)

    if LEMON_WEBHOOK_SECRET:
        expected = hmac.new(LEMON_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, x_signature):
            raise HTTPException(status_code=400, detail="Lemon webhook imzasi hatali.")
    else:
        if IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="Lemon webhook secret eksik.")
        if not ALLOW_INSECURE_WEBHOOKS_FOR_TESTS:
            raise HTTPException(
                status_code=401,
                detail="Lemon webhook secret yok. Test bypass icin ALLOW_INSECURE_WEBHOOKS_FOR_TESTS=true gerekli.",
            )

    try:
        event = json.loads(body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid body.") from exc

    event_name = event.get("meta", {}).get("event_name", "")
    custom = event.get("meta", {}).get("custom_data", {})
    user_id = str(custom.get("user_id", ""))
    plan = str(custom.get("plan", "pro")).lower()

    if event_name in {"order_created", "subscription_created"} and user_id and plan in PLANS:
        attrs = event.get("data", {}).get("attributes", {})
        order_id = str(event.get("data", {}).get("id", ""))
        _activate_subscription(user_id, plan, "lemonsqueezy", order_id, db)
        txn = Transaction(
            id=str(uuid4()),
            user_id=user_id,
            provider=ProviderEnum.lemonsqueezy,
            provider_txn_id=order_id,
            amount=(attrs.get("total", 0) or 0) / 100,
            currency=str(attrs.get("currency", "USD")).upper(),
            status="succeeded",
            plan=TierEnum(plan),
        )
        db.add(txn)
        db.commit()

    return {"received": True}


@router.get("/billing/subscription")
async def my_subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id, Subscription.status == SubStatusEnum.active)
        .order_by(Subscription.created_at.desc())
        .first()
    )

    tier = user.tier.value if hasattr(user.tier, "value") else str(user.tier)
    plan_info = {
        "free": {"name": "Free", "price_try": 0, "price_usd": 0},
        "pro": {"name": "Pro", "price_try": 299, "price_usd": 9.99},
        "elite": {"name": "Elite", "price_try": 799, "price_usd": 24.99},
    }.get(tier, {})

    return {
        "tier": tier,
        "plan": plan_info,
        "subscription": (
            {
                "id": sub.id,
                "status": sub.status.value,
                "provider": sub.provider.value,
                "started_at": sub.started_at.isoformat(),
                "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
            }
            if sub
            else None
        ),
    }


@router.post("/billing/cancel")
async def cancel_subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id, Subscription.status == SubStatusEnum.active)
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Aktif abonelik bulunamadi.")

    sub.status = SubStatusEnum.cancelled
    sub.cancelled_at = datetime.now(timezone.utc)
    db.query(User).filter(User.id == user.id).update({"tier": TierEnum.free})
    db.commit()
    return {"cancelled": True, "message": "Abonelik iptal edildi."}


@router.get("/billing/transactions")
async def transaction_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "currency": t.currency,
                "status": t.status,
                "plan": t.plan.value if t.plan else None,
                "provider": t.provider.value if t.provider else None,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txns
        ]
    }
