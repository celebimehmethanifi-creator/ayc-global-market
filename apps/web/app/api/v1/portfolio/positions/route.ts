import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../_lib/auth";

export const dynamic = "force-dynamic";

declare global { var __AYC_POSITIONS: any[]; }
if (!globalThis.__AYC_POSITIONS) globalThis.__AYC_POSITIONS = [];

export async function GET(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  const userId = payload?.sub || "guest";
  const positions = globalThis.__AYC_POSITIONS.filter((p: any) => p.user_id === userId);
  return NextResponse.json({ positions, count: positions.length });
}

export async function POST(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  const userId = payload?.sub || "guest";
  const body = await req.json();
  const position = {
    id: "p_" + Date.now().toString(36),
    user_id: userId,
    symbol: body.symbol,
    name: body.name || body.symbol,
    category: body.category || "CRYPTO",
    entry: body.entry || 0,
    current: body.entry || 0,
    qty: body.qty || 0,
    change24h: 0,
    created_at: new Date().toISOString(),
  };
  globalThis.__AYC_POSITIONS.push(position);
  return NextResponse.json({ position, success: true }, { status: 201 });
}
