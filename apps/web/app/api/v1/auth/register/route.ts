import { NextRequest, NextResponse } from "next/server";
import { saveUser, lookupUser, signAccess, signRefresh, signCredential, hashPassword, generateId } from "../../_lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ detail: "Email, sifre ve isim gerekli" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ detail: "Sifre en az 6 karakter olmali" }, { status: 400 });
    }
    const existing = await lookupUser(email.toLowerCase());
    if (existing) {
      return NextResponse.json({ detail: "Bu email zaten kayitli" }, { status: 409 });
    }

    const id = generateId();
    const user = {
      id, email: email.toLowerCase(), name,
      hashedPassword: hashPassword(password),
      plan: "free" as const,
      createdAt: new Date().toISOString(),
    };
    await saveUser(user);

    const [access_token, refresh_token, credential_token] = await Promise.all([
      signAccess(user), signRefresh(user), signCredential(user),
    ]);

    return NextResponse.json({
      access_token, refresh_token, credential_token, token_type: "bearer",
      user: {
        id: user.id, email: user.email, display_name: user.name,
        tier: user.plan, language: "tr", risk_level: "medium",
        demoBalance: 10000, balance: 10000,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ detail: "Kayit hatasi: " + e.message }, { status: 500 });
  }
}
