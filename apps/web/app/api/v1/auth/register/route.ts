import { NextRequest, NextResponse } from "next/server";
import {
  saveUser,
  lookupUser,
  signAccess,
  signRefresh,
  hashPassword,
  generateId,
  setAuthCookies,
} from "../../_lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const nameRaw = typeof body.name === "string" ? body.name : "";

    const email = emailRaw.toLowerCase().trim();
    const name = nameRaw.trim();

    if (!email || !password || !name) {
      return NextResponse.json({ detail: "E-posta, sifre ve isim gerekli." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ detail: "Sifre en az 8 karakter olmali." }, { status: 400 });
    }

    const existing = await lookupUser(email);
    if (existing) {
      return NextResponse.json({ detail: "Bu e-posta zaten kayitli." }, { status: 409 });
    }

    const user = {
      id: generateId(),
      email,
      name,
      hashedPassword: hashPassword(password),
      plan: "free" as const,
      createdAt: new Date().toISOString(),
    };
    await saveUser(user);

    const [accessToken, refreshToken] = await Promise.all([
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
        demoBalance: 10000,
        balance: 10000,
      },
    });
    setAuthCookies(res, accessToken, refreshToken);
    return res;
  } catch {
    return NextResponse.json({ detail: "Kayit hatasi." }, { status: 500 });
  }
}
