import { NextRequest, NextResponse } from "next/server";

export const dynamic  = "force-dynamic";
export const revalidate = 0;

const CG_KEY = process.env.COINGECKO_API_KEY || "";
const FH_KEY = process.env.FINNHUB_API_KEY || "";

interface PD { price: number; chg: number; source: string; }

async function sf(url: string, ms = 8000, extraHeaders: Record<string,string> = {}): Promise<Response | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(url, { signal: c.signal, headers: { "Accept": "application/json", "User-Agent": "AYCMarket/2.5", ...extraHeaders } });
    clearTimeout(t);
    return r;
  } catch { return null; }
}
const num = (v: unknown) => { const n = Number(v); return isFinite(n) ? n : 0; };

/* ── Stooq generic: gold/silver/oil real-time ─── */
async function fetchStooq(sym: string): Promise<PD | null> {
  try {
    const r = await sf(`https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=json`, 8000);
    if (!r?.ok) return null;
    const raw = await r.text();
    const sanitized = raw.replace(/:(\s*[,}])/g, ":null$1");
    let d: { symbols?: unknown[] };
    try { d = JSON.parse(sanitized); } catch { return null; }
    const item = Array.isArray(d.symbols) ? d.symbols[0] as Record<string, unknown> : null;
    if (!item) return null;
    const close = num(item.c || item.Close || item.close || item.Last);
    const open  = num(item.o || item.Open  || item.open);
    if (close <= 0) return null;
    const chg = open > 0 ? ((close - open) / open) * 100 : 0;
    return { price: close, chg: num(chg), source: "stooq" };
  } catch { return null; }
}

/* ── CoinGecko: crypto only (no gold/silver tokens) ── */
async function fetchCG(): Promise<Record<string, PD>> {
  const out: Record<string, PD> = {};
  try {
    const headers: Record<string, string> = {};
    if (CG_KEY) headers["x-cg-demo-api-key"] = CG_KEY;
    const ids = "bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,cardano,avalanche-2";
    const r = await sf(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      8000,
      headers
    );
    if (!r?.ok) return out;
    const d = await r.json();
    const map: Record<string, string> = {
      bitcoin: "BTC", ethereum: "ETH", solana: "SOL", binancecoin: "BNB",
      ripple: "XRP", dogecoin: "DOGE", cardano: "ADA", "avalanche-2": "AVAX",
    };
    for (const [id, sym] of Object.entries(map)) {
      const p = d[id];
      if (p?.usd > 0) out[sym] = { price: num(p.usd), chg: num(p.usd_24h_change), source: "coingecko" };
    }
  } catch {}
  return out;
}

/* ── Finnhub: US stocks + ETF-based indices ── */
async function fetchFH(symbol: string): Promise<PD | null> {
  if (!FH_KEY) return null;
  try {
    const r = await sf(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FH_KEY}`, 6000);
    if (!r?.ok) return null;
    const d = await r.json();
    if (d.c > 0) {
      const chg = d.pc > 0 ? ((d.c - d.pc) / d.pc) * 100 : 0;
      return { price: num(d.c), chg: num(chg), source: "finnhub" };
    }
  } catch {}
  return null;
}

/* ── Frankfurter: forex with real % change ── */
async function fetchForex(): Promise<Record<string, PD>> {
  const out: Record<string, PD> = {};
  try {
    const yday = new Date(); yday.setDate(yday.getDate() - 1);
    const ydayStr = yday.toISOString().split("T")[0];
    const [todayR, yrR] = await Promise.all([
      sf("https://api.frankfurter.app/latest?base=USD&symbols=EUR,GBP,TRY", 8000),
      sf(`https://api.frankfurter.app/${ydayStr}?base=USD&symbols=EUR,GBP,TRY`, 6000),
    ]);
    const today = todayR?.ok ? await todayR.json() : null;
    const yest  = yrR?.ok   ? await yrR.json()    : null;

    const tr  = today?.rates;
    const yr  = yest?.rates;

    if (!tr) return out;

    const eur  = num(tr.EUR);
    const gbp  = num(tr.GBP);
    const tryR = num(tr.TRY);
    const yEur = yr ? num(yr.EUR) : 0;
    const yGbp = yr ? num(yr.GBP) : 0;
    const yTry = yr ? num(yr.TRY) : 0;

    const pctChg = (cur: number, prev: number): number => {
      if (prev <= 0 || cur <= 0) return 0;
      return ((cur - prev) / prev) * 100;
    };

    if (eur > 0) {
      const eurUsd  = 1 / eur;
      const pEurUsd = yEur > 0 ? 1 / yEur : 0;
      out["EUR/USD"] = { price: +eurUsd.toFixed(5), chg: pctChg(eurUsd, pEurUsd), source: "frankfurter" };
    }
    if (gbp > 0) {
      const gbpUsd  = 1 / gbp;
      const pGbpUsd = yGbp > 0 ? 1 / yGbp : 0;
      out["GBP/USD"] = { price: +gbpUsd.toFixed(5), chg: pctChg(gbpUsd, pGbpUsd), source: "frankfurter" };
    }
    if (tryR > 0) {
      out["USD/TRY"] = { price: +tryR.toFixed(4), chg: pctChg(tryR, yTry), source: "frankfurter" };
    }
  } catch {}
  return out;
}

/* ── MAIN ── */
export async function GET(_req: NextRequest) {
  const t0 = Date.now();

  // Parallel: CoinGecko + forex + metals (stooq) + oil (stooq cl.f)
  const [cg, forex, goldD, silverD, oilD] = await Promise.all([
    fetchCG(),
    fetchForex(),
    fetchStooq("xauusd"),  // spot gold — real-time
    fetchStooq("xagusd"),  // spot silver — real-time
    fetchStooq("cl.f"),    // WTI crude oil futures — real-time
  ]);

  // Finnhub: stocks + ETF-based indices (parallel, 10 calls)
  const fhSyms: [string, string][] = [
    ["AAPL", "AAPL"], ["TSLA", "TSLA"], ["NVDA", "NVDA"],
    ["MSFT", "MSFT"], ["AMZN", "AMZN"], ["GOOGL", "GOOGL"], ["META", "META"],
    ["SPY",  "SPY"],
    ["QQQ",  "QQQ"],
    ["DIA",  "DIA"],
  ];
  const fhResults = await Promise.all(fhSyms.map(([s]) => fetchFH(s)));

  // Assemble
  const all: Record<string, PD> = { ...cg, ...forex };
  if (goldD)   all["XAU"] = goldD;
  if (silverD) all["XAG"] = silverD;
  if (oilD)    all["OIL"] = oilD;
  fhSyms.forEach(([sym, key], i) => { if (fhResults[i]) all[key] = fhResults[i]!; });

  // Fallback: if Stooq gold/silver failed, try CoinGecko PAXG
  if (!all["XAU"]) {
    try {
      const headers: Record<string, string> = {};
      if (CG_KEY) headers["x-cg-demo-api-key"] = CG_KEY;
      const r = await sf(
        `https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true`,
        6000,
        headers,
      );
      if (r?.ok) {
        const d = await r.json();
        if (d["pax-gold"]?.usd > 0)
          all["XAU"] = { price: num(d["pax-gold"].usd), chg: num(d["pax-gold"].usd_24h_change), source: "coingecko-paxg" };
      }
    } catch {}
  }

  // Metadata
  const META: Record<string, { category: string; name: string }> = {
    BTC:       { category: "crypto",  name: "Bitcoin" },
    ETH:       { category: "crypto",  name: "Ethereum" },
    SOL:       { category: "crypto",  name: "Solana" },
    BNB:       { category: "crypto",  name: "BNB" },
    XRP:       { category: "crypto",  name: "XRP" },
    DOGE:      { category: "crypto",  name: "Dogecoin" },
    ADA:       { category: "crypto",  name: "Cardano" },
    AVAX:      { category: "crypto",  name: "Avalanche" },
    AAPL:      { category: "stock",   name: "Apple Inc." },
    TSLA:      { category: "stock",   name: "Tesla" },
    NVDA:      { category: "stock",   name: "NVIDIA" },
    MSFT:      { category: "stock",   name: "Microsoft" },
    AMZN:      { category: "stock",   name: "Amazon" },
    GOOGL:     { category: "stock",   name: "Alphabet" },
    META:      { category: "stock",   name: "Meta" },
    "USD/TRY": { category: "forex",   name: "Dolar / TL" },
    "EUR/USD": { category: "forex",   name: "Euro / Dolar" },
    "GBP/USD": { category: "forex",   name: "Sterlin / Dolar" },
    XAU:       { category: "metal",   name: "Altın (Ons)" },
    XAG:       { category: "metal",   name: "Gümüş (Ons)" },
    OIL:       { category: "energy",  name: "Ham Petrol (WTI)" },
    SPY:       { category: "index",   name: "S&P 500 ETF" },
    QQQ:       { category: "index",   name: "Nasdaq 100 ETF" },
    DIA:       { category: "index",   name: "Dow Jones ETF" },
  };

  const tickers = Object.entries(META)
    .filter(([sym]) => all[sym]?.price > 0)
    .map(([sym, meta]) => ({
      symbol:   sym,
      name:     meta.name,
      category: meta.category,
      price:    all[sym].price,
      chg:      all[sym].chg,
      source:   all[sym].source,
    }))
    .sort((a, b) => b.chg - a.chg);

  return NextResponse.json(
    { tickers, count: tickers.length, elapsedMs: Date.now() - t0, updated_at: new Date().toISOString(), source: "ayc-ticker-v5" },
    { headers: { "Cache-Control": "no-store, no-cache" } }
  );
}


