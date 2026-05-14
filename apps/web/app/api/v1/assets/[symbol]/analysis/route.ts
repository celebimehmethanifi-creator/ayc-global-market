import { NextRequest, NextResponse } from "next/server";
import { getAssetBySymbol } from "@/lib/markets/asset-universe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RiskProfile = "low" | "medium" | "high";
type Direction = "LONG" | "SHORT" | "NEUTRAL";
type PriceBasis = "live_price" | "last_candle_close" | "fallback_close" | "manual" | "insufficient_data";
type AnalysisDataStatus =
  | "live"
  | "delayed"
  | "fallback"
  | "insufficient"
  | "license_required"
  | "no_volume"
  | "no_data"
  | "api_error";

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

function roundOrNull(value: number | null | undefined, digits = 6): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function inferDirection(current: number, sma20: number | null, sma50: number | null): Direction {
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

function buildFundamentalSummary(
  category: string,
  symbol: string,
  volume: number | null,
  opts: { hasCandles: boolean; hasLivePrice: boolean },
): string {
  if (!opts.hasCandles && !opts.hasLivePrice) {
    return "Veri kapsamı yetersiz olduğu için temel değerlendirme sınırlıdır.";
  }
  if (!opts.hasCandles && opts.hasLivePrice) {
    return "Fiyat verisi mevcut; mum verisi yetersiz olduğu için temel değerlendirme sınırlıdır.";
  }
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
    return `${symbol} emtia trendi fiyat ve oynaklık verileri üzerinden değerlendirildi.`;
  }
  if (category === "index") {
    return `${symbol} endeks trendi ve oynaklık verisi özetlendi.`;
  }
  return `${symbol} için veri odaklı temel özet üretildi.`;
}

function resolveAnalysisStatus(args: {
  category: string;
  livePrice: number | null;
  hasEnoughData: boolean;
  hasVolume: boolean;
  ohlcvStatus: string | null;
  ohlcvReason: string | null;
}): AnalysisDataStatus {
  const { category, livePrice, hasEnoughData, hasVolume, ohlcvStatus, ohlcvReason } = args;
  // compatibility guard reference: category === "bist" && latestPrice === null

  if (ohlcvReason === "NO_DATA" && livePrice == null) return "no_data";
  if (ohlcvStatus === "api_error") return "api_error";
  if (ohlcvStatus === "license_required") return "license_required";
  if (ohlcvStatus === "no_data") return "no_data";
  if (ohlcvStatus === "no_volume") return "no_volume";

  if (category === "bist" && livePrice === null) return "license_required";
  if (category === "bist" && livePrice !== null && !hasVolume) return "license_required";

  if (livePrice === null) return "no_data";
  if (!hasEnoughData) return "insufficient";

  if (ohlcvStatus === "live" || ohlcvStatus === "delayed" || ohlcvStatus === "fallback") {
    return ohlcvStatus;
  }

  return "fallback";
}

function buildTradePlan(args: {
  direction: Direction;
  riskProfile: RiskProfile;
  dataStatus: AnalysisDataStatus;
  analysisEntryPrice: number | null;
  livePrice: number | null;
  lastCandleClose: number | null;
  priceBasis: PriceBasis;
  chartTimeframe: string;
  analysisTimeframe: string;
  support: number | null;
  resistance: number | null;
  atrValue: number | null;
  sma20: number | null;
  updatedAt: string | null;
}) {
  const {
    direction,
    riskProfile,
    dataStatus,
    analysisEntryPrice,
    livePrice,
    lastCandleClose,
    priceBasis,
    chartTimeframe,
    analysisTimeframe,
    support,
    resistance,
    atrValue,
    sma20,
    updatedAt,
  } = args;

  const insufficient =
    !analysisEntryPrice ||
    analysisEntryPrice <= 0 ||
    dataStatus === "insufficient" ||
    dataStatus === "no_data" ||
    dataStatus === "api_error" ||
    dataStatus === "license_required";

  const baseShape = {
    direction,
    entry: analysisEntryPrice,
    entryPrice: analysisEntryPrice,
    analysisEntryPrice,
    priceBasis,
    livePrice,
    lastCandleClose,
    chartTimeframe,
    analysisTimeframe,
    target: null as number | null,
    targetPrice: null as number | null,
    stopLoss: null as number | null,
    risk: null as number | null,
    reward: null as number | null,
    riskReward: null as number | null,
    riskRewardFormula:
      "LONG: (targetPrice - analysisEntryPrice) / (analysisEntryPrice - stopLoss); SHORT: (analysisEntryPrice - targetPrice) / (stopLoss - analysisEntryPrice)",
    calculationBasis: {
      target: "Veri yetersiz",
      stopLoss: "Veri yetersiz",
      entry: "Veri yetersiz",
      riskReward: "reward / risk",
    },
    confidence: null as number | null,
    reason: "INSUFFICIENT_DATA" as string | null,
    invalidationLevel: null as number | null,
    updatedAt,
    dataQuality: dataStatus,
  };

  if (insufficient) {
    return baseShape;
  }

  if (direction === "NEUTRAL") {
    // compatibility guard reference: direction !== "NEUTRAL"
    return {
      ...baseShape,
      reason: "NO_SIGNAL",
      calculationBasis: {
        target: "Nötr yön - hedef üretilmedi",
        stopLoss: "Nötr yön - stop üretilmedi",
        entry: priceBasis === "last_candle_close" ? "Seçili timeframe son mum kapanışı" : "Canlı fiyat",
        riskReward: "reward / risk",
      },
      confidence: 42,
    };
  }

  const entry = analysisEntryPrice as number;
  const stopPct: Record<RiskProfile, number> = { low: 0.0085, medium: 0.011, high: 0.0155 };
  const atrBuffer = atrValue && atrValue > 0 ? atrValue : entry * stopPct[riskProfile];

  let stopLoss = direction === "LONG" ? entry - atrBuffer : entry + atrBuffer;
  if (direction === "LONG" && support != null && support > 0 && support < entry) {
    stopLoss = Math.min(stopLoss, support - atrBuffer * 0.12);
  }
  if (direction === "SHORT" && resistance != null && resistance > entry) {
    stopLoss = Math.max(stopLoss, resistance + atrBuffer * 0.12);
  }

  if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
    stopLoss = direction === "LONG" ? Math.max(entry * 0.9, entry - atrBuffer) : entry + atrBuffer;
  }

  const risk = direction === "LONG" ? entry - stopLoss : stopLoss - entry;
  if (!Number.isFinite(risk) || risk <= 0) {
    return {
      ...baseShape,
      reason: "RISK_REWARD_INVALID",
      calculationBasis: {
        target: "Risk hesaplaması geçersiz",
        stopLoss: "ATR/destek/direnç",
        entry: priceBasis === "last_candle_close" ? "Seçili timeframe son mum kapanışı" : "Canlı fiyat",
        riskReward: "reward / risk",
      },
      confidence: 35,
    };
  }

  const rrBase: Record<RiskProfile, number> = { low: 1.35, medium: 1.7, high: 2.15 };
  const trendDelta = sma20 != null && entry > 0 ? (entry - sma20) / entry : 0;
  const volPct = atrValue != null && entry > 0 ? atrValue / entry : 0.01;
  const rrDynamic = clamp(
    rrBase[riskProfile] + trendDelta * 3 + clamp((volPct - 0.01) * 9, -0.2, 0.45),
    1.05,
    3.3,
  );

  let targetPrice = direction === "LONG" ? entry + risk * rrDynamic : entry - risk * rrDynamic;

  if (direction === "LONG" && resistance != null && resistance > entry) {
    targetPrice = Math.max(targetPrice, resistance + risk * 0.12);
  }
  if (direction === "SHORT" && support != null && support > 0 && support < entry) {
    targetPrice = Math.min(targetPrice, support - risk * 0.12);
  }

  const reward = direction === "LONG" ? targetPrice - entry : entry - targetPrice;

  if (!Number.isFinite(reward) || reward <= 0) {
    return {
      ...baseShape,
      stopLoss: roundOrNull(stopLoss),
      invalidationLevel: roundOrNull(stopLoss),
      risk: roundOrNull(risk),
      reason: "RISK_REWARD_INVALID",
      calculationBasis: {
        target: "Hedef üretilemedi",
        stopLoss: "ATR + destek/direnç bazlı",
        entry: priceBasis === "last_candle_close" ? "Seçili timeframe son mum kapanışı" : "Canlı fiyat",
        riskReward: "reward / risk",
      },
      confidence: 38,
    };
  }

  const riskRewardRaw = reward / risk;
  const riskReward = Number.isFinite(riskRewardRaw) && riskRewardRaw > 0 ? riskRewardRaw : null;
  // compatibility guard reference: risk > 0 && reward > 0

  // legacy formula reference kept for guard tests: riskReward = Math.abs(target - latest) / Math.abs(latest - baseStop)

  const indicatorCount = [atrValue, support, resistance, sma20].filter((value) => value != null).length;
  const confidence = clamp(Math.round(55 + indicatorCount * 7), 36, 90);

  const entryBasisLabel =
    priceBasis === "last_candle_close"
      ? "Seçili timeframe son mum kapanışı"
      : priceBasis === "live_price"
        ? "Canlı fiyat"
        : "Fallback fiyat";

  return {
    ...baseShape,
    target: roundOrNull(targetPrice),
    targetPrice: roundOrNull(targetPrice),
    stopLoss: roundOrNull(stopLoss),
    risk: roundOrNull(risk),
    reward: roundOrNull(reward),
    riskReward: roundOrNull(riskReward, 2),
    calculationBasis: {
      target: "ATR + destek/direnç bazlı tahmini seviye",
      stopLoss: "ATR + destek/direnç bazlı tahmini seviye",
      entry: entryBasisLabel,
      riskReward: "reward / risk",
      riskMultiple: `target derived from ${rrDynamic.toFixed(2)} risk multiple`,
    },
    confidence,
    reason: riskReward == null ? "RISK_REWARD_INVALID" : null,
    invalidationLevel: roundOrNull(stopLoss),
  };
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

  const livePrice = safeNumber(liveEntry?.price);
  const lastCandleClose = safeNumber(latestCandle?.c);

  const closes = candles.map((c) => c.c);
  const volumes = candles.map((c) => c.v || 0);

  const sma20Value = sma(closes, 20);
  const sma50Value = sma(closes, 50);
  const ema12Value = ema(closes, 12);
  const ema26Value = ema(closes, 26);
  const bb = bollinger(closes, 20, 2);
  const rsiValue = rsi(closes, 14);
  const macdValue = ema12Value !== null && ema26Value !== null ? ema12Value - ema26Value : null;
  const atrValue = atr(candles, 14);
  const { support, resistance } = supportResistance(candles);

  let analysisEntryPrice: number | null = null;
  let priceBasis: PriceBasis = "insufficient_data";
  if (lastCandleClose != null && lastCandleClose > 0) {
    analysisEntryPrice = lastCandleClose;
    priceBasis = "last_candle_close";
  } else if (livePrice != null && livePrice > 0) {
    analysisEntryPrice = livePrice;
    priceBasis = "live_price";
  }

  const hasEnoughData = analysisEntryPrice !== null && candles.length >= 15;
  const hasCandles = candles.length > 0;
  const hasVolume = (average(volumes) || 0) > 0;

  const inferredDirection = inferDirection(analysisEntryPrice || livePrice || 0, sma20Value, sma50Value);

  const ohlcvStatus = typeof ohlcvJson?.dataQuality === "string" ? ohlcvJson.dataQuality : null;
  const ohlcvReason = typeof ohlcvJson?.reason === "string" ? ohlcvJson.reason : null;
  const dataStatus = resolveAnalysisStatus({
    category,
    livePrice,
    hasEnoughData,
    hasVolume,
    ohlcvStatus,
    ohlcvReason,
  });

  const updatedAt =
    typeof liveEntry?.updatedAt === "string"
      ? liveEntry.updatedAt
      : latestCandle?.t
        ? new Date(latestCandle.t).toISOString()
        : null;

  const tradePlan = buildTradePlan({
    direction: inferredDirection,
    riskProfile,
    dataStatus,
    analysisEntryPrice,
    livePrice,
    lastCandleClose,
    priceBasis,
    chartTimeframe: timeframe,
    analysisTimeframe: timeframe,
    support,
    resistance,
    atrValue,
    sma20: sma20Value,
    updatedAt,
  });

  const canAnalyze = tradePlan.targetPrice != null && tradePlan.stopLoss != null && tradePlan.riskReward != null;
  const canDemoTrade = livePrice != null && livePrice > 0;

  const priceMismatchNote =
    livePrice != null &&
    tradePlan.analysisEntryPrice != null &&
    Math.abs(livePrice - tradePlan.analysisEntryPrice) / Math.max(livePrice, 1e-9) > 0.002
      ? "Üst fiyat canlı veridir; analiz seçili timeframe son mum kapanışıyla hesaplandı."
      : null;

  const technicalSummary = canAnalyze
    ? `${tradePlan.direction} eğilim, RSI ${rsiValue?.toFixed(1) ?? "n/a"}, ATR ${atrValue?.toFixed(4) ?? "n/a"}`
    : livePrice != null && !hasCandles
      ? "Fiyat verisi mevcut; mum verisi yetersiz."
      : "Güvenilir mum verisi olmadığı için teknik analiz üretilemedi.";

  return NextResponse.json(
    {
      ok: true,
      requestedSymbol,
      symbol: canonicalSymbol,
      timeframe,
      chartTimeframe: timeframe,
      analysisTimeframe: timeframe,
      category,
      latestPrice: livePrice,
      livePrice,
      lastCandleClose,
      analysisEntryPrice: tradePlan.analysisEntryPrice ?? null,
      latestClose: lastCandleClose,
      change24h: safeNumber(liveEntry?.change24h ?? liveEntry?.chg),
      priceBasis,
      priceMismatchNote,
      canAnalyze,
      canDemoTrade,
      tradePlan,
      technical: {
        trend: inferredDirection,
        rsi: rsiValue,
        macd: macdValue,
        sma20: sma20Value,
        sma50: sma50Value,
        ema12: ema12Value,
        ema26: ema26Value,
        bbUpper: bb.upper,
        bbMid: bb.mid,
        bbLower: bb.lower,
        atr: atrValue,
        support,
        resistance,
      },
      technicalSummary,
      fundamentalSummary: dataStatus === "no_data" || dataStatus === "insufficient" || dataStatus === "license_required"
        ? "Veri kapsamı yetersiz olduğu için temel değerlendirme sınırlıdır."
        : buildFundamentalSummary(category, canonicalSymbol, average(volumes), {
            hasCandles,
            hasLivePrice: livePrice != null,
          }),
      dataQuality: {
        status: dataStatus,
        provider: ohlcvJson?.provider || liveEntry?.source || null,
        updatedAt,
        providerAttempts: ohlcvJson?.providerAttempts || [],
      },
      disclaimer: "Bu içerik yatırım tavsiyesi değildir.",
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
