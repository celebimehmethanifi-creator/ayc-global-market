// build:202605111838
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

/* CRYPTO: CoinGecko */
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
      `https://api.coingecko.com/api/v3/simple/price?ids=${CG_IDS}&vs_currencies=usd&include_24hr_change=true`, { headers: { "x-cg-demo-api-key": CG_KEY } }
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

/* Finnhub: US Stocks */
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

/* Finnhub: ETF-based indices */
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
        out[etf] = { price: safe(d.c), chg: safe(chg), source: "finnhub" };
      }
    } catch {}
  }));
  return out;
}

/* Frankfurter: Forex with REAL % change */
async function fetchForex(): Promise<Record<string,PD>> {
  const out: Record<string,PD> = {};
  try {
    const yday = new Date(); yday.setDate(yday.getDate() - 1);
    const ydayStr = yday.toISOString().split("T")[0];
    const [todayR, yrR] = await Promise.all([
      sf("https://api.frankfurter.app/latest?base=USD&symbols=EUR,GBP,TRY,JPY,CHF,CAD", {}, 8000),
      sf(`https://api.frankfurter.app/${ydayStr}?base=USD&symbols=EUR,GBP,TRY,JPY,CHF,CAD`, {}, 6000),
    ]);
    const today = todayR?.ok ? await todayR.json() : null;
    const yest  = yrR?.ok   ? await yrR.json()   : null;
    const tr = today?.rates as Record<string,number> | undefined;
    const yr = yest?.rates  as Record<string,number> | undefined;
    if (!tr) return out;

    const pct = (cur: number, prev: number) => (prev > 0 && cur > 0 ? ((cur - prev) / prev) * 100 : 0);
    const n = (x: unknown) => safe(x);

    const eur = n(tr.EUR); const yEur = yr ? n(yr.EUR) : 0;
    const gbp = n(tr.GBP); const yGbp = yr ? n(yr.GBP) : 0;
    const tryR = n(tr.TRY); const yTry = yr ? n(yr.TRY) : 0;
    const jpy = n(tr.JPY); const yJpy = yr ? n(yr.JPY) : 0;
    const chf = n(tr.CHF); const yChf = yr ? n(yr.CHF) : 0;
    const cad = n(tr.CAD); const yCad = yr ? n(yr.CAD) : 0;

    if (eur > 0) { const p = 1/eur; out["EURUSD"] = { price: +p.toFixed(5), chg: pct(p, yEur>0?1/yEur:0), source: "frankfurter" }; }
    if (gbp > 0) { const p = 1/gbp; out["GBPUSD"] = { price: +p.toFixed(5), chg: pct(p, yGbp>0?1/yGbp:0), source: "frankfurter" }; }
    if (tryR > 0) out["USDTRY"] = { price: +tryR.toFixed(4), chg: pct(tryR, yTry), source: "frankfurter" };
    if (jpy > 0)  out["USDJPY"] = { price: +jpy.toFixed(3),  chg: pct(jpy, yJpy),  source: "frankfurter" };
    if (chf > 0)  out["USDCHF"] = { price: +chf.toFixed(5),  chg: pct(chf, yChf),  source: "frankfurter" };
    if (cad > 0)  out["USDCAD"] = { price: +cad.toFixed(5),  chg: pct(cad, yCad),  source: "frankfurter" };
    if (eur > 0 && tryR > 0) {
      const eurtry = tryR / eur;
      const yEurtry = (yEur > 0 && yTry > 0) ? yTry / yEur : 0;
      out["EURTRY"] = { price: +eurtry.toFixed(4), chg: pct(eurtry, yEurtry), source: "frankfurter" };
    }
  } catch {}
  return out;
}

/* Stooq: metals + energy */
async function fetchStooq(sym: string): Promise<PD | null> {
  try {
    const r = await sf(`https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=json`, {}, 8000);
    if (!r?.ok) return null;
    const raw = await r.text();
    const sanitized = raw.replace(/:(\s*[,}])/g, ":null$1");
    let d: { symbols?: unknown[] };
    try { d = JSON.parse(sanitized); } catch { return null; }
    const item = Array.isArray(d.symbols) ? d.symbols[0] as Record<string,unknown> : null;
    if (!item) return null;
    const close = safe(item.c || item.Close || item.close || item.Last);
    const open  = safe(item.o || item.Open  || item.open);
    if (close <= 0) return null;
    const chg = open > 0 ? ((close - open) / open) * 100 : 0;
    return { price: close, chg: safe(chg), source: "stooq" };
  } catch { return null; }
}

async function fetchCommodities(): Promise<Record<string,PD>> {
  const out: Record<string,PD> = {};
  const [gold, silver, wti, brent] = await Promise.all([
    fetchStooq("xauusd"),
    fetchStooq("xagusd"),
    fetchStooq("cl.f"),
    fetchStooq("lco.f"),
  ]);
  if (gold)   out["XAUUSD"] = gold;
  if (silver) out["XAGUSD"] = silver;
  if (wti)    out["WTIUSD"] = wti;
  if (brent)  out["BRENT"]  = brent;
  return out;
}

/* ON-DEMAND: single symbol lookup - smart routing */
const CG_ID_MAP: Record<string, string> = {
  BTC:"bitcoin",ETH:"ethereum",SOL:"solana",BNB:"binancecoin",XRP:"ripple",
  DOGE:"dogecoin",ADA:"cardano",AVAX:"avalanche-2",LINK:"chainlink",
  DOT:"polkadot",LTC:"litecoin",ONDO:"ondo-finance",SUI:"sui",APT:"aptos",
  PEPE:"pepe",INJ:"injective-protocol",XLM:"stellar",VET:"vechain",
  ICP:"internet-computer",FIL:"filecoin",HBAR:"hedera-hashgraph",
  ALGO:"algorand",FLOKI:"floki",TON:"the-open-network",TRX:"tron",
  OP:"optimism",ARB:"arbitrum",UNI:"uniswap",ATOM:"cosmos",
  NEAR:"near",SHIB:"shiba-inu",
};
const STOCK_SET = new Set(["AAPL","TSLA","NVDA","MSFT","AMZN","META","GOOGL","AMD","NFLX","JPM","V","WMT","BABA","SPY","QQQ","DIA"]);
const COMMODITY_SET: Record<string, string> = {
  XAUUSD:"xauusd",XAGUSD:"xagusd",GOLD:"xauusd",SILVER:"xagusd",
  OIL:"cl.f",WTI:"cl.f",BRENT:"lco.f",
};

async function fetchOnDemand(sym: string): Promise<PD | null> {
  const upper = sym.toUpperCase().replace("USDT","").replace("/","");
  if (COMMODITY_SET[upper]) return fetchStooq(COMMODITY_SET[upper]);
  if (STOCK_SET.has(upper)) {
    try {
      const r = await sf(`https://finnhub.io/api/v1/quote?symbol=${upper}&token=${FH_KEY}`, {}, 6000);
      if (r?.ok) {
        const d = await r.json();
        if (d.c > 0) return { price: safe(d.c), chg: safe(d.pc > 0 ? ((d.c-d.pc)/d.pc)*100 : 0), source: "finnhub" };
      }
    } catch {}
    return null;
  }
  const cgId = CG_ID_MAP[upper];
  if (cgId) {
    try {
      const r = await sf(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${CG_KEY}`, {}, 7000);
      if (r?.ok) {
        const d = await r.json();
        if (d[cgId]?.usd > 0) return { price: d[cgId].usd, chg: safe(d[cgId].usd_24h_change), source: "coingecko" };
      }
    } catch {}
    try {
      const r = await sf(`https://api.binance.com/api/v3/ticker/24hr?symbol=${upper}USDT`, {}, 4000);
      if (r?.ok) {
        const d = await r.json();
        const p = parseFloat(d.lastPrice||"0");
        if (p > 0) return { price: p, chg: safe(d.priceChangePercent), source: "binance" };
      }
    } catch {}
    return null;
  }
  try {
    const r = await sf(`https://finnhub.io/api/v1/quote?symbol=${upper}&token=${FH_KEY}`, {}, 4000);
    if (r?.ok) {
      const d = await r.json();
      if (d.c > 0) return { price: safe(d.c), chg: safe(d.pc > 0 ? ((d.c-d.pc)/d.pc)*100 : 0), source: "finnhub" };
    }
  } catch {}
  try {
    const binSym = upper.endsWith("USDT") ? upper : upper + "USDT";
    const r = await sf(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binSym}`, {}, 4000);
    if (r?.ok) {
      const d = await r.json();
      const p = parseFloat(d.lastPrice||"0");
      if (p > 0) return { price: p, chg: safe(d.priceChangePercent), source: "binance" };
    }
  } catch {}
  return null;
}

/* MAIN */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const sp = new URL(req.url).searchParams;
  // Support both ?symbols=A,B,C and ?symbol=A (singular)
  const symsParam = sp.get("symbols") || sp.get("symbol");

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

  // Bulk - all parallel
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

  if (prices["NDX"] && !prices["COMP"]) prices["COMP"] = { ...prices["NDX"] };

  const count = Object.keys(prices).length;
  return NextResponse.json(
    { prices, count, elapsedMs: Date.now()-start, updated_at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store", "X-Price-Count": String(count) } }
  );
}



