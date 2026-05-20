import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, lookupUser } from "../../_lib/auth";

export async function GET(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) return NextResponse.json({ detail: "Yetkisiz" }, { status: 401 });

  const user = await lookupUser(payload.email);
  const tier = user?.plan || payload.plan || "free";

  return NextResponse.json({
    tier,
    status: "active",
    plan_name: tier.charAt(0).toUpperCase() + tier.slice(1),
    expires_at: null,
    features: {
      signals: tier !== "free" ? "unlimited" : "5/day",
      ai_copilot: tier !== "free",
      kalkan: true,
      briefing: tier !== "free",
    },
  });
}
