import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, lookupUser } from "../../_lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) {
    return NextResponse.json({ detail: "Yetkisiz erisim." }, { status: 401 });
  }

  const persisted = await lookupUser(payload.email);
  const createdAt = persisted?.createdAt || new Date().toISOString();
  const displayName = persisted?.name || payload.name || payload.email.split("@")[0];
  const resolvedPlan = persisted?.plan || payload.plan || "free";

  return NextResponse.json({
    user: {
      id: payload.sub,
      email: payload.email,
      name: displayName,
      tier: resolvedPlan,
      plan: resolvedPlan,
      avatar_url: null,
      created_at: createdAt,
    },
  });
}
