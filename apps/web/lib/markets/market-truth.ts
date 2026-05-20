import { mapLegacyStatus, getSourceLabel, getStatusLabel, getStatusColor, type DataStatus, type DataLocale } from "./data-status";

// Central fail-closed market truth.
//
// All UI components that render any actionable trading metric (target, stop,
// riskReward, Kelly, probability, LONG/SHORT direction, "değerlendirme yapıldı",
// any "Canlı" claim) MUST gate on the flags returned here. Local string
// guessing, timestamp-only live decisions, and fallback metric production are
// forbidden — see fix/live-data-truth-mobile-shell discipline.

export type ActionabilityLevel = "actionable" | "informational" | "blocked";

export type MarketTruth = {
  symbol: string;
  canonicalSymbol: string;
  price: number | null;
  dataStatus: DataStatus;
  dataStatusLabel: string;
  dataStatusColor: string;
  sourceLabel: string;
  provider: string;
  updatedAt: string | null;
  ttlMs: number | null;
  stale: boolean;
  timeframe: string | null;
  candlesAvailable: number;
  ohlcvStatus: string | null;
  analysisAllowed: boolean;
  actionability: ActionabilityLevel;
  reason: string | null;
  canShowTarget: boolean;
  canShowStop: boolean;
  canShowRiskReward: boolean;
  canShowKelly: boolean;
  canShowProbability: boolean;
  canShowTradePlan: boolean;
  canShowDirectionChip: boolean;
  canShowFundamentalAnalysis: boolean;
  canShowTechnicalAnalysis: boolean;
};

export type BuildMarketTruthInput = {
  symbol: string;
  canonicalSymbol?: string | null;
  price?: number | null;
  source?: string | null;
  provider?: string | null;
  dataStatus?: DataStatus | string | null;
  updatedAt?: string | null;
  timeframe?: string | null;
  candlesAvailable?: number | null;
  ohlcvStatus?: string | null;
  hasTarget?: boolean;
  hasStop?: boolean;
  hasRiskReward?: boolean;
  sourceMismatch?: boolean;
  bistRealtimeLicensed?: boolean;
  locale?: DataLocale;
};

// TTL ceilings per status. live = 5 minutes; delayed/ayc_data = 15 minutes.
// Anything past TTL is stale and downgrades analysisAllowed to false.
const TTL_BY_STATUS: Record<DataStatus, number | null> = {
  live: 5 * 60_000,
  delayed: 15 * 60_000,
  ayc_data: 15 * 60_000,
  insufficient: null,
  no_data: null,
  demo: null,
};

// Minimum candle count required for analysis. Matches analysis route's
// hasEnoughData = candles.length >= 15.
const MIN_CANDLES_FOR_ANALYSIS = 15;

function resolveStale(status: DataStatus, updatedAt: string | null, ttlMs: number | null): boolean {
  if (!updatedAt) return status === "live" || status === "delayed" || status === "ayc_data";
  if (ttlMs === null) return false;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > ttlMs;
}

function decideReason(args: {
  status: DataStatus;
  price: number | null;
  candlesAvailable: number;
  stale: boolean;
  sourceMismatch: boolean;
}): string | null {
  if (args.sourceMismatch) return "SOURCE_MISMATCH";
  if (args.price === null) return "NO_PRICE";
  if (args.status === "no_data") return "NO_DATA";
  if (args.status === "insufficient") return "INSUFFICIENT_DATA";
  if (args.status === "demo") return "DEMO_DATA";
  if (args.status === "ayc_data") return "AYC_FALLBACK_DATA";
  if (args.stale) return "STALE_DATA";
  if (args.candlesAvailable < MIN_CANDLES_FOR_ANALYSIS) return "INSUFFICIENT_CANDLES";
  return null;
}

export function buildMarketTruth(input: BuildMarketTruthInput): MarketTruth {
  const canonicalSymbol = (input.canonicalSymbol || input.symbol || "").toUpperCase();
  const rawStatus = (typeof input.dataStatus === "string" ? input.dataStatus : null) || "no_data";
  const dataStatus: DataStatus = mapLegacyStatus(rawStatus);
  const price = typeof input.price === "number" && Number.isFinite(input.price) && input.price > 0 ? input.price : null;
  const updatedAt = input.updatedAt || null;
  const ttlMs = TTL_BY_STATUS[dataStatus] ?? null;
  const stale = resolveStale(dataStatus, updatedAt, ttlMs);
  const candlesAvailable = Math.max(0, Number(input.candlesAvailable ?? 0) | 0);
  const sourceMismatch = Boolean(input.sourceMismatch);
  const locale: DataLocale = input.locale === "en" ? "en" : "tr";
  const source = String(input.source || input.provider || "UNAVAILABLE");
  const sourceLabel = price === null ? "—" : getSourceLabel(source, locale);
  const provider = String(input.provider || input.source || "UNAVAILABLE").toUpperCase();

  const reason = decideReason({ status: dataStatus, price, candlesAvailable, stale, sourceMismatch });

  // analysisAllowed is the SINGLE source of truth for whether actionable
  // trading metrics may render. Fail-closed: any reason set => false.
  const baseAllowed =
    reason === null &&
    (dataStatus === "live" || dataStatus === "delayed") &&
    price !== null &&
    !stale &&
    candlesAvailable >= MIN_CANDLES_FOR_ANALYSIS &&
    !sourceMismatch;

  const analysisAllowed = baseAllowed;

  // canShowTradePlan additionally requires concrete target + stop produced
  // by the deterministic math core (caller passes hasTarget/hasStop).
  const canShowTradePlan = analysisAllowed && Boolean(input.hasTarget) && Boolean(input.hasStop);

  const actionability: ActionabilityLevel = canShowTradePlan
    ? "actionable"
    : price !== null && !sourceMismatch
      ? "informational"
      : "blocked";

  return {
    symbol: input.symbol,
    canonicalSymbol,
    price,
    dataStatus,
    dataStatusLabel: getStatusLabel(dataStatus, locale),
    dataStatusColor: getStatusColor(dataStatus),
    sourceLabel,
    provider,
    updatedAt,
    ttlMs,
    stale,
    timeframe: input.timeframe || null,
    candlesAvailable,
    ohlcvStatus: input.ohlcvStatus || null,
    analysisAllowed,
    actionability,
    reason,
    canShowTarget:               canShowTradePlan && Boolean(input.hasTarget),
    canShowStop:                 canShowTradePlan && Boolean(input.hasStop),
    canShowRiskReward:           canShowTradePlan && Boolean(input.hasRiskReward ?? (input.hasTarget && input.hasStop)),
    canShowKelly:                canShowTradePlan,
    canShowProbability:          canShowTradePlan,
    canShowTradePlan,
    canShowDirectionChip:        analysisAllowed,
    canShowFundamentalAnalysis:  analysisAllowed,
    canShowTechnicalAnalysis:    analysisAllowed,
  };
}

// blockedMarketTruth — pure fail-closed sentinel for use when no input is
// available yet (still loading, etc.). All canShow* flags = false.
export function blockedMarketTruth(symbol: string, locale: DataLocale = "tr"): MarketTruth {
  return buildMarketTruth({
    symbol,
    dataStatus: "no_data",
    price: null,
    candlesAvailable: 0,
    locale,
  });
}

// Safe message helpers — used by UI in place of unsafe API strings.
export function fundamentalUnavailableMessage(locale: DataLocale = "tr"): string {
  return locale === "en" ? "No reliable data for fundamental analysis." : "Temel analiz için güvenilir veri yok.";
}
export function technicalUnavailableMessage(locale: DataLocale = "tr"): string {
  return locale === "en" ? "Insufficient data for technical analysis." : "Teknik analiz için veri yetersiz.";
}
export function analysisUnavailableMessage(locale: DataLocale = "tr"): string {
  return locale === "en"
    ? "Analysis cannot be produced without sufficient reliable data."
    : "Yeterli güvenilir veri olmadığı için analiz üretilemedi.";
}
