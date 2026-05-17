import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CausalCode =
  | "ORGANIC_TREND"
  | "VOLUME_SPIKE"
  | "TECHNICAL_BREAKOUT"
  | "NEWS_IMPACT"
  | "LOW_LIQUIDITY"
  | "MANIPULATION_RISK";

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function chooseCause(change24h: number, volumeRatio: number): { code: CausalCode; confidence: number } {
  if (Math.abs(volumeRatio) >= 3) return { code: "VOLUME_SPIKE", confidence: 78 };
  if (Math.abs(change24h) >= 4.5) return { code: "TECHNICAL_BREAKOUT", confidence: 72 };
  if (Math.abs(change24h) >= 2.2) return { code: "NEWS_IMPACT", confidence: 66 };
  if (Math.abs(change24h) >= 0.35) return { code: "ORGANIC_TREND", confidence: 58 };
  return { code: "ORGANIC_TREND", confidence: 52 };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const symbol = String(body?.symbol || "UNKNOWN").toUpperCase();
  const price = toNum(body?.price);
  const change24h = toNum(body?.change_24h);
  const volumeRatio = toNum(body?.volume_ratio, 1);
  const hasMeaningfulMove = Math.abs(change24h) >= 0.01;

  const normalizedSymbol = symbol.replace("USDT", "").replace("=F", "");
  const { code, confidence } = chooseCause(change24h, volumeRatio);

  const narrative = hasMeaningfulMove
    ? `${normalizedSymbol} için %${Math.abs(change24h).toFixed(2)} günlük ${
        change24h >= 0 ? "yükseliş" : "düşüş"
      } izlendi. Birincil etki ${code}, güven seviyesi %${confidence}.`
    : "Bu varlık için anlamlı hareket verisi henüz oluşmadı.";

  return NextResponse.json({
    symbol,
    primary_cause: code,
    primary_conf: confidence,
    narrative,
    manipulation_risk: hasMeaningfulMove ? Math.min(Math.round(Math.abs(change24h) * 4 + 8), 45) : 0,
    has_meaningful_move: hasMeaningfulMove,
    secondary_factors: [],
    price,
    updated_at: new Date().toISOString(),
  });
}
