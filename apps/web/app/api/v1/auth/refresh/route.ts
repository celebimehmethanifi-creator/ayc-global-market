import { NextRequest, NextResponse } from "next/server";
import {
  getRefreshTokenFromRequest,
  lookupUser,
  revokeRefreshSession,
  setAuthCookies,
  signAccess,
  signRefresh,
  verifyRefreshToken,
} from "../../_lib/auth";
import type { UserRecord } from "../../_lib/auth";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      return NextResponse.json({ detail: "Refresh token gerekli." }, { status: 401 });
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload || payload.type !== "refresh") {
      return NextResponse.json({ detail: "Gecersiz refresh token." }, { status: 401 });
    }

    revokeRefreshSession(payload.jti);

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
    }

    const [nextAccess, nextRefresh] = await Promise.all([
      signAccess(user),
      signRefresh(user),
    ]);

    const res = NextResponse.json({
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
    setAuthCookies(res, nextAccess, nextRefresh);
    return res;
  } catch {
    return NextResponse.json({ detail: "Refresh hatasi." }, { status: 500 });
  }
}
