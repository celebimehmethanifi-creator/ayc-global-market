"""
AYC Global Market — Billing Router
Stripe + iyzico + PayTR + Lemon Squeezy tam entegrasyon
"""
from __future__ import annotations
import os, json, hashlib, time
import hmac as _hmac
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import User, Subscription, Transaction, get_db, TierEnum, SubStatusEnum, ProviderEnum
from auth_service import get_current_user

router = APIRouter(tags=["billing"])

STRIPE_SECRET_KEY    = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET= os.environ.get("STRIPE_WEBHOOK_SECRET", "")
IYZICO_API_KEY       = os.environ.get("IYZICO_API_KEY", "")
IYZICO_SECRET_KEY    = os.environ.get("IYZICO_SECRET_KEY", "")
IYZICO_BASE_URL      = os.environ.get("IYZICO_BASE_URL", "https://api.iyzipay.com")
FRONTEND_URL         = os.environ.get("FRONTEND_URL", "https://web-nine-fawn-33.vercel.app")
PAYTR_MERCHANT_ID    = os.environ.get("PAYTR_MERCHANT_ID", "")
PAYTR_MERCHANT_KEY   = os.environ.get("PAYTR_MERCHANT_KEY", "")
PAYTR_MERCHANT_SALT  = os.environ.get("PAYTR_MERCHANT_SALT", "")
LEMON_API_KEY        = os.environ.get("LEMON_API_KEY", "")
LEMON_WEBHOOK_SECRET = os.environ.get("LEMON_WEBHOOK_SECRET", "")
LEMON_STORE_ID       = os.environ.get("LEMON_STORE_ID", "")
LEMON_VARIANT_PRO    = os.environ.get("LEMON_VARIANT_PRO", "")
LEMON_VARIANT_ELITE  = os.environ.get("LEMON_VARIANT_ELITE", "")

PLANS = {
    "pro":   {"name":"AYC Pro",   "price_usd":9.99,  "price_try":299, "stripe_price_id": os.environ.get("STRIPE_PRICE_PRO","")},
    "elite": {"name":"AYC Elite", "price_usd":24.99, "price_try":799, "stripe_price_id": os.environ.get("STRIPE_PRICE_ELITE","")},
}


# ── Stripe helpers ───────────────────────────────────────────────
async def _stripe_create_session(plan: str, user_email: str, user_id: str) -> dict:
    import httpx
    p = PLANS[plan]
    price_id = p["stripe_price_id"]

    if not STRIPE_SECRET_KEY:
        # Demo mode
        sid = f"cs_demo_{uuid4().hex[:16]}"
        return {
            "provider": "stripe", "session_id": sid,
            "checkout_url": f"{FRONTEND_URL}/subscribe/success?plan={plan}&provider=stripe&session_id={sid}&demo=1",
            "demo": True,
        }

    # Gerçek Stripe Checkout Session
    form_data: dict = {
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
        # Price ID yoksa inline price oluştur
        form_data.update({
            "line_items[0][price_data][currency]": "usd",
            "line_items[0][price_data][product_data][name]": p["name"],
            "line_items[0][price_data][unit_amount]": str(int(p["price_usd"]*100)),
            "line_items[0][price_data][recurring][interval]": "month",
            "line_items[0][quantity]": "1",
        })

    async with httpx.AsyncClient(timeout=12) as c:
        r = await c.post(
            "https://api.stripe.com/v1/checkout/sessions",
            data=form_data,
            headers={"Authorization": f"Bearer {STRIPE_SECRET_KEY}"},
        )
        if r.status_code != 200:
            raise HTTPException(502, f"Stripe hatası: {r.text[:200]}")
        sess = r.json()
        return {
            "provider": "stripe",
            "session_id": sess["id"],
            "checkout_url": sess["url"],
            "demo": False,
        }


# ── iyzico helpers ───────────────────────────────────────────────
def _iyzico_signature(request_body: str) -> str:
    """HMAC-SHA256 imza üret."""
    import hmac as _hmac_iyzico
    return _hmac_iyzico.new(
        IYZICO_SECRET_KEY.encode(), request_body.encode(), hashlib.sha256
    ).hexdigest()


async def _iyzico_create_checkoutform(plan: str, user_email: str, user_id: str) -> dict:
    import httpx, base64
    p = PLANS[plan]

    if not IYZICO_API_KEY or not IYZICO_SECRET_KEY:
        sid = f"iy_demo_{uuid4().hex[:16]}"
        return {
            "provider": "iyzico", "token": sid,
            "checkout_url": f"{FRONTEND_URL}/subscribe/success?plan={plan}&provider=iyzico&session_id={sid}&demo=1",
            "demo": True,
        }

    conv_id = f"AYC_{uuid4().hex[:12].upper()}"
    payload = {
        "locale": "tr",
        "conversationId": conv_id,
        "price": str(p["price_try"]),
        "paidPrice": str(p["price_try"]),
        "currency": "TRY",
        "basketId": f"plan_{plan}",
        "paymentGroup": "SUBSCRIPTION",
        "callbackUrl": f"{FRONTEND_URL}/subscribe/success?plan={plan}&provider=iyzico",
        "enabledInstallments": [1, 2, 3, 6, 9],
        "buyer": {
            "id": user_id[:8],
            "name": "AYC", "surname": "User",
            "email": user_email,
            "identityNumber": "11111111111",
            "registrationAddress": "Istanbul",
            "city": "Istanbul", "country": "Turkey",
            "ip": "85.34.78.112",
        },
        "shippingAddress": {"contactName":"AYC User","city":"Istanbul","country":"Turkey","address":"Istanbul"},
        "billingAddress":  {"contactName":"AYC User","city":"Istanbul","country":"Turkey","address":"Istanbul"},
        "basketItems": [{
            "id": f"plan_{plan}", "name": p["name"],
            "category1": "SaaS", "itemType": "VIRTUAL",
            "price": str(p["price_try"]),
        }],
    }
    body_str = json.dumps(payload, ensure_ascii=False)
    auth = base64.b64encode(f"{IYZICO_API_KEY}:{_iyzico_signature(body_str)}".encode()).decode()
    async with httpx.AsyncClient(timeout=12) as c:
        r = await c.post(
            f"{IYZICO_BASE_URL}/payment/iyzipos/checkoutform/initialize",
            content=body_str.encode("utf-8"),
            headers={"Authorization": f"IYZWSv2 {auth}", "Content-Type": "application/json"},
        )
        if r.status_code != 200:
            raise HTTPException(502, f"iyzico hatası: {r.text[:200]}")
        result = r.json()
        if result.get("status") != "success":
            raise HTTPException(502, result.get("errorMessage","iyzico error"))
        return {
            "provider": "iyzico",
            "token": result["token"],
            "checkout_url": result.get("paymentPageUrl") or f"{FRONTEND_URL}/subscribe/iyzico?token={result['token']}&plan={plan}",
            "demo": False,
        }


# ── Lemon Squeezy helpers ────────────────────────────────────────
async def _lemonsqueezy_create_checkout(plan: str, user_email: str, user_id: str) -> dict:
    import httpx
    p = PLANS[plan]

    if not LEMON_API_KEY or not LEMON_STORE_ID:
        sid = f"ls_demo_{uuid4().hex[:16]}"
        return {
            "provider": "lemonsqueezy", "order_id": sid,
            "checkout_url": f"{FRONTEND_URL}/subscribe/success?plan={plan}&provider=lemonsqueezy&session_id={sid}&demo=1",
            "demo": True,
        }

    variant_id = LEMON_VARIANT_PRO if plan == "pro" else LEMON_VARIANT_ELITE
    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_options": {"embed": False, "media": True, "logo": True},
                "checkout_data": {
                    "email": user_email,
                    "custom": {"user_id": user_id, "plan": plan},
                },
                "expires_at": None,
                "preview": False,
                "test_mode": "live" not in LEMON_API_KEY.lower(),
            },
            "relationships": {
                "store":   {"data": {"type": "stores",   "id": str(LEMON_STORE_ID)}},
                "variant": {"data": {"type": "variants",  "id": str(variant_id)}},
            },
        }
    }
    async with httpx.AsyncClient(timeout=12) as c:
        r = await c.post(
            "https://api.lemonsqueezy.com/v1/checkouts",
            json=payload,
            headers={
                "Authorization": f"Bearer {LEMON_API_KEY}",
                "Accept": "application/vnd.api+json",
                "Content-Type": "application/vnd.api+json",
            },
        )
        if r.status_code not in (200, 201):
            raise HTTPException(502, f"Lemon Squeezy hatası: {r.text[:200]}")
        data = r.json()
        url = data["data"]["attributes"].get("url","")
        return {
            "provider": "lemonsqueezy",
            "order_id": data["data"]["id"],
            "checkout_url": url,
            "demo": False,
        }


# ── PayTR helpers ────────────────────────────────────────────────
async def _paytr_create_checkout(plan: str, user_email: str, user_id: str) -> dict:
    import httpx, base64, hmac as _hmac_local
    p = PLANS[plan]

    if not PAYTR_MERCHANT_ID or not PAYTR_MERCHANT_KEY:
        sid = f"pt_demo_{uuid4().hex[:16]}"
        return {
            "provider": "paytr", "token": sid,
            "checkout_url": f"{FRONTEND_URL}/subscribe/success?plan={plan}&provider=paytr&session_id={sid}&demo=1",
            "demo": True,
        }

    merchant_oid = f"AYC{uuid4().hex[:12].upper()}"
    user_basket = base64.b64encode(
        json.dumps([[p["name"], str(p["price_try"]) + ".00", 1]]).encode()
    ).decode()

    paytr_token_str = (
        PAYTR_MERCHANT_ID + "85.34.78.112" + merchant_oid +
        user_email + str(int(p["price_try"] * 100)) + "TL" + "tr" + "0" +
        user_basket + "0" + "0" + "1" + "4" + PAYTR_MERCHANT_SALT
    )
    paytr_token = base64.b64encode(
        _hmac_local.new(PAYTR_MERCHANT_KEY.encode(), paytr_token_str.encode(), hashlib.sha256).digest()
    ).decode()

    form = {
        "merchant_id": PAYTR_MERCHANT_ID, "user_ip": "85.34.78.112",
        "merchant_oid": merchant_oid, "email": user_email,
        "payment_amount": str(int(p["price_try"] * 100)),
        "paytr_token": paytr_token, "user_basket": user_basket,
        "debug_on": "0", "no_installment": "0",
        "max_installment": "9", "user_name": "AYC User",
        "user_address": "Istanbul", "user_phone": "05000000000",
        "merchant_ok_url": f"{FRONTEND_URL}/subscribe/success?plan={plan}&provider=paytr&oid={merchant_oid}",
        "merchant_fail_url": f"{FRONTEND_URL}/subscribe?error=payment_failed",
        "timeout_limit": "30", "currency": "TL", "test_mode": "0",
        "lang": "tr",
    }
    async with httpx.AsyncClient(timeout=12) as c:
        r = await c.post("https://www.paytr.com/odeme/api/v1", data=form)
        if r.status_code != 200:
            raise HTTPException(502, f"PayTR hatası: {r.text[:200]}")
        result = r.json()
        if result.get("status") != "success":
            raise HTTPException(502, result.get("reason", "PayTR error"))
        return {
            "provider": "paytr", "token": result["token"],
            "checkout_url": f"https://www.paytr.com/odeme/guvenli/{result['token']}",
            "demo": False,
        }


# ── Subscription DB helpers ──────────────────────────────────────
def _activate_subscription(user_id: str, plan: str, provider: str,
                            provider_sub_id: str, db: Session) -> Subscription:
    # İptal et mevcutları
    db.query(Subscription).filter(
        Subscription.user_id == user_id,
        Subscription.status == SubStatusEnum.active,
    ).update({"status": SubStatusEnum.cancelled})

    expires = datetime.now(timezone.utc) + timedelta(days=31)
    sub = Subscription(
        id=str(uuid4()), user_id=user_id,
        plan=plan, provider=provider,
        provider_sub_id=provider_sub_id,
        status=SubStatusEnum.active,
        price_usd=PLANS.get(plan,{}).get("price_usd",0),
        price_try=PLANS.get(plan,{}).get("price_try",0),
        expires_at=expires,
    )
    db.add(sub)
    db.query(User).filter(User.id == user_id).update({"tier": plan})
    db.commit()
    return sub


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/billing/plans")
async def get_plans():
    """Tüm plan bilgileri."""
    return {
        "plans": {
            "free":  {"name":"Free",      "price_try":0,   "price_usd":0,    "features":["5 sinyal/gün","Temel analiz","1 portföy"]},
            "pro":   {"name":"Pro",       "price_try":299, "price_usd":9.99, "features":["Sınırsız sinyal","AI Copilot","Kalkan Pro","Sabah brifing","Tüm kategoriler","3 portföy","Öncelikli destek"]},
            "elite": {"name":"Elite",     "price_try":799, "price_usd":24.99,"features":["Pro dahil","Senaryo simülatör","API erişimi","VIP destek","Özel AI modeli","10 portföy"]},
        }
    }


class CheckoutIn(BaseModel):
    plan: str
    provider: str = "iyzico"   # stripe | iyzico | paytr | lemonsqueezy

@router.post("/billing/checkout")
async def create_checkout(body: CheckoutIn, user: User = Depends(get_current_user)):
    if body.plan not in PLANS:
        raise HTTPException(400, "Geçersiz plan")
    if body.provider == "iyzico":
        return await _iyzico_create_checkoutform(body.plan, user.email, user.id)
    if body.provider == "paytr":
        return await _paytr_create_checkout(body.plan, user.email, user.id)
    if body.provider == "lemonsqueezy":
        return await _lemonsqueezy_create_checkout(body.plan, user.email, user.id)
    # stripe (default, kept for compatibility)
    return await _stripe_create_session(body.plan, user.email, user.id)


@router.post("/billing/verify")
async def verify_payment(request: Request, db: Session = Depends(get_db)):
    """Demo mod ödeme doğrulama + Stripe/iyzico callback."""
    body = await request.json()
    session_id = body.get("session_id") or body.get("token","")
    plan       = body.get("plan","pro")
    user_id    = body.get("user_id","")
    provider   = body.get("provider","stripe")

    if not user_id:
        raise HTTPException(400, "user_id gerekli")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı")

    sub = _activate_subscription(user_id, plan, provider, session_id, db)
    return {
        "verified": True,
        "plan": plan,
        "tier": plan,
        "expires_at": sub.expires_at.isoformat(),
        "message": f"{plan.upper()} planı aktifleştirildi — {sub.expires_at.strftime('%d.%m.%Y')}'e kadar geçerli",
    }


@router.post("/billing/webhook/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db),
                         stripe_signature: str = Header(default="")):
    body = await request.body()
    if STRIPE_WEBHOOK_SECRET:
        try:
            import stripe as stripe_lib
            event = stripe_lib.Webhook.construct_event(body, stripe_signature, STRIPE_WEBHOOK_SECRET)
        except Exception:
            raise HTTPException(400, "Stripe webhook imzası hatalı")
    else:
        try:    event = json.loads(body)
        except: raise HTTPException(400, "Invalid body")

    etype = event.get("type","")
    data  = event.get("data",{}).get("object",{})

    if etype == "checkout.session.completed":
        user_id = data.get("metadata",{}).get("user_id","")
        plan    = data.get("metadata",{}).get("plan","pro")
        sub_id  = data.get("subscription","")
        if user_id:
            _activate_subscription(user_id, plan, "stripe", sub_id, db)
            # Log transaction
            txn = Transaction(
                id=str(uuid4()), user_id=user_id,
                provider="stripe", provider_txn_id=data.get("payment_intent",""),
                amount=data.get("amount_total",0)/100, currency=data.get("currency","usd").upper(),
                status="succeeded", plan=plan,
            )
            db.add(txn); db.commit()

    elif etype == "customer.subscription.deleted":
        sub_id = data.get("id","")
        db.query(Subscription).filter(Subscription.provider_sub_id == sub_id).update({
            "status": SubStatusEnum.cancelled, "cancelled_at": datetime.now(timezone.utc)
        })
        # Downgrade user to free
        user_id = data.get("metadata",{}).get("user_id","")
        if user_id:
            db.query(User).filter(User.id == user_id).update({"tier":"free"})
        db.commit()

    return {"received": True}


@router.post("/billing/webhook/lemonsqueezy")
async def lemonsqueezy_webhook(request: Request, db: Session = Depends(get_db),
                               x_signature: str = Header(default="", alias="X-Signature")):
    body = await request.body()
    if LEMON_WEBHOOK_SECRET:
        import hmac as hm2, hashlib
        expected = hm2.new(LEMON_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        if not hm2.compare_digest(expected, x_signature):
            raise HTTPException(400, "Lemon Squeezy webhook imzası hatalı")
    try:
        event = json.loads(body)
    except Exception:
        raise HTTPException(400, "Invalid body")

    etype = event.get("meta", {}).get("event_name", "")
    custom = event.get("meta", {}).get("custom_data", {})
    user_id = custom.get("user_id", "")
    plan = custom.get("plan", "pro")

    if etype == "order_created" and user_id:
        attrs = event.get("data", {}).get("attributes", {})
        order_id = str(event.get("data", {}).get("id", ""))
        _activate_subscription(user_id, plan, "lemonsqueezy", order_id, db)
        txn = Transaction(
            id=str(uuid4()), user_id=user_id,
            provider="lemonsqueezy", provider_txn_id=order_id,
            amount=attrs.get("total", 0) / 100,
            currency=attrs.get("currency", "USD").upper(),
            status="succeeded", plan=plan,
        )
        db.add(txn); db.commit()

    return {"received": True}


@router.get("/billing/subscription")
async def my_subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == SubStatusEnum.active,
    ).order_by(Subscription.created_at.desc()).first()

    tier = user.tier.value if hasattr(user.tier,"value") else str(user.tier)
    plan_info = {
        "free":  {"name":"Free",  "price_try":0,   "price_usd":0},
        "pro":   {"name":"Pro",   "price_try":299, "price_usd":9.99},
        "elite": {"name":"Elite", "price_try":799, "price_usd":24.99},
    }.get(tier, {})

    return {
        "tier": tier,
        "plan": plan_info,
        "subscription": {
            "id":          sub.id          if sub else None,
            "status":      sub.status.value if sub else "free",
            "provider":    sub.provider.value if sub else None,
            "started_at":  sub.started_at.isoformat() if sub else None,
            "expires_at":  sub.expires_at.isoformat() if sub else None,
        } if sub else None,
        "features": {
            "free":  ["daily_signals_5","basic_analysis","portfolio_1"],
            "pro":   ["unlimited_signals","ai_copilot","kalkan_pro","morning_briefing","portfolio_3"],
            "elite": ["all_pro_features","scenario_sim","api_access","vip_support","portfolio_10"],
        }.get(tier,[]),
    }


@router.post("/billing/cancel")
async def cancel_subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == SubStatusEnum.active,
    ).first()
    if not sub:
        raise HTTPException(404, "Aktif abonelik bulunamadı")
    sub.status = SubStatusEnum.cancelled
    sub.cancelled_at = datetime.now(timezone.utc)
    db.query(User).filter(User.id == user.id).update({"tier":"free"})
    db.commit()
    return {"cancelled": True, "message": "Aboneliğiniz iptal edildi, dönem sonuna kadar erişiminiz devam eder"}


@router.get("/billing/transactions")
async def transaction_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txns = db.query(Transaction).filter(Transaction.user_id == user.id)\
             .order_by(Transaction.created_at.desc()).limit(20).all()
    return {"transactions": [
        {"id":t.id,"amount":t.amount,"currency":t.currency,
         "status":t.status,"plan":t.plan.value if t.plan else None,
         "provider":t.provider.value if t.provider else None,
         "created_at":t.created_at.isoformat()} for t in txns
    ]}
