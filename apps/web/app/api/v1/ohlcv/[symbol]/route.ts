import { NextRequest, NextResponse } from "next/server";
import { getAssetBySymbol } from "@/lib/markets/asset-universe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY || "";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "";
const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY || "";

type Timeframe = "5M" | "15M" | "1H" | "4H" | "1D" | "1W" | "1M" | "3M" | "1Y";
type ProviderName =
  | "binance"
  | "coingecko"
  | "yahoo"
  | "twelvedata"
  | "finnhub"
  | "stooq"
  | "alphavantage";

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface ProviderAttempt {
  provider: ProviderName;
  symbol: string;
  status: "success" | "error";
  detail?: string;
}

const SYMBOL_ALIASES: Record<string, string> = {
  GARAN: "GARAN.IS",
  THYAO: "THYAO.IS",
  ASELS: "ASELS.IS",
  AKBNK: "AKBNK.IS",
  EREGL: "EREGL.IS",
  XAU: "XAUUSD",
  XAG: "XAGUSD",
  WTI: "WTIUSD",
  SP500: "SPX",
  BIST100: "XU100",
};

function normalizeTimeframe(raw: string | null): Timeframe {
  const value = (raw || "1D").trim().toUpperCase();
  if (value === "5M") return "5M";
  if (value === "15M") return "15M";
  if (value === "1H") return "1H";
  if (value === "4H") return "4H";
  if (value === "1W") return "1W";
  if (value === "1M") return "1M";
  if (value === "3M") return "3M";
  if (value === "1Y") return "1Y";
  return "1D";
}

function normalizeIncomingSymbol(raw: string): string {
  const upper = decodeURIComponent(raw).trim().toUpperCase();
  const compact = upper.replace(/\s+/g, "").replace(/-/g, "");
  return SYMBOL_ALIASES[compact] || compact;
}

function mapBinanceInterval(tf: Timeframe): string {
  const map: Record<Timeframe, string> = {
    "5M": "5m",
    "15M": "15m",
    "1H": "1h",
    "4H": "4h",
    "1D": "1d",
    "1W": "1w",
    "1M": "1d",
    "3M": "1d",
    "1Y": "1w",
  };
  return map[tf];
}

function mapBinanceLimit(tf: Timeframe): number {
  const map: Record<Timeframe, number> = {
    "5M": 300,
    "15M": 300,
    "1H": 336,
    "4H": 240,
    "1D": 180,
    "1W": 104,
    "1M": 180,
    "3M": 240,
    "1Y": 260,
  };
  return map[tf];
}

function mapYahooRange(tf: Timeframe): string {
  const map: Record<Timeframe, string> = {
    "5M": "1d",
    "15M": "5d",
    "1H": "5d",
    "4H": "1mo",
    "1D": "6mo",
    "1W": "2y",
    "1M": "1y",
    "3M": "5y",
    "1Y": "5y",
  };
  return map[tf];
}

function mapYahooInterval(tf: Timeframe): string {
  const map: Record<Timeframe, string> = {
    "5M": "5m",
    "15M": "15m",
    "1H": "60m",
    "4H": "60m",
    "1D": "1d",
    "1W": "1wk",
    "1M": "1d",
    "3M": "1wk",
    "1Y": "1wk",
  };
  return map[tf];
}

function mapTwelveDataInterval(tf: Timeframe): string {
  const map: Record<Timeframe, string> = {
    "5M": "5min",
    "15M": "15min",
    "1H": "1h",
    "4H": "4h",
    "1D": "1day",
    "1W": "1week",
    "1M": "1month",
    "3M": "1month",
    "1Y": "1month",
  };
  return map[tf];
}

function mapTwelveDataOutputSize(tf: Timeframe): number {
  const map: Record<Timeframe, number> = {
    "5M": 300,
    "15M": 300,
    "1H": 300,
    "4H": 300,
    "1D": 365,
    "1W": 260,
    "1M": 180,
    "3M": 180,
    "1Y": 260,
  };
  return map[tf];
}

function mapFinnhubResolution(tf: Timeframe): string {
  const map: Record<Timeframe, string> = {
    "5M": "5",
    "15M": "15",
    "1H": "60",
    "4H": "240",
    "1D": "D",
    "1W": "W",
    "1M": "D",
    "3M": "W",
    "1Y": "W",
  };
  return map[tf];
}

function mapStooqLimit(tf: Timeframe): number {
  const map: Record<Timeframe, number> = {
    "5M": 120,
    "15M": 120,
    "1H": 180,
    "4H": 240,
    "1D": 365,
    "1W": 260,
    "1M": 180,
    "3M": 260,
    "1Y": 260,
  };
  return map[tf];
}

function normalizeCandleShape(candle: Candle): boolean {
  const { o, h, l, c, t } = candle;
  if (!(t > 0 && o > 0 && h > 0 && l > 0 && c > 0)) return false;
  if (h < Math.max(o, c, l)) return false;
  if (l > Math.min(o, c, h)) return false;
  return true;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function cleanCandles(candles: Candle[], tf: Timeframe): {
  cleaned: Candle[];
  invalidDropped: number;
  outlierDropped: number;
} {
  const sorted = candles.slice().sort((a, b) => a.t - b.t);
  const valid = sorted.filter(normalizeCandleShape);
  const invalidDropped = sorted.length - valid.length;
  if (!valid.length) return { cleaned: [], invalidDropped, outlierDropped: 0 };

  const medClose = median(valid.map((c) => c.c));
  if (medClose <= 0) {
    return { cleaned: valid, invalidDropped, outlierDropped: 0 };
  }

  const highFactor = tf === "1Y" || tf === "3M" ? 1.8 : 1.35;
  const lowFactor = tf === "1Y" || tf === "3M" ? 0.55 : 0.65;
  const outlierFiltered = valid.filter((c) => c.h <= medClose * highFactor && c.l >= medClose * lowFactor);

  const cleaned = outlierFiltered.length >= Math.max(10, Math.floor(valid.length * 0.3))
    ? outlierFiltered
    : valid;

  return {
    cleaned,
    invalidDropped,
    outlierDropped: valid.length - cleaned.length,
  };
}

async function sfetch(url: string, timeout = 10000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AYCMarket/3.0",
      },
      cache: "no-store",
    });
    clearTimeout(timer);
    return response;
  } catch {
    return null;
  }
}

async function fetchBinance(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const normalized = symbol.toUpperCase().replace("/", "");
  const binanceSymbol = normalized.endsWith("USDT") ? normalized : `${normalized}USDT`;
  const response = await sfetch(
    `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${mapBinanceInterval(tf)}&limit=${mapBinanceLimit(tf)}`,
    9000,
  );
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
  const raw = await response.json();
  if (!Array.isArray(raw) || !raw.length) throw new Error("empty");
  return raw.map((row: [number, string, string, string, string, string]) => ({
    t: Number(row[0]),
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: Number(row[5]),
  }));
}

async function fetchCoinGecko(coinId: string, tf: Timeframe): Promise<Candle[]> {
  const days =
    tf === "5M" || tf === "15M" || tf === "1H"
      ? 1
      : tf === "4H"
        ? 7
        : tf === "1D"
          ? 90
          : tf === "1W"
            ? 365
            : tf === "1M"
              ? 365
              : 365;
  const headers: Record<string, string> = {};
  if (COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = COINGECKO_API_KEY;
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
    {
      headers: { Accept: "application/json", "User-Agent": "AYCMarket/3.0", ...headers },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    },
  ).catch(() => null);
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
  const raw = await response.json();
  if (!Array.isArray(raw) || !raw.length) throw new Error("empty");
  return raw.map((row: [number, number, number, number, number]) => ({
    t: Number(row[0]),
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: 0,
  }));
}

async function fetchYahoo(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const response = await sfetch(
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${mapYahooInterval(tf)}&range=${mapYahooRange(tf)}&includePrePost=false`,
    11000,
  );
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp as number[] | undefined;
  const quote = result?.indicators?.quote?.[0];
  if (!timestamps?.length || !quote) throw new Error("empty");
  return timestamps.map((timestamp, idx) => ({
    t: Number(timestamp) * 1000,
    o: Number(quote.open?.[idx] || 0),
    h: Number(quote.high?.[idx] || 0),
    l: Number(quote.low?.[idx] || 0),
    c: Number(quote.close?.[idx] || 0),
    v: Number(quote.volume?.[idx] || 0),
  }));
}

async function fetchTwelveData(symbol: string, tf: Timeframe): Promise<Candle[]> {
  if (!TWELVEDATA_API_KEY) throw new Error("missing-api-key");
  const response = await sfetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${mapTwelveDataInterval(tf)}&outputsize=${mapTwelveDataOutputSize(tf)}&apikey=${TWELVEDATA_API_KEY}&format=JSON`,
    11000,
  );
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
  const json = await response.json();
  if (json?.status === "error") throw new Error(json?.message || "provider-error");
  const values = json?.values;
  if (!Array.isArray(values) || !values.length) throw new Error("empty");
  return values
    .map((row: Record<string, string>) => ({
      t: new Date(row.datetime).getTime(),
      o: Number(row.open),
      h: Number(row.high),
      l: Number(row.low),
      c: Number(row.close),
      v: Number(row.volume || 0),
    }))
    .filter((row) => Number.isFinite(row.t));
}

async function fetchFinnhub(symbol: string, tf: Timeframe): Promise<Candle[]> {
  if (!FINNHUB_API_KEY) throw new Error("missing-api-key");
  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24 * 365 * 5;
  const resolution = mapFinnhubResolution(tf);
  const response = await sfetch(
    `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`,
    11000,
  );
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
  const json = await response.json();
  if (json?.s !== "ok") throw new Error(json?.s || "empty");
  const t = json?.t as number[];
  const o = json?.o as number[];
  const h = json?.h as number[];
  const l = json?.l as number[];
  const c = json?.c as number[];
  const v = json?.v as number[];
  if (!Array.isArray(t) || !t.length) throw new Error("empty");
  return t.map((ts, idx) => ({
    t: Number(ts) * 1000,
    o: Number(o?.[idx] || 0),
    h: Number(h?.[idx] || 0),
    l: Number(l?.[idx] || 0),
    c: Number(c?.[idx] || 0),
    v: Number(v?.[idx] || 0),
  }));
}

async function fetchStooq(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const normalized = symbol.toLowerCase().replace("/", "");
  const response = await sfetch(`https://stooq.com/q/d/l/?s=${normalized}&i=d`, 10000);
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
  const csv = await response.text();
  const rows = csv.split("\n").slice(1).filter(Boolean);
  if (!rows.length) throw new Error("empty");
  const limit = mapStooqLimit(tf);
  return rows.slice(-limit).map((line) => {
    const [date, open, high, low, close, volume] = line.split(",");
    return {
      t: new Date(date).getTime(),
      o: Number(open),
      h: Number(high),
      l: Number(low),
      c: Number(close),
      v: Number(volume || 0),
    };
  });
}

async function fetchAlphaVantage(symbol: string, tf: Timeframe): Promise<Candle[]> {
  if (!ALPHAVANTAGE_API_KEY) throw new Error("missing-api-key");
  const normalized = symbol.toUpperCase().replace("/", "");
  const isForex = /^[A-Z]{6}$/.test(normalized);
  const url = isForex
    ? `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${normalized.slice(0, 3)}&to_symbol=${normalized.slice(3, 6)}&outputsize=compact&apikey=${ALPHAVANTAGE_API_KEY}`
    : `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${ALPHAVANTAGE_API_KEY}`;

  const response = await sfetch(url, 11000);
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
  const json = await response.json();
  const key = Object.keys(json).find((candidate) => candidate.includes("Time Series") || candidate.includes("FX"));
  if (!key) throw new Error("empty");
  const series = json[key] as Record<string, Record<string, string>>;
  const all = Object.entries(series)
    .map(([date, values]) => ({
      t: new Date(date).getTime(),
      o: Number(values["1. open"]),
      h: Number(values["2. high"]),
      l: Number(values["3. low"]),
      c: Number(values["4. close"]),
      v: Number(values["5. volume"] || 0),
    }))
    .sort((a, b) => a.t - b.t);
  const limit = mapStooqLimit(tf);
  return all.slice(-limit);
}

async function attemptProvider(
  attempts: ProviderAttempt[],
  provider: ProviderName,
  symbol: string,
  loader: () => Promise<Candle[]>,
): Promise<Candle[] | null> {
  try {
    const candles = await loader();
    if (!candles.length) {
      attempts.push({ provider, symbol, status: "error", detail: "empty" });
      return null;
    }
    attempts.push({ provider, symbol, status: "success" });
    return candles;
  } catch (error) {
    attempts.push({
      provider,
      symbol,
      status: "error",
      detail: error instanceof Error ? error.message : "provider-error",
    });
    return null;
  }
}

function isCryptoSymbol(symbol: string): boolean {
  return /USDT$/.test(symbol) || /BTC|ETH|SOL|BNB|XRP|DOGE|ADA|AVAX|PEPE|SHIB/.test(symbol);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } },
) {
  const requestedSymbol = decodeURIComponent(params.symbol || "").trim();
  const tf = normalizeTimeframe(req.nextUrl.searchParams.get("tf"));
  const normalizedRequest = normalizeIncomingSymbol(requestedSymbol);
  const resolvedAsset = getAssetBySymbol(normalizedRequest) || getAssetBySymbol(requestedSymbol);
  const canonicalSymbol = resolvedAsset?.symbol || normalizedRequest;
  const category = resolvedAsset?.category || "unknown";

  const attempts: ProviderAttempt[] = [];
  let selectedProvider: ProviderName | null = null;
  let selectedProviderSymbol = canonicalSymbol;
  let candles: Candle[] = [];

  const runProvider = async (
    provider: ProviderName,
    providerSymbol: string,
    loader: () => Promise<Candle[]>,
  ) => {
    if (candles.length) return;
    const result = await attemptProvider(attempts, provider, providerSymbol, loader);
    if (result?.length) {
      selectedProvider = provider;
      selectedProviderSymbol = providerSymbol;
      candles = result;
    }
  };

  const providerSymbols = resolvedAsset?.providerSymbols || {};
  const defaultBinanceSymbol = canonicalSymbol.replace("/", "");
  const defaultStooqSymbol = canonicalSymbol.toLowerCase().replace("/", "");
  const defaultTwelveSymbol = canonicalSymbol.includes("/")
    ? canonicalSymbol
    : canonicalSymbol.length === 6
      ? `${canonicalSymbol.slice(0, 3)}/${canonicalSymbol.slice(3, 6)}`
      : canonicalSymbol;

  if (category === "crypto" || isCryptoSymbol(canonicalSymbol)) {
    await runProvider(
      "binance",
      providerSymbols.binance || defaultBinanceSymbol,
      () => fetchBinance(providerSymbols.binance || defaultBinanceSymbol, tf),
    );
    if (providerSymbols.coingecko) {
      await runProvider(
        "coingecko",
        providerSymbols.coingecko,
        () => fetchCoinGecko(providerSymbols.coingecko as string, tf),
      );
    }
    await runProvider(
      "twelvedata",
      providerSymbols.twelvedata || defaultBinanceSymbol,
      () => fetchTwelveData(providerSymbols.twelvedata || defaultBinanceSymbol, tf),
    );
  } else if (category === "forex") {
    await runProvider(
      "twelvedata",
      providerSymbols.twelvedata || defaultTwelveSymbol,
      () => fetchTwelveData(providerSymbols.twelvedata || defaultTwelveSymbol, tf),
    );
    await runProvider(
      "stooq",
      providerSymbols.stooq || defaultStooqSymbol,
      () => fetchStooq(providerSymbols.stooq || defaultStooqSymbol, tf),
    );
    await runProvider(
      "alphavantage",
      providerSymbols.alphavantage || canonicalSymbol,
      () => fetchAlphaVantage(providerSymbols.alphavantage || canonicalSymbol, tf),
    );
    await runProvider(
      "yahoo",
      providerSymbols.yahoo || canonicalSymbol,
      () => fetchYahoo(providerSymbols.yahoo || canonicalSymbol, tf),
    );
  } else if (category === "precious" || category === "energy" || category === "commodity") {
    await runProvider(
      "stooq",
      providerSymbols.stooq || defaultStooqSymbol,
      () => fetchStooq(providerSymbols.stooq || defaultStooqSymbol, tf),
    );
    await runProvider(
      "yahoo",
      providerSymbols.yahoo || canonicalSymbol,
      () => fetchYahoo(providerSymbols.yahoo || canonicalSymbol, tf),
    );
    await runProvider(
      "twelvedata",
      providerSymbols.twelvedata || canonicalSymbol,
      () => fetchTwelveData(providerSymbols.twelvedata || canonicalSymbol, tf),
    );
    await runProvider(
      "alphavantage",
      providerSymbols.alphavantage || canonicalSymbol,
      () => fetchAlphaVantage(providerSymbols.alphavantage || canonicalSymbol, tf),
    );
  } else {
    await runProvider(
      "yahoo",
      providerSymbols.yahoo || canonicalSymbol,
      () => fetchYahoo(providerSymbols.yahoo || canonicalSymbol, tf),
    );
    await runProvider(
      "finnhub",
      providerSymbols.finnhub || canonicalSymbol,
      () => fetchFinnhub(providerSymbols.finnhub || canonicalSymbol, tf),
    );
    await runProvider(
      "twelvedata",
      providerSymbols.twelvedata || canonicalSymbol,
      () => fetchTwelveData(providerSymbols.twelvedata || canonicalSymbol, tf),
    );
    await runProvider(
      "alphavantage",
      providerSymbols.alphavantage || canonicalSymbol,
      () => fetchAlphaVantage(providerSymbols.alphavantage || canonicalSymbol, tf),
    );
    await runProvider(
      "stooq",
      providerSymbols.stooq || defaultStooqSymbol,
      () => fetchStooq(providerSymbols.stooq || defaultStooqSymbol, tf),
    );
  }

  const { cleaned, invalidDropped, outlierDropped } = cleanCandles(candles, tf);

  if (!cleaned.length) {
    return NextResponse.json(
      {
        ok: false,
        reason: "NO_DATA",
        requestedSymbol,
        canonicalSymbol,
        tf,
        provider: selectedProvider,
        providerSymbol: selectedProviderSymbol,
        providerAttempts: attempts,
        candles: [],
        count: 0,
      },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      requestedSymbol,
      canonicalSymbol,
      symbol: canonicalSymbol,
      tf,
      provider: selectedProvider,
      providerSymbol: selectedProviderSymbol,
      providerAttempts: attempts,
      candles: cleaned,
      count: cleaned.length,
      category,
      cleanedMeta: {
        invalidDropped,
        outlierDropped,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
      },
    },
  );
}
