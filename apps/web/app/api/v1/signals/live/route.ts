import { NextRequest, NextResponse } from "next/server";

const CG_KEY = process.env.COINGECKO_API_KEY || "CG-MoxLLAjSA3r2JHXanw9fotD5";

interface PriceData { price: number; chg: number; }

async function safeFetch(url: string, options: RequestInit = {}): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch { return null; }
}

// CoinGecko batch - confirmed working from Vercel
async function fetchCoinGeckoBatch(ids: string[]): Promise<Record<string, PriceData>> {
  try {
    const r = await safeFetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { "Accept": "application/json", "x-cg-demo-api-key": CG_KEY } }
    );
    if (!r || !r.ok) return {};
    const data = await r.json();
    const result: Record<string, PriceData> = {};
    for (const id of ids) {
      const d = data[id];
      if (d?.usd > 0) result[id] = { price: d.usd, chg: d.usd_24h_change || 0 };
    }
    return result;
  } catch { return {}; }
}

// Yahoo Finance chart - no API key needed, works from Vercel
async function fetchYahooPrice(symbol: string): Promise<PriceData | null> {
  try {
    const r = await safeFetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
    );
    if (!r || !r.ok) return null;
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? 0;
    const prev = meta?.chartPreviousClose ?? 0;
    if (price <= 0) return null;
    const chg = prev > 0 ? ((price - prev) / prev) * 100 : 0;
    return { price, chg };
  } catch { return null; }
}

// Yahoo batch for multiple symbols
async function fetchYahooBatch(symbolMap: Record<string, string>): Promise<Record<string, PriceData>> {
  const entries = Object.entries(symbolMap);
  const results = await Promise.allSettled(
    entries.map(([key, yfSym]) =>
      fetchYahooPrice(yfSym).then(r => ({ key, data: r }))
    )
  );
  const out: Record<string, PriceData> = {};
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.data) {
      out[r.value.key] = r.value.data;
    }
  }
  return out;
}

const SIGNALS_BASE = [
  { id:"s1",  symbol:"BTCUSDT",  cgId:"bitcoin",      yfSym:"BTC-USD",     name:"Bitcoin",               category:"crypto",   direction:"LONG",  strength:82, reason:"Hacim artışı + direnç kırılımı. RSI 62, MACD pozitif kesişim.", confidence:78, timeframe:"4H", risk_score:35 },
  { id:"s2",  symbol:"ETHUSDT",  cgId:"ethereum",     yfSym:"ETH-USD",     name:"Ethereum",              category:"crypto",   direction:"LONG",  strength:74, reason:"Güçlü destek bölgesi + pozitif momentum. L2 hacim artışı.", confidence:71, timeframe:"1D", risk_score:42 },
  { id:"s3",  symbol:"XAUUSD",   cgId:null,           yfSym:"GC=F",        name:"Altın",                 category:"metal",    direction:"LONG",  strength:88, reason:"Jeopolitik risk yüksek, güvenli liman talebi. DXY zayıf.", confidence:85, timeframe:"1W", risk_score:28 },
  { id:"s4",  symbol:"SOLUSDT",  cgId:"solana",       yfSym:"SOL-USD",     name:"Solana",                category:"crypto",   direction:"SHORT", strength:61, reason:"Aşırı alım bölgesi + hacim düşüşü. RSI 71 overbought.", confidence:65, timeframe:"1H", risk_score:55 },
  { id:"s5",  symbol:"AAPL",     cgId:null,           yfSym:"AAPL",        name:"Apple",                 category:"stock",    direction:"LONG",  strength:76, reason:"Kazanç sezonu öncesi alım baskısı. iPhone satışları güçlü.", confidence:72, timeframe:"1D", risk_score:38 },
  { id:"s6",  symbol:"NVDA",     cgId:null,           yfSym:"NVDA",        name:"NVIDIA",                category:"stock",    direction:"LONG",  strength:91, reason:"AI chip talebi rekor seviyede. Veri merkezi büyümesi devam ediyor.", confidence:88, timeframe:"1W", risk_score:32 },
  { id:"s7",  symbol:"TSLA",     cgId:null,           yfSym:"TSLA",        name:"Tesla",                 category:"stock",    direction:"SHORT", strength:58, reason:"Teslimat beklentisi altında kaldı. Rekabet baskısı artıyor.", confidence:63, timeframe:"4H", risk_score:61 },
  { id:"s8",  symbol:"USDTRY",   cgId:null,           yfSym:"USDTRY=X",   name:"Dolar/TL",              category:"forex",    direction:"LONG",  strength:70, reason:"TCMB faiz kararı beklenirken dolar baskısı. Enflasyon yüksek.", confidence:68, timeframe:"1D", risk_score:45 },
  { id:"s9",  symbol:"BNBUSDT",  cgId:"binancecoin",  yfSym:"BNB-USD",    name:"Binance Coin",          category:"crypto",   direction:"LONG",  strength:67, reason:"BNB Chain TVL artışı + ekosistem büyümesi.", confidence:69, timeframe:"4H", risk_score:48 },
  { id:"s10", symbol:"THYAO",    cgId:null,           yfSym:"THYAO.IS",   name:"Türk Hava Yolları",     category:"bist",     direction:"LONG",  strength:72, reason:"Turizm sezonu + uçuş kapasitesi artışı. Teknik destek güçlü.", confidence:70, timeframe:"1D", risk_score:40 },
  { id:"s11", symbol:"XRPUSDT",  cgId:"ripple",       yfSym:"XRP-USD",    name:"XRP",                   category:"crypto",   direction:"LONG",  strength:65, reason:"SEC davası netleşiyor. Kurumsal adopsiyon artışı.", confidence:67, timeframe:"4H", risk_score:52 },
  { id:"s12", symbol:"MSFT",     cgId:null,           yfSym:"MSFT",       name:"Microsoft",             category:"stock",    direction:"LONG",  strength:83, reason:"Azure büyümesi güçlü. Copilot entegrasyonları gelir artışı sağlıyor.", confidence:81, timeframe:"1W", risk_score:30 },
  { id:"s13", symbol:"XAGUSD",   cgId:null,           yfSym:"SI=F",       name:"Gümüş",                 category:"metal",    direction:"LONG",  strength:71, reason:"Sanayi talebi artışı + güvenli liman etkisi.", confidence:68, timeframe:"1D", risk_score:44 },
  { id:"s14", symbol:"EURUSD",   cgId:null,           yfSym:"EURUSD=X",   name:"EUR/USD",               category:"forex",    direction:"SHORT", strength:66, reason:"Fed güçlü dolar politikası. ECB faiz indirim beklentisi artıyor.", confidence:64, timeframe:"4H", risk_score:50 },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get("market") || "all";
  const limit = Math.min(parseInt(searchParams.get("limit") || "14"), 20);

  const catMap: Record<string, string[]> = {
    crypto: ["crypto"], turkey: ["bist"], us: ["stock"],
    precious: ["metal"], forex: ["forex"], energy: ["energy"], index: ["index"],
  };
  let filtered = SIGNALS_BASE;
  if (market !== "all") {
    const cats = catMap[market] || [market];
    filtered = SIGNALS_BASE.filter(s => cats.includes(s.category));
  }
  const slice = filtered.slice(0, limit);

  const cgIds = slice.filter(s => s.cgId).map(s => s.cgId as string);
  // Non-crypto use Yahoo Finance
  const yfMap: Record<string, string> = {};
  for (const s of slice) {
    if (!s.cgId && s.yfSym) yfMap[s.symbol] = s.yfSym;
  }

  const [cgData, yfData]: [Record<string, PriceData>, Record<string, PriceData>] = await Promise.all([
    cgIds.length > 0 ? fetchCoinGeckoBatch(cgIds) : Promise.resolve({}),
    Object.keys(yfMap).length > 0 ? fetchYahooBatch(yfMap) : Promise.resolve({}),
  ]);

  const now = new Date().toISOString();
  let pricesFound = 0;

  const signals = slice.map(s => {
    let priceData: PriceData = { price: 0, chg: 0 };

    if (s.cgId && cgData[s.cgId]) {
      priceData = cgData[s.cgId];
    } else if (!s.cgId && yfData[s.symbol]) {
      priceData = yfData[s.symbol];
    }

    if (priceData.price > 0) pricesFound++;

    const stopPct = s.risk_score / 100 * 0.5 + 0.02;
    const tpPct = stopPct * 2.5;
    const price = priceData.price;
    const stop_loss = price > 0 ? +(s.direction === "LONG" ? price * (1 - stopPct) : price * (1 + stopPct)).toFixed(4) : 0;
    const take_profit = price > 0 ? +(s.direction === "LONG" ? price * (1 + tpPct) : price * (1 - tpPct)).toFixed(4) : 0;

    return {
      ...s, cgId: undefined, yfSym: undefined, price, change_24h: +(priceData.chg).toFixed(2),
      entry_price: price, stop_loss, take_profit, created_at: now,
    };
  });

  return NextResponse.json({
    signals, count: signals.length, market,
    updated_at: now, source: "ayc-signal-engine-v1",
    prices_live: pricesFound > 0, prices_found: pricesFound,
  });
}
