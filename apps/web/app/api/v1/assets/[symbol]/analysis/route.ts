import { NextRequest, NextResponse } from "next/server";
import { getAssetBySymbol } from "@/lib/markets/asset-universe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RiskProfile = "low" | "medium" | "high";
type AnalysisDataStatus = "live" | "delayed" | "fallback" | "insufficient" | "license_required" | "no_volume" | "no_data";

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
  if (sma20 !== null && sma50 !== null) {
    if (current > sma20 && sma20 >= sma50) return "LONG";
    if (current < sma20 && sma20 <= sma50) return "SHORT";
  }
  if (sma20 !== null) {
    const diffPct = ((current - sma20) / sma20) * 100;
    if (diffPct > 0.6) return "LONG";
    if (diffPct < -0.6) return "SHORT";
  }
  return "NEUTRAL";
}

function buildTradePlan(args: {
  latest: number;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  sma20: number | null;
  support: number | null;
  resistance: number | null;
  atrValue: number | null;
  riskProfile: RiskProfile;
  hasEnoughData: boolean;
}) {
  const { latest, direction, sma20, support, resistance, atrValue, riskProfile, hasEnoughData } = args;
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

  const rrMap: Record<RiskProfile, number> = { low: 1.45, medium: 1.85, high: 2.35 };
  const fallbackStopPct: Record<RiskProfile, number> = { low: 0.008, medium: 0.011, high: 0.015 };
  const stopBuffer = atrValue && atrValue > 0 ? atrValue : latest * fallbackStopPct[riskProfile];
  const resolvedDirection =
    direction !== "NEUTRAL"
      ? direction
      : sma20 !== null
        ? latest >= sma20
          ? "LONG"
          : "SHORT"
        : "NEUTRAL";

  let baseStop = latest - stopBuffer;
  let target = latest + stopBuffer * rrMap[riskProfile];

  if (resolvedDirection === "SHORT") {
    baseStop = resistance && resistance > latest ? resistance + stopBuffer * 0.2 : latest + stopBuffer;
    const rawRisk = Math.max(Math.abs(baseStop - latest), latest * 0.0015);
    const reward = rawRisk * rrMap[riskProfile];
    const fallbackTarget = latest - reward;
    const resistanceBased = support && support < latest ? support - rawRisk * 0.25 : fallbackTarget;
    target = Math.min(fallbackTarget, resistanceBased);
  } else {
    baseStop = support && support < latest ? support - stopBuffer * 0.2 : latest - stopBuffer;
    const rawRisk = Math.max(Math.abs(latest - baseStop), latest * 0.0015);
    const reward = rawRisk * rrMap[riskProfile];
    const fallbackTarget = latest + reward;
    const resistanceBased = resistance && resistance > latest ? resistance + rawRisk * 0.25 : fallbackTarget;
    target = Math.max(fallbackTarget, resistanceBased);
  }

  if (!(baseStop > 0) || !Number.isFinite(baseStop)) {
    baseStop = resolvedDirection === "SHORT" ? latest + stopBuffer : Math.max(latest - stopBuffer, latest * 0.1);
  }
  if (!(target > 0) || !Number.isFinite(target)) {
    target = resolvedDirection === "SHORT" ? Math.max(latest - stopBuffer * rrMap[riskProfile], latest * 0.1) : latest + stopBuffer * rrMap[riskProfile];
  }

  const riskReward = Math.abs(target - latest) / Math.max(Math.abs(latest - baseStop), latest * 0.0015);
  const confidenceBase = resolvedDirection === "NEUTRAL" ? 52 : 62;
  const indicatorBoost = [atrValue, support, resistance, sma20].filter((value) => value != null).length * 4;
  const confidence = Math.min(88, Math.max(35, Math.round(confidenceBase + indicatorBoost)));

  return {
    direction: direction,
    entry: latest,
    target: Number(target.toFixed(6)),
    stopLoss: Number(baseStop.toFixed(6)),
    riskReward: Number(riskReward.toFixed(2)),
    confidence,
    reason: null,
  };
}

function buildFundamentalSummary(category: string, symbol: string, volume: number | null, analysisAllowed: boolean): string {
  if (!analysisAllowed) return "Temel analiz için güvenilir veri yok.";
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

  const hasEnoughData = latestPrice !== null && candles.length >= 15;
  const direction = inferDirection(latestPrice || 0, sma20, sma50);

  const tradePlan = buildTradePlan({
    latest: latestPrice || 0,
    direction,
    sma20,
    support,
    resistance,
    atrValue,
    riskProfile,
    hasEnoughData,
  });

  const ohlcvStatus = typeof ohlcvJson?.dataQuality === "string" ? ohlcvJson.dataQuality : null;
  const hasVolume = (average(volumes) || 0) > 0;
  let dataStatus: AnalysisDataStatus;
  if (category === "bist" && latestPrice === null) dataStatus = "license_required";
  else if (category === "bist" && latestPrice !== null && !hasVolume) dataStatus = "license_required";
  else if (latestPrice === null) dataStatus = "no_data";
  else if (!hasEnoughData) dataStatus = "insufficient";
  else if (liveEntry) dataStatus = "live";
  else dataStatus = (ohlcvStatus as AnalysisDataStatus) || (ohlcvJson?.provider ? "fallback" : "delayed");

  // Fail-closed analysisAllowed gate — must match apps/web/lib/markets/market-truth.ts.
  // Only "live" or "delayed" market data with enough candles produces actionable metrics.
  const analysisAllowed = (dataStatus === "live" || dataStatus === "delayed") && hasEnoughData;

  // Force tradePlan nullable fields to null when analysis is not allowed.
  // buildTradePlan already does this via hasEnoughData; defense in depth here.
  const safeTradePlan = analysisAllowed
    ? tradePlan
    : {
        direction: "NEUTRAL" as const,
        entry: null,
        target: null,
        stopLoss: null,
        riskReward: null,
        confidence: 0,
        reason: tradePlan.reason || "ANALYSIS_BLOCKED",
      };

  const canShowTradePlan = analysisAllowed && safeTradePlan.target !== null && safeTradePlan.stopLoss !== null;

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
      tradePlan: safeTradePlan,
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
      technicalSummary: analysisAllowed
        ? `${direction} eğilim, RSI ${rsiValue?.toFixed(1) ?? "n/a"}, ATR ${atrValue?.toFixed(4) ?? "n/a"}`
        : "Teknik analiz için veri yetersiz.",
      fundamentalSummary: buildFundamentalSummary(category, canonicalSymbol, average(volumes), analysisAllowed),
      dataQuality: {
        status: dataStatus,
        provider: ohlcvJson?.provider || liveEntry?.source || null,
        updatedAt: new Date(latestCandle?.t || Date.now()).toISOString(),
        providerAttempts: ohlcvJson?.providerAttempts || [],
        analysisAllowed,
        candlesAvailable: candles.length,
        canShow: {
          tradePlan: canShowTradePlan,
          target: canShowTradePlan,
          stop: canShowTradePlan,
          riskReward: canShowTradePlan,
          kelly: canShowTradePlan,
          probability: canShowTradePlan,
          directionChip: analysisAllowed,
          fundamentalAnalysis: analysisAllowed,
          technicalAnalysis: analysisAllowed,
        },
      },
      disclaimer: "Bu içerik yatırım tavsiyesi değildir.",
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
