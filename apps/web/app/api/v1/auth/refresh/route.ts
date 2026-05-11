import { NextRequest, NextResponse } from "next/server";
import { lookupUser, saveUser, signAccess, signRefresh, verifyToken } from "../../_lib/auth";
import type { UserRecord } from "../../_lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { refresh_token } = await req.json();
    if (!refresh_token) {
      return NextResponse.json({ detail: "Refresh token gerekli" }, { status: 400 });
    }

    const payload = await verifyToken(refresh_token);
    if (!payload || payload.type !== "refresh") {
      return NextResponse.json({ detail: "Gecersiz refresh token" }, { status: 401 });
    }

    // Try to find user from persistent store first, then reconstruct from JWT
    let user = await lookupUser(payload.email);
    if (!user) {
      user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        hashedPassword: "",
        plan: (payload.plan as UserRecord["plan"]) || "free",
        createdAt: new Date().toISOString(),
      };
      await saveUser(user);
    }

    const [access_token, new_refresh] = await Promise.all([
      signAccess(user),
      signRefresh(user),
    ]);

    return NextResponse.json({
      access_token,
      refresh_token: new_refresh,
      token_type: "bearer",
      user: {
        id: user.id,
        email: user.email,
        display_name: user.name,
        tier: user.plan,
        language: "tr",
        risk_level: "medium",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ detail: "Refresh hatasi: " + e.message }, { status: 500 });
  }
}
