import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({
    id: params.id,
    strategy: {
      name: "Trend Takip + Momentum",
      description: "RSI bazlı momentum stratejisi ile trend takibi birleşimi.",
      entry_conditions: ["RSI 50 üzeri", "MACD pozitif kesişim", "Hacim ortalamanın 1.5x üzeri"],
      exit_conditions: ["RSI 75 üzeri (aşırı alım)", "MACD negatif kesişim"],
      risk_reward: 2.5,
      win_rate_pct: 68,
      avg_trade_duration: "4 saat - 2 gün",
    },
    updated_at: new Date().toISOString(),
  });
}
