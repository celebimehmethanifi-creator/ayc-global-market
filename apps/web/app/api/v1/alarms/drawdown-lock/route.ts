import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const pct = body.max_drawdown_pct || 10;
  return NextResponse.json({
    success: true,
    message: `Drawdown kilidi %${pct} olarak ayarlandi`,
    max_drawdown_pct: pct,
  });
}
