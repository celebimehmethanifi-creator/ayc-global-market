import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, lookupUser } from "../../_lib/auth";

export async function GET(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) {
    return NextResponse.json({ detail: "Yetkisiz erisim" }, { status: 401 });
  }

  const user = await lookupUser(payload.email);

  return NextResponse.json({
    id: payload.sub,
    email: payload.email,
    display_name: payload.name,
    tier: payload.plan || "free",
    language: "tr",
    risk_level: "medium",
    avatar_url: null,
    created_at: user?.createdAt || new Date().toISOString(),
    subscription: {
      plan: payload.plan || "free",
      status: "active",
      expires_at: null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) {
    return NextResponse.json({ detail: "Yetkisiz erisim" }, { status: 401 });
  }
  const body = await req.json();
  const user = await lookupUser(payload.email);
  if (user && body.name) {
    user.name = body.name;
    const { saveUser } = await import("../../_lib/auth");
    await saveUser(user);
  }
  return NextResponse.json({ success: true });
}
