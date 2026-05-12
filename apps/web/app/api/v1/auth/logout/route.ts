import { NextRequest, NextResponse } from "next/server";
import {
  clearAuthCookies,
  getRefreshTokenFromRequest,
  revokeRefreshSession,
  verifyToken,
} from "../../_lib/auth";

export async function POST(req: NextRequest) {
  const refresh = getRefreshTokenFromRequest(req);
  if (refresh) {
    const payload = await verifyToken(refresh);
    if (payload?.jti) revokeRefreshSession(payload.jti);
  }
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
