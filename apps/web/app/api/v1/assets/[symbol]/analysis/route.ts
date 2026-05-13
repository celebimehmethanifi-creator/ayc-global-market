import { NextRequest, NextResponse } from "next/server";
import { getAssetBySymbol } from "@/lib/markets/asset-universe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RiskProfile = "low" | "medium" | "high";

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

function normalizeRiskProfile(value: string | null): RiskProfile {
  if (value === "low" || value === "high") return value;
  return "medium";
}

function safeNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let current = average(values.slice(0, period)) as number;
  for (let i = period; i < values.length; i += 1) {
    current = values[i] * k + current * (1 - k);
  }
  return current;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gain += delta;
    else loss += Math.abs(delta);
  }
  if (loss === 0) return 100;
  const rs = gain / period / (loss / period);
  return 100 - 100 / (1 + rs);
}

function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = candles.length - period; i < candles.length; i += 1) {
    const current = candles[i];
    const prevClose = candles[i - 1]?.c ?? current.c;
    const tr = Math.max(
      current.h - current.l,
      Math.abs(current.h - prevClose),
      Math.abs(current.l - prevClose),
    );
    trs.push(tr);
  }
  return average(trs);
}

function bollinger(values: number[], period = 20, mult = 2): { upper: number | null; mid: number | null; lower: number | null } {
  if (values.length < period) return { upper: null, mid: null, lower: null };
  const slice = values.slice(-period);
  const mid = average(slice);
  if (mid == null) return { upper: null, mid: null, lower: null };
  const variance = slice.reduce((sum, value) => sum + (value - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return {
    upper: mid + mult * sd,
    mid,
    lower: mid - mult * sd,
  };
}

function supportResistance(candles: Candle[]): { support: number | null; resistance: number | null } {
  if (candles.length < 20) return { support: null, resistance: null };
  const recent = candles.slice(-50);
  return {
    support: Math.min(...recent.map((c) => c.l)),
    resistance: Math.max(...recent.map((c) => c.h)),
  };
}

function inferDirection(current: number, sma20: number | null, sma50: number | null): "LONG" | "SHORT" | "NEUTRAL" {
  if (sma20 === null || sma50 === null) return "NEUTRAL";
  if (current > sma20 && sma20 >= sma50) return "LONG";
  if (current < sma20 && sma20 <= sma50) return "SHORT";
  return "NEUTRAL";
}

function buildTradePlan(args: {
  latest: number;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  support: number | null;
  resistance: number | null;
  atrValue: number | null;
  riskProfile: RiskProfile;
  hasEnoughData: boolean;
}) {
  const { latest, direction, support, resistance, atrValue, riskProfile, hasEnoughData } = args;
  if (!hasEnoughData || latest <= 0) {
    return {
      direction: "NEUTRAL" as const,
      entry: latest || null,
      target: null,
      stopLoss: null,
      riskReward: null,
      confidence: 0,
      reason: "INSUFFICIENT_DATA",
    };
  }

  const rrMap: Record<RiskProfile, number> = { low: 1.5, medium: 2, high: 3 };
  const stopBuffer = atrValue && atrValue > 0 ? atrValue : latest * 0.01;
  const baseStop = direction === "SHORT"
    ? (resistance || latest) + stopBuffer
    : (support || latest) - stopBuffer;
  const risk = Math.max(Math.abs(latest - baseStop), latest * 0.0025);
  const reward = risk * rrMap[riskProfile];
  const target = direction === "SHORT" ? latest - reward : latest + reward;

  const confidence = direction === "NEUTRAL"
    ? 45
    : riskProfile === "low"
      ? 65
      : riskProfile === "high"
        ? 72
        : 68;

  return {
    direction,
    entry: latest,
    target: Number(target.toFixed(6)),
    stopLoss: Number(baseStop.toFixed(6)),
    riskReward: Number(rrMap[riskProfile].toFixed(2)),
    confidence,
    reason: null,
  };
}

function buildFundamentalSummary(category: string, symbol: string, volume: number | null): string {
  if (category === "crypto") {
    return `${symbol} için momentum ve hacim odaklı değerlendirme yapıldı${volume ? ` (hacim ${volume.toLocaleString("en-US", { maximumFractionDigits: 0 })})` : ""}.`;
  }
  if (category === "us" || category === "bist" || category === "etf") {
    return `${symbol} için fiyat aksiyonu bazlı özet üretildi. Sağlayıcı verisi mevcut oldukça temel metrikler genişletilecektir.`;
  }
  if (category === "forex") {
    return `${symbol} için kur hareketi ve volatilite öncelikli özet üretildi. Makro veri yoksa yorum güveni düşer.`;
  }
  if (category === "precious" || category === "energy" || category === "commodity") {
    return `${symbol} emtia trendi son mum verileri üzerinden değerlendirildi.`;
  }
  if (category === "index") {
    return `${symbol} endeks trendi ve oynaklık verisi özetlendi.`;
  }
  return `${symbol} için veri odaklı temel özet üretildi.`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } },
) {
  const requestedSymbol = decodeURIComponent(params.symbol || "").trim().toUpperCase();
  const timeframe = (req.nextUrl.searchParams.get("timeframe") || "1D").toUpperCase();
  const riskProfile = normalizeRiskProfile(req.nextUrl.searchParams.get("riskProfile"));

  const resolvedAsset = getAssetBySymbol(requestedSymbol);
  const canonicalSymbol = resolvedAsset?.symbol || requestedSymbol;
  const category = resolvedAsset?.category || "unknown";

  const ohlcvUrl = new URL(`/api/v1/ohlcv/${encodeURIComponent(canonicalSymbol)}?tf=${encodeURIComponent(timeframe)}`, req.url);
  const pricesUrl = new URL(`/api/v1/prices/live?symbols=${encodeURIComponent(canonicalSymbol)}`, req.url);

  const [ohlcvResp, priceResp] = await Promise.allSettled([
    fetch(ohlcvUrl.toString(), { cache: "no-store" }),
    fetch(pricesUrl.toString(), { cache: "no-store" }),
  ]);

  const ohlcvJson = ohlcvResp.status === "fulfilled" && ohlcvResp.value.ok
    ? await ohlcvResp.value.json().catch(() => null)
    : null;
  const priceJson = priceResp.status === "fulfilled" && priceResp.value.ok
    ? await priceResp.value.json().catch(() => null)
    : null;

  const candles = (ohlcvJson?.candles || []) as Candle[];
  const latestCandle = candles.length ? candles[candles.length - 1] : null;
  const liveEntry = priceJson?.prices?.[canonicalSymbol];
  const latestPrice = safeNumber(liveEntry?.price) ?? latestCandle?.c ?? null;

  const closes = candles.map((c) => c.c);
  const volumes = candles.map((c) => c.v || 0);

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const bb = bollinger(closes, 20, 2);
  const rsiValue = rsi(closes, 14);
  const macdValue = ema12 !== null && ema26 !== null ? ema12 - ema26 : null;
  const atrValue = atr(candles, 14);
  const { support, resistance } = supportResistance(candles);

  const hasEnoughData = candles.length >= 24 && latestPrice !== null;
  const direction = inferDirection(latestPrice || 0, sma20, sma50);

  const tradePlan = buildTradePlan({
    latest: latestPrice || 0,
    direction,
    support,
    resistance,
    atrValue,
    riskProfile,
    hasEnoughData,
  });

  const ohlcvStatus = typeof ohlcvJson?.dataQuality === "string" ? ohlcvJson.dataQuality : null;
  const dataStatus =
    !hasEnoughData
      ? "insufficient"
      : liveEntry
        ? "live"
        : ohlcvStatus || (ohlcvJson?.provider ? "fallback" : "delayed");

  return NextResponse.json(
    {
      ok: true,
      requestedSymbol,
      symbol: canonicalSymbol,
      timeframe,
      category,
      latestPrice,
      latestClose: latestCandle?.c ?? null,
      change24h: safeNumber(liveEntry?.change24h ?? liveEntry?.chg),
      tradePlan,
      technical: {
        trend: direction,
        rsi: rsiValue,
        macd: macdValue,
        sma20,
        sma50,
        ema12,
        ema26,
        bbUpper: bb.upper,
        bbMid: bb.mid,
        bbLower: bb.lower,
        atr: atrValue,
        support,
        resistance,
      },
      technicalSummary: hasEnoughData
        ? `${direction} eğilim, RSI ${rsiValue?.toFixed(1) ?? "n/a"}, ATR ${atrValue?.toFixed(4) ?? "n/a"}`
        : "Veri yetersiz, teknik güven düşük.",
      fundamentalSummary: buildFundamentalSummary(category, canonicalSymbol, average(volumes)),
      dataQuality: {
        status: dataStatus,
        provider: ohlcvJson?.provider || liveEntry?.source || null,
        updatedAt: new Date(latestCandle?.t || Date.now()).toISOString(),
        providerAttempts: ohlcvJson?.providerAttempts || [],
      },
      disclaimer: "Bu içerik yatırım tavsiyesi değildir.",
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
