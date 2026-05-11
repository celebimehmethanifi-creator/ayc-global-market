import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { symbol = "BTCUSDT", price = 0, scenarios: reqScenarios } = body;

  const base = Number(price) || 50000;
  const sym = String(symbol).replace("USDT", "");

  const scenarios = reqScenarios || [
    {
      id: "bull",
      label: "Boğa Senaryosu",
      probability: 45,
      price_target: +(base * 1.12).toFixed(2),
      change_pct: 12,
      timeframe: "30 gün",
      triggers: ["Kurumsal alım artışı", "Teknik direnç kırılımı", "Pozitif makro veri"],
      color: "var(--up)",
    },
    {
      id: "base",
      label: "Baz Senaryo",
      probability: 38,
      price_target: +(base * 1.03).toFixed(2),
      change_pct: 3,
      timeframe: "30 gün",
      triggers: ["Mevcut trend devam", "Yatay konsolidasyon"],
      color: "var(--gold)",
    },
    {
      id: "bear",
      label: "Ayı Senaryosu",
      probability: 17,
      price_target: +(base * 0.88).toFixed(2),
      change_pct: -12,
      timeframe: "30 gün",
      triggers: ["Makro baskı", "Likidite krizi riski"],
      color: "var(--down)",
    },
  ];

  return NextResponse.json({
    symbol,
    sym,
    price: base,
    scenarios,
    ai_bias: "mildly_bullish",
    updated_at: new Date().toISOString(),
  });
}
