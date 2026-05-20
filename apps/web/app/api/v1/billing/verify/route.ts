import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, lookupUser, saveUser } from "../../_lib/auth";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const VALID_PLANS = new Set(["pro", "elite"]);

function extractPlanFromLemonOrder(payload: any): "pro" | "elite" | null {
  const item = payload?.data?.[0];
  const attributes = item?.attributes || {};
  const customPlan =
    attributes?.first_order_item?.custom_data?.plan ||
    attributes?.custom_data?.plan ||
    payload?.meta?.custom_data?.plan;

  if (customPlan && VALID_PLANS.has(String(customPlan).toLowerCase())) {
    return String(customPlan).toLowerCase() as "pro" | "elite";
  }

  const variantId =
    String(attributes?.first_order_item?.variant_id || attributes?.variant_id || "").trim();
  if (!variantId) return null;

  if (variantId === String(process.env.LEMON_PRO_VARIANT_ID || "").trim()) return "pro";
  if (variantId === String(process.env.LEMON_ELITE_VARIANT_ID || "").trim()) return "elite";
  return null;
}

async function verifyLemonOrder(sessionId: string): Promise<{ verified: boolean; plan: "pro" | "elite" | null }> {
  const lsKey = (process.env.LEMON_API_KEY || "").trim();
  if (!lsKey || !sessionId) return { verified: false, plan: null };
  try {
    const r = await fetch(
      `https://api.lemonsqueezy.com/v1/orders?filter[identifier]=${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Authorization: `Bearer ${lsKey}`,
          Accept: "application/vnd.api+json",
        },
        cache: "no-store",
      },
    );
    if (!r.ok) return { verified: false, plan: null };
    const data = await r.json();
    const item = data?.data?.[0];
    if (!item) return { verified: false, plan: null };
    const status = String(item?.attributes?.status || "").toLowerCase();
    if (status !== "paid") return { verified: false, plan: null };
    return { verified: true, plan: extractPlanFromLemonOrder(data) };
  } catch {
    return { verified: false, plan: null };
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromAuthHeader(req);
    if (!payload) {
      return NextResponse.json({ detail: "Yetkisiz." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const provider = String(body.provider || "lemonsqueezy").toLowerCase();
    const sessionId = String(body.session_id || "").trim();
    const requestedPlan = String(body.plan || "pro").toLowerCase();

    let verified = false;
    let resolvedPlan: "pro" | "elite" | null = null;

    if (provider === "lemonsqueezy") {
      const result = await verifyLemonOrder(sessionId);
      verified = result.verified;
      resolvedPlan = result.plan;
    }

    if (!verified && !IS_PRODUCTION) {
      const isDemo = !sessionId || sessionId.startsWith("sess_") || sessionId.startsWith("demo_");
      if (isDemo && VALID_PLANS.has(requestedPlan)) {
        verified = true;
        resolvedPlan = requestedPlan as "pro" | "elite";
      }
    }

    if (IS_PRODUCTION && !verified) {
      return NextResponse.json(
        {
          verified: false,
          detail: "Odeme dogrulamasi basarisiz. Demo aktivasyon production'da kapali.",
        },
        { status: 403 },
      );
    }

    if (!verified || !resolvedPlan) {
      return NextResponse.json(
        { verified: false, detail: "Plan dogrulanamadi." },
        { status: 400 },
      );
    }

    const user = await lookupUser(payload.email);
    if (user) {
      user.plan = resolvedPlan;
      await saveUser(user);
    }

    return NextResponse.json({
      verified: true,
      plan: resolvedPlan,
      message: `${resolvedPlan.toUpperCase()} plani aktif.`,
    });
  } catch {
    return NextResponse.json({ detail: "Verify hatasi." }, { status: 500 });
  }
}
