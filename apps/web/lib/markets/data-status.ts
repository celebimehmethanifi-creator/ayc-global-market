import type { AssetCategory } from "./asset-universe";

export type DataStatus =
  | "live"
  | "delayed"
  | "fallback"
  | "no_data"
  | "no_volume"
  | "license_required"
  | "api_error";

export type DataLocale = "tr" | "en";

export type DataStatusMeta = {
  source: string;
  sourceLabel: string;
  dataStatus: DataStatus;
  dataStatusLabel: string;
  delayMinutes: number | null;
  updatedAt: string | null;
  hasVolume: boolean;
  volumeStatus: DataStatus;
  volumeStatusLabel: string;
  provider: string;
};

const SOURCE_LABELS_TR: Record<string, string> = {
  "BINANCE-WS": "Binance Canlı",
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
  "ER-API": "API bağlantısı yok",
  "ER-APİ": "API bağlantısı yok",
  NO_DATA: "Veri yok",
};

const SOURCE_LABELS_EN: Record<string, string> = {
  "BINANCE-WS": "Binance Live",
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
  "ER-API": "API unavailable",
  "ER-APİ": "API unavailable",
  NO_DATA: "No data",
};

const STATUS_LABELS_TR: Record<DataStatus, string> = {
  live: "Canlı",
  delayed: "Gecikmeli",
  fallback: "Fallback",
  no_data: "Veri yok",
  no_volume: "Hacim yok",
  license_required: "Lisans gerekli",
  api_error: "API bağlantısı yok",
};

const STATUS_LABELS_EN: Record<DataStatus, string> = {
  live: "Live",
  delayed: "Delayed",
  fallback: "Fallback",
  no_data: "No data",
  no_volume: "No volume",
  license_required: "License required",
  api_error: "API unavailable",
};

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

function resolveDelayMinutes(updatedAt?: string | null): number | null {
  if (!updatedAt) return null;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

function inferBaseStatus(source: string, hasPrice: boolean, delayMinutes: number | null): DataStatus {
  if (!hasPrice) return "no_data";
  if (source === "UNAVAILABLE" || source === "NO_DATA") return "no_data";
  if (source === "ER-API" || source === "ER-APİ") return "api_error";
  if (source === "BINANCE-WS") return "live";
  if (source === "BINANCE") return delayMinutes != null && delayMinutes > 2 ? "delayed" : "live";
  if (source === "FINNHUB" || source === "YAHOO" || source === "BACKEND") return "delayed";
  return "fallback";
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
    else if (!args.hasVolume) dataStatus = "license_required";
    else dataStatus = "delayed";
  }

  if (dataStatus === "live" && delayMinutes != null && delayMinutes >= 5) {
    dataStatus = "delayed";
  }

  let volumeStatus: DataStatus = args.hasVolume ? "live" : "no_volume";
  if (!args.hasPrice) volumeStatus = "no_data";
  if (category === "bist" && !args.hasVolume && !bistRealtimeLicensed) {
    volumeStatus = "license_required";
  }
  if (dataStatus === "api_error") volumeStatus = "api_error";

  // When there is no actual price data, do not surface a misleading provider label.
  const finalSourceLabel = args.hasPrice
    ? getSourceLabel(source, locale)
    : "—";
  const finalUpdatedAt = args.hasPrice ? (args.updatedAt || null) : null;

  return {
    source,
    sourceLabel: finalSourceLabel,
    dataStatus,
    dataStatusLabel: getStatusLabel(dataStatus, locale),
    delayMinutes,
    updatedAt: finalUpdatedAt,
    hasVolume: args.hasVolume,
    volumeStatus,
    volumeStatusLabel: getStatusLabel(volumeStatus, locale),
    provider: source,
  };
}
