import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { symbol, price = 0, change_24h = 0, volume_ratio = 1 } = body;

  const sym = (symbol || "UNKNOWN").replace("USDT", "").replace("=F", "");
  const chg = Number(change_24h) || 0;

  let primary_cause = "ORGANIC_TREND";
  let primary_conf = 55;

  if (Math.abs(volume_ratio) > 3) { primary_cause = "VOLUME_ANOMALY"; primary_conf = 78; }
  else if (Math.abs(chg) > 5) { primary_cause = "TECHNICAL_BREAKOUT"; primary_conf = 71; }
  else if (Math.abs(chg) > 3) { primary_cause = "MOMENTUM_SURGE"; primary_conf = 65; }

  const direction = chg >= 0 ? "yükseliş" : "düşüş";
  const pct = Math.abs(chg).toFixed(2);

  const narrative = `${sym} sembolünde %${pct} günlük ${direction} hareketi gözlemleniyor. ` +
    `Birincil neden: ${primary_cause} (güven: %${primary_conf}). ` +
    `Hacim oranı ${volume_ratio.toFixed(1)}x — ` +
    (volume_ratio > 2 ? "kurumsal aktivite belirtisi. " : "normal seviyede. ") +
    "Manipülasyon riski düşük düzeyde.";

  return NextResponse.json({
    symbol,
    primary_cause,
    primary_conf,
    narrative,
    manipulation_risk: Math.min(Math.round(Math.abs(chg) * 4 + 8), 45),
    secondary_factors: [],
    price,
    updated_at: new Date().toISOString(),
  });
}
