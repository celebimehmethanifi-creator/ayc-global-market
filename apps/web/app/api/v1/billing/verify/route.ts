import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, USERS_BY_ID } from "../../_lib/auth";

async function verifyLSOrder(sessionId: string): Promise<boolean> {
  const lsKey = process.env.LEMON_API_KEY;
  if (!lsKey || !sessionId || sessionId.startsWith("sess_")) return false;
  try {
    const r = await fetch(`https://api.lemonsqueezy.com/v1/orders?filter[identifier]=${sessionId}`, {
      headers: { Authorization: `Bearer ${lsKey}`, Accept: "application/vnd.api+json" },
    });
    if (!r.ok) return false;
    const data = await r.json();
    return data?.data?.length > 0 && data.data[0]?.attributes?.status === "paid";
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromAuthHeader(req);
    if (!payload) return NextResponse.json({ detail: "Yetkisiz" }, { status: 401 });

    const { session_id, plan, provider, user_id } = await req.json();

    // For demo sessions, just activate the plan
    const isDemo = !session_id || session_id.startsWith("sess_") || session_id.startsWith("demo_");
    const validPlan = ["pro", "elite"].includes(plan) ? plan : "pro";

    let verified = isDemo;
    if (!isDemo && provider === "lemonsqueezy") {
      verified = await verifyLSOrder(session_id);
    }

    // Update user tier
    const targetId = user_id || payload.sub;
    const user = USERS_BY_ID.get(targetId);
    if (user) {
      user.plan = validPlan as "pro" | "elite";
    }

    return NextResponse.json({
      verified,
      plan: validPlan,
      message: `${validPlan.charAt(0).toUpperCase() + validPlan.slice(1)} planı aktifleştirildi`,
      demo: isDemo,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Bilinmeyen hata";
    return NextResponse.json({ detail: "Verify hatası", error: message }, { status: 500 });
  }
}
