import { NextRequest, NextResponse } from "next/server";
import {
  lookupUser,
  signAccess,
  signRefresh,
  verifyPassword,
  setAuthCookies,
} from "../../_lib/auth";
import { getDevSeedUser } from "../../_lib/dev-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function userOut(user: {
  id: string;
  email: string;
  name: string;
  plan: string;
}) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.name,
    tier: user.plan,
    language: "tr",
    risk_level: "medium",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const email = emailRaw.toLowerCase().trim();

    if (!email || !password) {
      return NextResponse.json({ detail: "E-posta ve sifre gerekli." }, { status: 400 });
    }

    let user = await lookupUser(email);
    if (!user) {
      user = getDevSeedUser(email, password);
    }

    if (!user || !verifyPassword(password, user.hashedPassword)) {
      return NextResponse.json({ detail: "E-posta veya sifre hatali." }, { status: 401 });
    }

    const [accessToken, refreshToken] = await Promise.all([
      signAccess(user),
      signRefresh(user),
    ]);

    const res = NextResponse.json({
      token_type: "bearer",
      user: userOut(user),
    });
    setAuthCookies(res, accessToken, refreshToken);
    return res;
  } catch {
    return NextResponse.json({ detail: "Giris hatasi." }, { status: 500 });
  }
}
