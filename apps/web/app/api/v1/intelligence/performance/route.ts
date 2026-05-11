import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    total_signals: 147,
    correct_signals: 112,
    accuracy_pct: 76.2,
    avg_return_pct: 3.8,
    best_signal: { symbol: "NVDA", return_pct: 18.4, direction: "LONG" },
    worst_signal: { symbol: "TSLA", return_pct: -6.2, direction: "SHORT" },
    by_market: {
      crypto: { signals: 68, accuracy: 78.4 },
      stock: { signals: 45, accuracy: 75.6 },
      forex: { signals: 22, accuracy: 68.2 },
      metal: { signals: 12, accuracy: 83.3 },
    },
    monthly: [
      { month: "Ocak", accuracy: 72, signals: 24 },
      { month: "Şubat", accuracy: 74, signals: 28 },
      { month: "Mart", accuracy: 78, signals: 31 },
      { month: "Nisan", accuracy: 80, signals: 33 },
      { month: "Mayıs", accuracy: 76, signals: 31 },
    ],
    updated_at: new Date().toISOString(),
  });
}
