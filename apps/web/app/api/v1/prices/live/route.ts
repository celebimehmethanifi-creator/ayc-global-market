import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CG_KEY = process.env.COINGECKO_API_KEY || "CG-MoxLLAjSA3r2JHXanw9fotD5";
const FH_KEY = process.env.FINNHUB_API_KEY   || "d7pp429r01qosaapdudgd7pp429r01qosaapdue0";

interface PD { price: number; chg: number; source: string; }
const safe = (v: unknown): number => { const n = Number(v); return isFinite(n) ? n : 0; };

async function sf(url: string, opts: RequestInit = {}, ms = 9000): Promise<Response | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(url, { ...opts, signal: c.signal, headers: { "Accept": "application/json", "User-Agent": "AYCMarket/2.5", ...(opts.headers as Record<string,string> || {}) } });
    clearTimeout(t);
    return r;
  } catch { return null; }
}

/* ── CRYPTO: CoinGecko ───────────────────────────────── */
const CG_IDS = "bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,cardano,avalanche-2,chainlink,polkadot,litecoin,ondo-finance,sui,aptos,pepe,injective-protocol,stellar,vechain,internet-computer,filecoin,hedera-hashgraph,algorand,floki,the-open-network,tron,optimism,arbitrum,uniswap,cosmos,near,shiba-inu";
const CG_MAP: Record<string,string> = {
  bitcoin:"BTCUSDT",ethereum:"ETHUSDT",solana:"SOLUSDT",binancecoin:"BNBUSDT",
  ripple:"XRPUSDT",dogecoin:"DOGEUSDT",cardano:"ADAUSDT","avalanche-2":"AVAXUSDT",
  chainlink:"LINKUSDT",polkadot:"DOTUSDT",litecoin:"LTCUSDT",
  "ondo-finance":"ONDOUSDT",sui:"SUIUSDT",aptos:"APTUSDT",pepe:"PEPEUSDT",
  "injective-protocol":"INJUSDT",stellar:"XLMUSDT",vechain:"VETUSDT",
  "internet-computer":"ICPUSDT",filecoin:"FILUSDT","hedera-hashgraph":"HBARUSDT",
  algorand:"ALGOUSDT",floki:"FLOKIUSDT","the-open-network":"TONUSDT",
  tron:"TRXUSDT",optimism:"OPUSDT",arbitrum:"ARBUSDT",
  uniswap:"UNIUSDT",cosmos:"ATOMUSDT",near:"NEARUSDT","shiba-inu":"SHIBUSDT",
};

async function fetchCG(): Promise<Record<string,PD>> {
  try {
    const r = await sf(
      `https://api.coingecko.com/api/v3/simple/price?ids=${CG_IDS}&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${CG_KEY}`
    );
    if (!r?.ok) return {};
    const d = await r.json();
    const out: Record<string,PD> = {};
    for (const [id, sym] of Object.entries(CG_MAP)) {
      const p = d[id];
      if (p?.usd > 0) out[sym as string] = { price: p.usd, chg: safe(p.usd_24h_change), source: "coingecko" };
    }
    return out;
  } catch { return {}; }
}

/* ── Finnhub: US Stocks ─────────────────────────────── */
const FH_STOCK_SYMS = ["AAPL","TSLA","NVDA","MSFT","AMZN","META","GOOGL","AMD","NFLX","JPM","V","WMT","BABA"];

async function fetchFinnhubStocks(): Promise<Record<string,PD>> {
  const out: Record<string,PD> = {};
  await Promise.allSettled(FH_STOCK_SYMS.map(async (sym) => {
    try {
      const r = await sf(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FH_KEY}`, {}, 6000);
      if (!r?.ok) return;
      const d = await r.json();
      if (d.c > 0) {
        const chg = d.pc > 0 ? ((d.c - d.pc) / d.pc) * 100 : 0;
        out[sym] = { price: safe(d.c), chg: safe(chg), source: "finnhub" };
      }
    } catch {}
  }));
  return out;
}

/* ── Finnhub: ETF-based indices ──────────────────────── */
// SPY = S&P 500, QQQ = Nasdaq 100, DIA = Dow Jones
const FH_ETF_MAP: [string, string][] = [
  ["SPY","SPX"], ["QQQ","NDX"], ["DIA","DJI"],
];

async function fetchIndices(): Promise<Record<string,PD>> {
  const out: Record<string,PD> = {};
  await Promise.allSettled(FH_ETF_MAP.map(async ([etf, key]) => {
    try {
      const r = await sf(`https://finnhub.io/api/v1/quote?symbol=${etf}&token=${FH_KEY}`, {}, 6000);
      if (!r?.ok) return;
      const d = await r.json();
      if (d.c > 0) {
        const chg = d.pc > 0 ? ((d.c - d.pc) / d.pc) * 100 : 0;
        out[key] = { price: safe(d.c), chg: safe(chg), source: "finnhub" };
        // Also store under ETF symbol so ticker route can use it
        out[etf] = { price: safe(d.c), chg: safe(chg), source: "finnhub" };
      }
    } catch {}
  }));
  return out;
}

/* ── open.er-api.com: Forex ──────────────────────────── */
async function fetchForex(): Promise<Record<string,PD>> {
  const out: Record<string,PD> = {};
  try {
    const r = await sf("https://open.er-api.com/v6/latest/USD", {}, 8000);
    if (!r?.ok) return out;
    const d = await r.json();
    if (!d.rates) return out;
    const rates = d.rates as Record<string,number>;
    const pairs: [string, string, boolean][] = [
      // [currency, outputKey, isInverse]
      ["EUR","EURUSD",true],  // EUR/USD = 1/rates.EUR
      ["GBP","GBPUSD",true],
      ["TRY","USDTRY",false], // USD/TRY = rates.TRY
      ["JPY","USDJPY",false],
      ["CHF","USDCHF",false],
      ["CAD","USDCAD",false],
    ];
    for (const [ccy, key, inverse] of pairs) {
      const rate = safe(rates[ccy]);
      if (rate > 0) {
        const price = inverse ? +(1/rate).toFixed(5) : +rate.toFixed(4);
        out[key] = { price, chg: 0, source: "er-api" };
      }
    }
    // EURTRY derived from EUR and TRY
    if (rates.EUR > 0 && rates.TRY > 0) {
      out["EURTRY"] = { price: +(rates.TRY / rates.EUR).toFixed(4), chg: 0, source: "er-api" };
    }
  } catch {}
  return out;
}

/* ── Stooq: metals + energy (no API key) ────────────── */
async function fetchStooq(sym: string): Promise<PD | null> {
  try {
    const r = await sf(`https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=json`, {}, 8000);
    if (!r?.ok) return null;
    const d = await r.json();
    const item = Array.isArray(d.symbols) ? d.symbols[0] : null;
    if (!item) return null;
    const close = safe(item.Close || item.close || item.Last);
    const open  = safe(item.Open  || item.open);
    if (close <= 0) return null;
    const chg = open > 0 ? ((close - open) / open) * 100 : 0;
    return { price: close, chg: safe(chg), source: "stooq" };
  } catch { return null; }
}

async function fetchCommodities(): Promise<Record<string,PD>> {
  const out: Record<string,PD> = {};
  const [gold, silver, wti, brent] = await Promise.all([
    fetchStooq("xauusd"),   // Gold
    fetchStooq("xagusd"),   // Silver
    fetchStooq("clusd"),    // WTI crude
    fetchStooq("lcousd"),   // Brent crude (London ICE)
  ]);
  if (gold)   out["XAUUSD"] = gold;
  if (silver) out["XAGUSD"] = silver;
  if (wti)    out["WTIUSD"] = wti;
  if (brent)  out["BRENT"]  = brent;
  return out;
}

/* ── ON-DEMAND ───────────────────────────────────────── */
async function fetchOnDemand(sym: string): Promise<PD | null> {
  const upper = sym.toUpperCase();
  // Try Binance for crypto
  try {
    const binSym = upper.endsWith("USDT") ? upper : upper + "USDT";
    const r = await sf(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binSym}`, {}, 4000);
    if (r?.ok) {
      const d = await r.json();
      const p = parseFloat(d.lastPrice||"0");
      if (p > 0) return { price: p, chg: safe(d.priceChangePercent), source: "binance" };
    }
  } catch {}
  // CoinGecko for crypto by id
  try {
    const id = upper.toLowerCase().replace("usdt","");
    const r = await sf(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${CG_KEY}`, {}, 5000);
    if (r?.ok) {
      const d = await r.json();
      if (d[id]?.usd > 0) return { price: d[id].usd, chg: safe(d[id].usd_24h_change), source: "coingecko" };
    }
  } catch {}
  // Finnhub for stocks
  try {
    const r = await sf(`https://finnhub.io/api/v1/quote?symbol=${upper}&token=${FH_KEY}`, {}, 4000);
    if (r?.ok) {
      const d = await r.json();
      if (d.c > 0) return { price: safe(d.c), chg: safe(d.pc > 0 ? ((d.c-d.pc)/d.pc)*100 : 0), source: "finnhub" };
    }
  } catch {}
  // Stooq fallback (metals/forex)
  try {
    const stooqSym = upper.replace("/","").toLowerCase();
    const pd = await fetchStooq(stooqSym);
    if (pd) return pd;
  } catch {}
  return null;
}

/* ── MAIN ─────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const symsParam = new URL(req.url).searchParams.get("symbols");

  if (symsParam) {
    const requested = symsParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    const results: Record<string, { price: number; change24h: number; chg: number; source: string }> = {};
    await Promise.allSettled(requested.map(async (sym) => {
      const pd = await fetchOnDemand(sym);
      if (pd) results[sym] = { price: pd.price, change24h: pd.chg, chg: pd.chg, source: pd.source };
    }));
    return NextResponse.json(
      { prices: results, count: Object.keys(results).length, elapsedMs: Date.now()-start, updated_at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Bulk — all parallel
  const [cgData, stocks, commodities, forex, indices] = await Promise.all([
    fetchCG(),
    fetchFinnhubStocks(),
    fetchCommodities(),
    fetchForex(),
    fetchIndices(),
  ]);

  const prices: Record<string,PD> = {};
  for (const src of [cgData, stocks, commodities, forex, indices]) {
    for (const [k,v] of Object.entries(src)) prices[k] = v;
  }

  // Alias NDX from QQQ if not already set
  if (prices["NDX"] && !prices["COMP"]) prices["COMP"] = { ...prices["NDX"] };

  const count = Object.keys(prices).length;
  return NextResponse.json(
    { prices, count, elapsedMs: Date.now()-start, updated_at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store", "X-Price-Count": String(count) } }
  );
}
