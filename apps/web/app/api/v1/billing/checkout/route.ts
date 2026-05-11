import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../_lib/auth";

const PLANS: Record<string, { name: string; price_usd: number; price_try: number; ls_variant?: string }> = {
  pro:   { name: "Pro",   price_usd: 9.99,  price_try: 299, ls_variant: process.env.LEMON_PRO_VARIANT_ID },
  elite: { name: "Elite", price_usd: 24.99, price_try: 749, ls_variant: process.env.LEMON_ELITE_VARIANT_ID },
};

async function createLemonCheckout(variantId: string, userEmail: string, plan: string): Promise<string | null> {
  const lsKey = process.env.LEMON_API_KEY;
  const storeId = process.env.LEMON_STORE_ID || "371817";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aycmarket.com";
  if (!lsKey || !variantId) return null;
  try {
    const body = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_options: { embed: false },
          checkout_data: { email: userEmail, custom: { plan } },
          product_options: {
            redirect_url: `${baseUrl}/subscribe/success?plan=${plan}&provider=lemonsqueezy`,
            receipt_link_url: `${baseUrl}/subscribe/success?plan=${plan}&provider=lemonsqueezy`,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    };
    const r = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lsKey}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.data?.attributes?.url || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) return NextResponse.json({ detail: "Yetkisiz" }, { status: 401 });

  const { plan, provider } = await req.json();
  if (!PLANS[plan]) return NextResponse.json({ detail: "Geçersiz plan" }, { status: 400 });

  const p = PLANS[plan];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aycmarket.com";
  const sessionId = "sess_" + Math.random().toString(36).slice(2, 18);

  if (provider === "lemonsqueezy") {
    // Try real LS checkout
    if (p.ls_variant) {
      const url = await createLemonCheckout(p.ls_variant, payload.email, plan);
      if (url) return NextResponse.json({ provider: "lemonsqueezy", checkout_url: url, demo: false });
    }
    // Fallback: direct store link
    return NextResponse.json({
      provider: "lemonsqueezy",
      demo: true,
      checkout_url: `https://aycmarket.lemonsqueezy.com`,
      message: "Ürün henüz oluşturulmadı — Lemon Squeezy mağaza sayfasına yönlendiriliyorsunuz",
    });
  }

  if (provider === "iyzico") {
    const iyzicoKey = process.env.IYZICO_API_KEY;
    const iyzicoSecret = process.env.IYZICO_SECRET_KEY;
    if (!iyzicoKey || !iyzicoSecret) {
      return NextResponse.json({
        provider: "iyzico",
        demo: true,
        checkout_url: `${baseUrl}/subscribe/success?plan=${plan}&provider=iyzico&session_id=${sessionId}&demo=1`,
        message: "iyzico API key gerekli — şimdilik demo mod",
      });
    }
    // TODO: real iyzico checkout
    return NextResponse.json({
      provider: "iyzico", demo: true,
      checkout_url: `${baseUrl}/subscribe/success?plan=${plan}&provider=iyzico&session_id=${sessionId}&demo=1`,
    });
  }

  // Generic demo
  return NextResponse.json({
    provider: provider || "demo",
    order_id: sessionId,
    demo: true,
    checkout_url: `${baseUrl}/subscribe/success?plan=${plan}&provider=${provider}&session_id=${sessionId}&demo=1`,
    plan_name: p.name,
    price_usd: p.price_usd,
    price_try: p.price_try,
  });
}
