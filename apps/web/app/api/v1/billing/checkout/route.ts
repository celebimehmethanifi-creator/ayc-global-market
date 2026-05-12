import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../_lib/auth";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const PLANS: Record<string, { name: string; price_usd: number; price_try: number; ls_variant?: string }> = {
  pro: {
    name: "Pro",
    price_usd: 9.99,
    price_try: 299,
    ls_variant: process.env.LEMON_PRO_VARIANT_ID,
  },
  elite: {
    name: "Elite",
    price_usd: 24.99,
    price_try: 749,
    ls_variant: process.env.LEMON_ELITE_VARIANT_ID,
  },
};

async function createLemonCheckout(
  variantId: string,
  userEmail: string,
  userId: string,
  plan: string,
): Promise<string | null> {
  const lsKey = (process.env.LEMON_API_KEY || "").trim();
  const storeId = (process.env.LEMON_STORE_ID || "").trim();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aycmarket.com";
  if (!lsKey || !variantId || !storeId) return null;

  try {
    const body = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_options: { embed: false },
          checkout_data: {
            email: userEmail,
            custom: {
              user_id: userId,
              email: userEmail,
              plan,
            },
          },
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
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) return NextResponse.json({ detail: "Yetkisiz" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan || "");
  const provider = String(body.provider || "lemonsqueezy").toLowerCase();

  if (!PLANS[plan]) return NextResponse.json({ detail: "Gecersiz plan" }, { status: 400 });

  if (provider !== "lemonsqueezy") {
    if (IS_PRODUCTION) {
      return NextResponse.json(
        { detail: "Bu provider production ortaminda kapali." },
        { status: 503 },
      );
    }
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aycmarket.com";
    const sessionId = "sess_" + Math.random().toString(36).slice(2, 18);
    return NextResponse.json({
      provider,
      demo: true,
      checkout_url: `${baseUrl}/subscribe/success?plan=${plan}&provider=${provider}&session_id=${sessionId}&demo=1`,
    });
  }

  const variantId = PLANS[plan].ls_variant;
  if (!variantId) {
    return NextResponse.json(
      { detail: "Lemon variant konfigurasyonu eksik." },
      { status: IS_PRODUCTION ? 503 : 400 },
    );
  }

  const checkoutUrl = await createLemonCheckout(variantId, payload.email, payload.sub, plan);
  if (!checkoutUrl) {
    return NextResponse.json(
      { detail: "Checkout olusturulamadi." },
      { status: IS_PRODUCTION ? 503 : 400 },
    );
  }

  return NextResponse.json({
    provider: "lemonsqueezy",
    demo: false,
    checkout_url: checkoutUrl,
  });
}
