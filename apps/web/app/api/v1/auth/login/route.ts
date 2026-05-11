import { NextRequest, NextResponse } from "next/server";
import { lookupUser, signAccess, signRefresh, signCredential, verifyPassword, verifyCredential } from "../../_lib/auth";
import type { UserRecord } from "../../_lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, credential_token } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ detail: "Email ve sifre gerekli" }, { status: 400 });
    }

    // ── MASTER TEST ACCOUNTS (bypass normal auth) ──────────────
    const TEST_ACCOUNTS: Record<string, { password: string; name: string; tier: string; balance: number }> = {
      "elite@aycmarket.com":   { password: "AycElite2026!", name: "Elite Test",   tier: "elite", balance: 100000  },
      "pro@aycmarket.com":     { password: "AycPro2026!",   name: "Pro Test",     tier: "pro",   balance: 25000   },
      "free@aycmarket.com":    { password: "AycFree2026!",  name: "Free Test",    tier: "free",  balance: 10000   },
      "demo@aycmarket.com":    { password: "AycDemo2026!",  name: "Demo Test",    tier: "free",  balance: 10000   },
      "admin@aycmarket.com":   { password: "AycAdmin2026!", name: "Admin",        tier: "elite", balance: 500000  },
    };

    const emailLower = (email || "").toLowerCase().trim();
    const testAccount = TEST_ACCOUNTS[emailLower];
    if (testAccount && testAccount.password === password) {
      const userId = `test_${emailLower.split("@")[0]}`;
      const tokenPayload = {
        sub: userId, email: emailLower, tier: testAccount.tier,
        name: testAccount.name, iat: Date.now(),
        exp: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      };
      const token = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
      return NextResponse.json({
        success: true, token,
        access_token: token, refresh_token: token, credential_token: token, token_type: "bearer",
        user: {
          id: userId, name: testAccount.name, email: emailLower,
          display_name: testAccount.name,
          tier: testAccount.tier,
          language: "tr", risk_level: "medium",
          demoBalance: testAccount.balance,
          balance: testAccount.balance,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      });
    }
    // ── END MASTER TEST ACCOUNTS ────────────────────────────────

    let user = await lookupUser(email.toLowerCase());

    // Fallback: recover from credential_token if DB lookup fails (cold start)
    if (!user && credential_token) {
      const cred = await verifyCredential(credential_token);
      if (cred && cred.email === email.toLowerCase() && cred.hp && verifyPassword(password, cred.hp)) {
        const recovered: UserRecord = {
          id: cred.sub, email: cred.email, name: cred.name,
          hashedPassword: cred.hp, plan: (cred.plan as UserRecord["plan"]) || "free",
          createdAt: new Date().toISOString(),
        };
        const { saveUser } = await import("../../_lib/auth");
        await saveUser(recovered);
        user = recovered;
      }
    }

    if (!user) {
      return NextResponse.json({ detail: "Email veya sifre hatali" }, { status: 401 });
    }
    if (!verifyPassword(password, user.hashedPassword)) {
      return NextResponse.json({ detail: "Email veya sifre hatali" }, { status: 401 });
    }

    const [access_token, refresh_token, credential_token_new] = await Promise.all([
      signAccess(user), signRefresh(user), signCredential(user),
    ]);

    return NextResponse.json({
      access_token, refresh_token, credential_token: credential_token_new, token_type: "bearer",
      user: { id: user.id, email: user.email, display_name: user.name, tier: user.plan, language: "tr", risk_level: "medium" },
    });
  } catch (e: any) {
    return NextResponse.json({ detail: "Giris hatasi: " + e.message }, { status: 500 });
  }
}
