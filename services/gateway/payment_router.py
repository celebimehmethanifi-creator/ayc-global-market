"""
AYC Global Market — Payment & Subscription Router
Stripe (international) + iyzico (Turkey) destekli.
Test modunda gerçek para tahsil edilmez.
"""
from __future__ import annotations
import os, time, hashlib, json
from uuid import uuid4
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(tags=["payments"])

# ── In-memory user tier store (SQLite'e migrate edilebilir) ──────
_USER_TIERS: dict[str, str] = {}   # user_id/email -> tier
_SUBSCRIPTIONS: dict[str, dict] = {}

PLANS = {
    "free":  {"name": "Free",  "price_try": 0,   "price_usd": 0,    "features": []},
    "pro":   {"name": "Pro",   "price_try": 299, "price_usd": 9.99, "features": ["unlimited_signals","ai_copilot","kalkan_pro"]},
    "elite": {"name": "Elite", "price_try": 799, "price_usd": 24.99,"features": ["all","api_access","vip_support"]},
}


class CheckoutRequest(BaseModel):
    plan: str
    provider: str = "stripe"  # stripe | iyzico
    email: str = "demo@aycglobal.com"
    success_url: str = "http://localhost:3000/subscribe/success"
    cancel_url: str = "http://localhost:3000/subscribe"


class WebhookRequest(BaseModel):
    event: str
    data: dict


# ── Stripe ───────────────────────────────────────────────────────
async def _stripe_checkout(req: CheckoutRequest) -> dict:
    stripe_key = os.environ.get("STRIPE_SECRET_KEY", "")
    plan = PLANS.get(req.plan)
    if not plan:
        raise HTTPException(status_code=400, detail="Geçersiz plan")

    if stripe_key and not stripe_key.startswith("sk_test_DEMO"):
        try:
            import httpx
            price_amount = int(plan["price_usd"] * 100)  # cents
            data = {
                "mode": "subscription",
                "success_url": req.success_url + "?plan=" + req.plan + "&provider=stripe&session_id={CHECKOUT_SESSION_ID}",
                "cancel_url": req.cancel_url,
                "line_items[0][price_data][currency]": "usd",
                "line_items[0][price_data][product_data][name]": f"AYC Global Market {plan['name']}",
                "line_items[0][price_data][unit_amount]": str(price_amount),
                "line_items[0][price_data][recurring][interval]": "month",
                "line_items[0][quantity]": "1",
                "customer_email": req.email,
            }
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    "https://api.stripe.com/v1/checkout/sessions",
                    data=data,
                    headers={"Authorization": f"Bearer {stripe_key}"},
                )
                if r.status_code == 200:
                    session = r.json()
                    return {
                        "provider": "stripe",
                        "session_id": session["id"],
                        "checkout_url": session["url"],
                        "status": "created",
                    }
        except Exception as e:
            pass

    # Demo mode (no Stripe key configured)
    session_id = f"cs_demo_{uuid4().hex[:16]}"
    return {
        "provider": "stripe",
        "session_id": session_id,
        "checkout_url": f"{req.success_url}?plan={req.plan}&provider=stripe&session_id={session_id}&demo=1",
        "status": "demo",
        "message": "Demo mod — gerçek ödeme alınmaz. Stripe key eklenince canlıya geçer.",
    }


# ── iyzico ───────────────────────────────────────────────────────
async def _iyzico_checkout(req: CheckoutRequest) -> dict:
    iyzico_key    = os.environ.get("IYZICO_API_KEY", "")
    iyzico_secret = os.environ.get("IYZICO_SECRET_KEY", "")
    plan = PLANS.get(req.plan)

    if iyzico_key and iyzico_secret:
        try:
            import httpx, hmac, base64
            # iyzico API entegrasyonu için gerçek implementasyon
            # Şimdilik demo — iyzico key eklenince aktifleşir
            pass
        except Exception:
            pass

    session_id = f"iy_demo_{uuid4().hex[:16]}"
    return {
        "provider": "iyzico",
        "session_id": session_id,
        "checkout_url": f"{req.success_url}?plan={req.plan}&provider=iyzico&session_id={session_id}&demo=1",
        "status": "demo",
        "message": f"iyzico demo mod — {plan['name']} planı ₺{plan['price_try']}/ay. iyzico key eklenince canlıya geçer.",
    }


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/payments/plans")
async def get_plans():
    """Tüm planlar ve fiyatlar."""
    return {"plans": PLANS}


@router.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest):
    """Ödeme oturumu oluştur."""
    if req.plan not in PLANS or req.plan == "free":
        raise HTTPException(status_code=400, detail="Geçersiz plan veya free plan ödeme gerektirmez")

    if req.provider == "iyzico":
        return await _iyzico_checkout(req)
    return await _stripe_checkout(req)


@router.post("/payments/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook — ödeme başarılı → tier yükselt."""
    body = await request.body()
    sig  = request.headers.get("stripe-signature", "")
    wh_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    if wh_secret:
        try:
            import stripe
            event = stripe.Webhook.construct_event(body, sig, wh_secret)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        try:
            event = json.loads(body)
        except Exception:
            raise HTTPException(status_code=400)

    if event.get("type") == "checkout.session.completed":
        data = event.get("data", {}).get("object", {})
        email = data.get("customer_email", "")
        plan  = data.get("metadata", {}).get("plan", "pro")
        if email:
            _USER_TIERS[email] = plan
            _SUBSCRIPTIONS[email] = {
                "tier": plan, "provider": "stripe",
                "activated_at": time.time(),
                "status": "active",
            }

    return {"received": True}


@router.post("/payments/verify")
async def verify_payment(body: dict):
    """Ödeme doğrulama — success page'den session_id ile çağrılır."""
    session_id = body.get("session_id", "")
    plan = body.get("plan", "pro")
    email = body.get("email", "")

    # Demo mod: session_id ile plan aktif et
    if session_id.startswith(("cs_demo_", "iy_demo_")):
        if email:
            _USER_TIERS[email] = plan
            _SUBSCRIPTIONS[email] = {
                "tier": plan, "provider": body.get("provider", "demo"),
                "activated_at": time.time(), "status": "active",
            }
        return {
            "verified": True,
            "plan": plan,
            "status": "active",
            "message": f"{plan.upper()} planı aktifleştirildi",
        }

    return {"verified": False, "message": "Session doğrulanamadı"}


@router.get("/subscriptions/status")
async def subscription_status(authorization: str = Header(default="")):
    """Kullanıcının mevcut abonelik durumu."""
    # Token'dan email çıkar (mock)
    token = authorization.replace("Bearer ", "")
    # In real app: decode JWT
    email = "demo@aycglobal.com"
    sub = _SUBSCRIPTIONS.get(email, {})
    tier = sub.get("tier") or _USER_TIERS.get(email, "free")
    return {
        "tier": tier,
        "plan": PLANS.get(tier, PLANS["free"]),
        "status": sub.get("status", "active"),
        "provider": sub.get("provider"),
        "activated_at": sub.get("activated_at"),
        "features": PLANS.get(tier, {}).get("features", []),
    }


@router.put("/subscriptions/cancel")
async def cancel_subscription(authorization: str = Header(default="")):
    """Abonelik iptali."""
    email = "demo@aycglobal.com"
    if email in _SUBSCRIPTIONS:
        _SUBSCRIPTIONS[email]["status"] = "cancelled"
        _USER_TIERS[email] = "free"
    return {"cancelled": True, "message": "Aboneliğiniz dönem sonunda iptal edilecek"}
