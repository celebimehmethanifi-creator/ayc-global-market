import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, lookupUser } from "../../_lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) {
    return NextResponse.json({ detail: "Yetkisiz erisim" }, { status: 401 });
  }
  const user = await lookupUser(payload.email);
  return NextResponse.json({
    user: {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      tier: payload.plan || "free",
      plan: payload.plan || "free",
      avatar_url: null,
      created_at: user?.createdAt || new Date().toISOString(),
    },
  });
}
