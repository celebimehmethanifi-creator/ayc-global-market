import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AV_KEY  = process.env.ALPHAVANTAGE_API_KEY || '63T2IM69L6OSSR51';
const CG_KEY  = process.env.COINGECKO_API_KEY    || 'CG-MoxLLAjSA3r2JHXanw9fotD5';

interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }

const CRYPTO_IDS: Record<string, string> = {
  BTC:'bitcoin', ETH:'ethereum', SOL:'solana', BNB:'binancecoin', XRP:'ripple',
  DOGE:'dogecoin', ADA:'cardano', AVAX:'avalanche-2', LINK:'chainlink',
  DOT:'polkadot', LTC:'litecoin', ONDO:'ondo-finance', SUI:'sui', APT:'aptos',
  PEPE:'pepe', INJ:'injective-protocol', XLM:'stellar', VET:'vechain',
  ICP:'internet-computer', FIL:'filecoin', HBAR:'hedera-hashgraph',
  ALGO:'algorand', FLOKI:'floki', TON:'the-open-network', TRX:'tron',
  OP:'optimism', ARB:'arbitrum', UNI:'uniswap', ATOM:'cosmos',
  NEAR:'near', SHIB:'shiba-inu',
};

function isCrypto(sym: string): boolean {
  const base = sym.replace('USDT', '').replace('/USDT', '').toUpperCase();
  return base in CRYPTO_IDS;
}

function tfToBinanceInterval(tf: string): string {
  const m: Record<string, string> = {
    '5M':'5m','15M':'15m','1H':'1h','4H':'4h',
    '1D':'1d','1W':'1w','1M':'1d','3M':'1d','1Y':'1w',
  };
  return m[tf] || '1d';
}

function tfToBinanceLimit(tf: string): number {
  const m: Record<string, number> = {
    '5M':200,'15M':200,'1H':168,'4H':120,
    '1D':90,'1W':52,'1M':30,'3M':90,'1Y':52,
  };
  return m[tf] || 90;
}

async function sfetch(url: string, ms = 9000): Promise<Response | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(url, {
      signal: c.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'AYCMarket/2.0' },
    });
    clearTimeout(t);
    return r;
  } catch { return null; }
}

/* ── SOURCE 1: Binance klines (crypto) ──────────────── */
async function binanceKlines(symbol: string, tf: string): Promise<Candle[]> {
  const sym = symbol.toUpperCase().replace('/','').endsWith('USDT')
    ? symbol.toUpperCase().replace('/','')
    : symbol.toUpperCase().replace('USDT','') + 'USDT';
  const interval = tfToBinanceInterval(tf);
  const limit = tfToBinanceLimit(tf);
  const r = await sfetch(
    `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`
  );
  if (!r?.ok) throw new Error('Binance failed');
  const raw: Array<[number,string,string,string,string,string]> = await r.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Empty');
  return raw.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
  }));
}

/* ── SOURCE 2: CoinGecko OHLC (crypto fallback) ─────── */
async function coinGeckoOHLC(symbol: string, tf: string): Promise<Candle[]> {
  const base = symbol.replace('USDT','').replace('/USDT','').toUpperCase();
  const cgId = CRYPTO_IDS[base];
  if (!cgId) throw new Error('No CG id');
  const days = tf === '5M' || tf === '15M' ? 1
    : tf === '1H' ? 1
    : tf === '4H' ? 7
    : tf === '1D' ? 30
    : tf === '1W' ? 90
    : tf === '1M' ? 30
    : tf === '3M' ? 90
    : 365;
  const r = await sfetch(
    `https://api.coingecko.com/api/v3/coins/${cgId}/ohlc?vs_currency=usd&days=${days}&x_cg_demo_api_key=${CG_KEY}`,
    10000
  );
  if (!r?.ok) throw new Error('CG failed');
  const raw: Array<[number, number, number, number, number]> = await r.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Empty');
  return raw.map(k => ({
    t: k[0],
    o: k[1],
    h: k[2],
    l: k[3],
    c: k[4],
    v: 0,
  }));
}

/* ── SOURCE 3: Yahoo Finance (stocks/ETFs/indices) ───── */
async function yahooKlines(symbol: string, tf: string): Promise<Candle[]> {
  const rangeMap: Record<string, string> = {
    '5M':'1d','15M':'5d','1H':'5d','4H':'1mo',
    '1D':'3mo','1W':'1y','1M':'3mo','3M':'1y','1Y':'5y',
  };
  const intMap: Record<string, string> = {
    '5M':'5m','15M':'15m','1H':'1h','4H':'60m',
    '1D':'1d','1W':'1wk','1M':'1d','3M':'1wk','1Y':'1wk',
  };
  const range = rangeMap[tf] || '3mo';
  const interval = intMap[tf] || '1d';
  const r = await sfetch(
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`,
    10000
  );
  if (!r?.ok) throw new Error('Yahoo failed');
  const d = await r.json();
  const res = d?.chart?.result?.[0];
  if (!res) throw new Error('No Yahoo data');
  const ts: number[] = res.timestamp || [];
  const q = res.indicators?.quote?.[0];
  if (!q || ts.length === 0) throw new Error('Empty');
  return ts.map((t: number, i: number) => ({
    t: t * 1000,
    o: q.open[i] || 0,
    h: q.high[i] || 0,
    l: q.low[i] || 0,
    c: q.close[i] || 0,
    v: q.volume[i] || 0,
  })).filter((c: Candle) => c.o > 0 && c.h > 0 && c.l > 0 && c.c > 0);
}

/* ── SOURCE 4: Stooq CSV (forex/commodities/indices) ─── */
async function stooqKlines(symbol: string, tf: string): Promise<Candle[]> {
  const sym = symbol.toLowerCase().replace('/','').replace('usdt','');
  const r = await sfetch(`https://stooq.com/q/d/l/?s=${sym}&i=d`);
  if (!r?.ok) throw new Error('Stooq failed');
  const csv = await r.text();
  const lines = csv.split("\n").slice(1).filter(Boolean);
  if (lines.length === 0) throw new Error('Empty Stooq');
  const limitMap: Record<string, number> = {
    '1D':30,'1W':90,'1M':30,'3M':90,'1Y':252,
  };
  const limit = limitMap[tf] || 30;
  return lines.slice(-limit).map(line => {
    const [date, open, high, low, close, vol] = line.split(',');
    const t = new Date(date).getTime();
    return { t, o: parseFloat(open), h: parseFloat(high), l: parseFloat(low), c: parseFloat(close), v: parseFloat(vol || '0') };
  }).filter(c => !isNaN(c.t) && c.o > 0);
}

/* ── SOURCE 5: Alpha Vantage (stocks/forex fallback) ─── */
async function avKlines(symbol: string, tf: string): Promise<Candle[]> {
  const isForex = symbol.length === 6 && /^[A-Z]{6}$/.test(symbol);
  let url: string;
  if (isForex) {
    const from = symbol.slice(0, 3);
    const to = symbol.slice(3, 6);
    url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&outputsize=compact&apikey=${AV_KEY}`;
  } else {
    url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${AV_KEY}`;
  }
  const r = await sfetch(url, 10000);
  if (!r?.ok) throw new Error('AV failed');
  const d = await r.json();
  const key = Object.keys(d).find(k => k.includes('Time Series') || k.includes('FX'));
  if (!key) throw new Error('AV no data');
  const series = d[key] as Record<string, Record<string, string>>;
  const entries = Object.entries(series).sort(([a], [b]) => a.localeCompare(b));
  const limit = tf === '3M' ? 90 : tf === '1Y' ? 252 : tf === '1W' ? 90 : 30;
  return entries.slice(-limit).map(([date, val]) => ({
    t: new Date(date).getTime(),
    o: parseFloat(val['1. open'] || val['1. open']),
    h: parseFloat(val['2. high']),
    l: parseFloat(val['3. low']),
    c: parseFloat(val['4. close']),
    v: parseFloat(val['5. volume'] || '0'),
  })).filter(c => c.o > 0);
}

/* ── FOREX SYMBOLS ──────────────────────────────────── */
const FOREX_SYMS = new Set(['EURUSD','GBPUSD','USDTRY','USDJPY','USDCHF','USDCAD','EURTRY',
  'AUDUSD','NZDUSD','USDSGD','USDHKD','EURGBP','EURJPY','GBPJPY']);

/* ── COMMODITY STOOQ MAP ───────────────────────────── */
const COMMODITY_STOOQ: Record<string, string> = {
  XAUUSD:'xauusd', XAGUSD:'xagusd', GOLD:'xauusd', SILVER:'xagusd',
  WTI:'cl.f', BRENT:'lco.f', OIL:'cl.f',
};

/* ── MAIN HANDLER ───────────────────────────────────── */
export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase().trim();
  const tf = req.nextUrl.searchParams.get('tf') || '1D';
  const errors: string[] = [];

  try {
    let candles: Candle[] = [];

    if (isCrypto(symbol)) {
      // CRYPTO: Binance → CoinGecko
      try { candles = await binanceKlines(symbol, tf); }
      catch (e: any) {
        errors.push(`binance: ${e.message}`);
        try { candles = await coinGeckoOHLC(symbol, tf); }
        catch (e2: any) { errors.push(`coingecko: ${e2.message}`); }
      }
    } else if (FOREX_SYMS.has(symbol)) {
      // FOREX: Stooq → AV
      try { candles = await stooqKlines(symbol, tf); }
      catch (e: any) {
        errors.push(`stooq: ${e.message}`);
        try { candles = await avKlines(symbol, tf); }
        catch (e2: any) { errors.push(`av: ${e2.message}`); }
      }
    } else if (COMMODITY_STOOQ[symbol]) {
      // COMMODITIES: Stooq
      try { candles = await stooqKlines(COMMODITY_STOOQ[symbol], tf); }
      catch (e: any) { errors.push(`stooq: ${e.message}`); }
      // Yahoo Finance fallback for commodities when Stooq fails/empty
      if (candles.length === 0) {
        const ym: Record<string,string> = {XAUUSD:"GC=F",GOLD:"GC=F",XAGUSD:"SI=F",WTIUSD:"CL=F",BRENT:"BZ=F"};
        const ys = ym[symbol]; if (ys) { try { candles = await yahooKlines(ys, tf); } catch(ey:any){errors.push("yahoo:"+ey.message);} }
      }
    } else {
      // STOCKS / ETFs / INDICES: Yahoo → AV → Stooq
      try { candles = await yahooKlines(symbol, tf); }
      catch (e: any) {
        errors.push(`yahoo: ${e.message}`);
        try { candles = await avKlines(symbol, tf); }
        catch (e2: any) {
          errors.push(`av: ${e2.message}`);
          try { candles = await stooqKlines(symbol, tf); }
          catch (e3: any) { errors.push(`stooq: ${e3.message}`); }
        }
      }
    }


    // Ultimate fallback: try Binance for unknown symbols (might be crypto)
    if (candles.length === 0 && !symbol.includes(".") && !symbol.includes("=")) {
      const tryBn = symbol.endsWith("USDT") ? symbol : symbol + "USDT";
      try { candles = await binanceKlines(tryBn, tf); } catch(e:any) { errors.push("bn-fallback:"+e.message); }
    }

    const clean = candles
      .filter(c => c.t > 0 && c.o > 0 && c.h > 0 && c.l > 0 && c.c > 0)
      .sort((a, b) => a.t - b.t);

    return NextResponse.json(
      { symbol, tf, candles: clean, count: clean.length, errors: errors.length > 0 ? errors : undefined },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { symbol, tf, candles: [], count: 0, error: e.message, errors },
      { status: 200 }
    );
  }
}
