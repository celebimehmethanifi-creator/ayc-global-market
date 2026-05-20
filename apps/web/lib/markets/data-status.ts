import type { AssetCategory } from "./asset-universe";

// Canonical 6-value status set.
// Callers must never compare against old values (fallback/no_volume/license_required/api_error).
// Use mapLegacyStatus() to normalize API responses that still use old values.
export type DataStatus =
  | "live"        // Canlı         — real-time, valid TTL confirmed
  | "delayed"     // Gecikmeli     — real price, no streaming or TTL unverified
  | "ayc_data"    // AYC Veri      — from AYC backend aggregation layer
  | "no_data"     // Veri yok      — no price available
  | "insufficient"// Veri yetersiz — price present but context incomplete
  | "demo";       // Demo          — seeded / synthetic data

export type DataLocale = "tr" | "en";

export type DataStatusMeta = {
  source: string;
  sourceLabel: string;
  dataStatus: DataStatus;
  dataStatusLabel: string;
  dataStatusColor: string;
  delayMinutes: number | null;
  updatedAt: string | null;
  hasVolume: boolean;
  volumeStatus: DataStatus;
  volumeStatusLabel: string;
  provider: string;
  isLive: boolean;
  isDelayed: boolean;
  isDemo: boolean;
  isFallback: boolean;
  isStale: boolean;
  confidence: "high" | "medium" | "low" | "none";
};

const SOURCE_LABELS_TR: Record<string, string> = {
  "BINANCE-WS": "Binance WS",
  BINANCE: "Binance",
  COINGECKO: "CoinGecko",
  FINNHUB: "Finnhub",
  YAHOO: "Yahoo",
  TWELVEDATA: "TwelveData",
  STOOQ: "Stooq",
  ALPHAVANTAGE: "AlphaVantage",
  FRANKFURTER: "Frankfurter",
  BACKEND: "AYC Veri",
  UNAVAILABLE: "Veri yok",
  "ER-API": "Veri yok",
  "ER-APİ": "Veri yok",
  NO_DATA: "Veri yok",
};

const SOURCE_LABELS_EN: Record<string, string> = {
  "BINANCE-WS": "Binance Stream",
  BINANCE: "Binance",
  COINGECKO: "CoinGecko",
  FINNHUB: "Finnhub",
  YAHOO: "Yahoo",
  TWELVEDATA: "TwelveData",
  STOOQ: "Stooq",
  ALPHAVANTAGE: "AlphaVantage",
  FRANKFURTER: "Frankfurter",
  BACKEND: "AYC Data",
  UNAVAILABLE: "No data",
  "ER-API": "No data",
  "ER-APİ": "No data",
  NO_DATA: "No data",
};

const STATUS_LABELS_TR: Record<DataStatus, string> = {
  live:        "Canlı",
  delayed:     "Gecikmeli",
  ayc_data:    "AYC Veri",
  no_data:     "Veri yok",
  insufficient:"Veri yetersiz",
  demo:        "Demo",
};

const STATUS_LABELS_EN: Record<DataStatus, string> = {
  live:        "Live",
  delayed:     "Delayed",
  ayc_data:    "AYC Data",
  no_data:     "No data",
  insufficient:"Insufficient",
  demo:        "Demo",
};

const STATUS_COLORS: Record<DataStatus, string> = {
  live:        "var(--up)",
  delayed:     "var(--warn)",
  ayc_data:    "var(--info)",
  no_data:     "var(--t3)",
  insufficient:"var(--down)",
  demo:        "var(--t4)",
};

// mapLegacyStatus normalizes values from backend APIs that still use old status strings.
export function mapLegacyStatus(value: string | null | undefined): DataStatus {
  if (!value) return "no_data";
  switch (value) {
    case "live":             return "live";
    case "delayed":          return "delayed";
    case "fallback":         return "insufficient"; // fallback calc ≠ real delayed market data
    case "ayc_data":         return "ayc_data";
    case "no_data":          return "no_data";
    case "api_error":        return "no_data";
    case "no_volume":        return "insufficient";
    case "license_required": return "insufficient";
    case "insufficient":     return "insufficient";
    case "demo":             return "demo";
    default:                 return "no_data";
  }
}

function normalizeSource(source: string): string {
  const normalized = String(source || "")
    .trim()
    .toUpperCase()
    .replace(/_/g, "-");
  if (!normalized || normalized === "NONE" || normalized === "NULL") return "UNAVAILABLE";
  if (normalized === "NO-PROVIDER" || normalized === "MISSING") return "ER-API";
  return normalized;
}

export function getSourceLabel(source: string, locale: DataLocale = "tr"): string {
  const normalized = normalizeSource(source);
  const dict = locale === "en" ? SOURCE_LABELS_EN : SOURCE_LABELS_TR;
  return dict[normalized] || normalized;
}

export function getStatusLabel(status: DataStatus, locale: DataLocale = "tr"): string {
  return locale === "en" ? STATUS_LABELS_EN[status] : STATUS_LABELS_TR[status];
}

export function getStatusColor(status: DataStatus): string {
  return STATUS_COLORS[status] ?? "var(--t3)";
}

function resolveDelayMinutes(updatedAt?: string | null): number | null {
  if (!updatedAt) return null;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

// inferBaseStatus — internal. Requires delayMinutes !== null to claim "live".
function inferBaseStatus(
  source: string,
  hasPrice: boolean,
  delayMinutes: number | null,
): DataStatus {
  if (!hasPrice) return "no_data";
  if (source === "UNAVAILABLE" || source === "NO_DATA") return "no_data";
  if (source === "ER-API" || source === "ER-APİ") return "no_data";
  if (source === "BACKEND") return "ayc_data";

  // Binance WebSocket: live only when TTL is confirmed (delayMinutes not null) and fresh.
  if (source === "BINANCE-WS") {
    if (delayMinutes === null) return "delayed"; // TTL unverifiable
    return delayMinutes < 5 ? "live" : "delayed";
  }
  // Binance REST: live only when TTL confirmed and within 2 minutes.
  if (source === "BINANCE") {
    if (delayMinutes === null) return "delayed"; // TTL unverifiable — do not claim live
    return delayMinutes <= 2 ? "live" : "delayed";
  }

  if (source === "FINNHUB" || source === "YAHOO") return "delayed";
  return "delayed"; // all unknown third-party sources: delayed, not fallback
}

export function buildDataStatusMeta(args: {
  source?: string | null;
  provider?: string | null;
  category?: AssetCategory | "unknown";
  updatedAt?: string | null;
  hasPrice: boolean;
  hasVolume: boolean;
  locale?: DataLocale;
  bistRealtimeLicensed?: boolean;
}): DataStatusMeta {
  const source = normalizeSource(args.source || args.provider || "UNAVAILABLE");
  const locale = args.locale || "tr";
  const delayMinutes = resolveDelayMinutes(args.updatedAt || null);
  const category = args.category || "unknown";
  const bistRealtimeLicensed = Boolean(args.bistRealtimeLicensed);

  let dataStatus = inferBaseStatus(source, args.hasPrice, delayMinutes);

  if (category === "bist" && !bistRealtimeLicensed) {
    if (!args.hasPrice) dataStatus = "no_data";
    else dataStatus = "insufficient";
  }

  // Additional stale guard: anything claiming live with delay >= 5 min becomes delayed.
  if (dataStatus === "live" && delayMinutes !== null && delayMinutes >= 5) {
    dataStatus = "delayed";
  }

  let volumeStatus: DataStatus = args.hasVolume ? "live" : "insufficient";
  if (!args.hasPrice) volumeStatus = "no_data";
  if (category === "bist" && !args.hasVolume && !bistRealtimeLicensed) {
    volumeStatus = "insufficient";
  }
  if (dataStatus === "no_data") volumeStatus = "no_data";

  const finalSourceLabel = args.hasPrice ? getSourceLabel(source, locale) : "—";
  const finalUpdatedAt = args.hasPrice ? (args.updatedAt || null) : null;

  const isLive = dataStatus === "live";
  const isDelayed = dataStatus === "delayed" || dataStatus === "ayc_data";
  const isFallback = dataStatus === "insufficient";
  const isStale = delayMinutes !== null && delayMinutes >= 15;
  const isDemo = dataStatus === "no_data" || dataStatus === "demo" || !args.hasPrice;

  const confidence: DataStatusMeta["confidence"] =
    isLive && !isStale ? "high"
    : isDelayed && !isStale ? "medium"
    : isFallback || isStale ? "low"
    : "none";

  return {
    source,
    sourceLabel: finalSourceLabel,
    dataStatus,
    dataStatusLabel: getStatusLabel(dataStatus, locale),
    dataStatusColor: getStatusColor(dataStatus),
    delayMinutes,
    updatedAt: finalUpdatedAt,
    hasVolume: args.hasVolume,
    volumeStatus,
    volumeStatusLabel: getStatusLabel(volumeStatus, locale),
    provider: source,
    isLive,
    isDelayed,
    isDemo,
    isFallback,
    isStale,
    confidence,
  };
}
