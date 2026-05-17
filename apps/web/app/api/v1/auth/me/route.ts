import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, lookupUser, saveUser, generateId } from "../../_lib/auth";
import type { UserRecord } from "../../_lib/auth";

export const dynamic = "force-dynamic";

function normalizeRiskLevel(input: unknown): "low" | "medium" | "high" {
  if (input === "low" || input === "high") return input;
  return "medium";
}

function normalizeLanguage(input: unknown): "tr" | "en" {
  return input === "en" ? "en" : "tr";
}

export async function GET(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) {
    return NextResponse.json({ detail: "Yetkisiz erisim." }, { status: 401 });
  }

  const persisted = await lookupUser(payload.email);
  const createdAt = persisted?.createdAt || new Date().toISOString();
  const displayName = persisted?.name || payload.name || payload.email.split("@")[0];
  const resolvedPlan = persisted?.plan || payload.plan || "free";
  const resolvedRisk = normalizeRiskLevel(persisted?.risk_level);
  const resolvedDrawdown = Number.isFinite(persisted?.max_drawdown_pct)
    ? Number(persisted?.max_drawdown_pct)
    : (resolvedRisk === "low" ? 5 : resolvedRisk === "high" ? 20 : 10);
  const resolvedLanguage = normalizeLanguage(persisted?.language);

  return NextResponse.json({
    user: {
      id: payload.sub,
      email: payload.email,
      name: displayName,
      tier: resolvedPlan,
      plan: resolvedPlan,
      display_name: displayName,
      language: resolvedLanguage,
      risk_level: resolvedRisk,
      max_drawdown_pct: resolvedDrawdown,
      avatar_url: null,
      created_at: createdAt,
    },
  });
}

export async function PUT(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) {
    return NextResponse.json({ detail: "Yetkisiz erisim." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const existing = await lookupUser(payload.email);
  const resolvedRisk = normalizeRiskLevel(body.risk_level ?? existing?.risk_level);
  const fallbackDrawdown = resolvedRisk === "low" ? 5 : resolvedRisk === "high" ? 20 : 10;
  const requestedDrawdown = Number(body.max_drawdown_pct);
  const resolvedDrawdown = Number.isFinite(requestedDrawdown)
    ? Math.min(30, Math.max(2, requestedDrawdown))
    : Number.isFinite(existing?.max_drawdown_pct)
      ? Number(existing?.max_drawdown_pct)
      : fallbackDrawdown;

  const merged: UserRecord = {
    id: existing?.id || payload.sub || generateId(),
    email: payload.email,
    name:
      (typeof body.display_name === "string" && body.display_name.trim()) ||
      existing?.name ||
      payload.name ||
      payload.email.split("@")[0],
    hashedPassword: existing?.hashedPassword || "",
    plan: (existing?.plan || (payload.plan as UserRecord["plan"]) || "free") as UserRecord["plan"],
    createdAt: existing?.createdAt || new Date().toISOString(),
    language: normalizeLanguage(body.language ?? existing?.language),
    risk_level: resolvedRisk,
    max_drawdown_pct: resolvedDrawdown,
    max_leverage: Number.isFinite(Number(body.max_leverage))
      ? Math.max(1, Number(body.max_leverage))
      : existing?.max_leverage,
    signal_threshold: Number.isFinite(Number(body.signal_threshold))
      ? Math.max(1, Number(body.signal_threshold))
      : existing?.signal_threshold,
  };

  await saveUser(merged);

  return NextResponse.json({
    ok: true,
    user: {
      id: merged.id,
      email: merged.email,
      display_name: merged.name,
      language: merged.language || "tr",
      tier: merged.plan,
      plan: merged.plan,
      risk_level: merged.risk_level || "medium",
      max_drawdown_pct: merged.max_drawdown_pct ?? fallbackDrawdown,
    },
  });
}
