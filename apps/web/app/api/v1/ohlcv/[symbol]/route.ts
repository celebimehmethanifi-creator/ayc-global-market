import { NextRequest, NextResponse } from 'next/server';

const TD_KEY = process.env.TWELVEDATA_API_KEY || 'c6293bae084a4c0fb46e2cb5df525ef8';

function isCrypto(sym: string) {
  return sym.endsWith('USDT') || sym.endsWith('BTC') || sym.endsWith('ETH') ||
    ['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','DOT','LINK','UNI','MATIC','ONDO','SUI','APT','PEPE','INJ','ARB','OP','SHIB'].includes(sym.replace('USDT','').replace('/USDT',''));
}

function tfToBinance(tf: string): string {
  const map: Record<string,string> = { '1D':'1d', '1W':'1w', '1M':'1M', '3M':'1M', '1Y':'1w', '4H':'4h', '1H':'1h', '15M':'15m' };
  return map[tf] || '1d';
}

function tfToTD(tf: string): { interval: string; outputsize: number } {
  const map: Record<string, { interval: string; outputsize: number }> = {
    '1D': { interval: '1day', outputsize: 30 },
    '1W': { interval: '1day', outputsize: 90 },
    '1M': { interval: '1day', outputsize: 30 },
    '3M': { interval: '1week', outputsize: 13 },
    '1Y': { interval: '1week', outputsize: 52 },
    '4H': { interval: '4h', outputsize: 60 },
    '1H': { interval: '1h', outputsize: 48 },
  };
  return map[tf] || { interval: '1day', outputsize: 30 };
}

async function binanceKlines(symbol: string, tf: string) {
  const interval = tfToBinance(tf);
  const limit = tf === '1Y' ? 52 : tf === '3M' ? 13 : 30;
  const sym = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : symbol.toUpperCase() + 'USDT';
  const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  const r = await fetch(url, { signal: ctrl.signal });
  clearTimeout(t);
  if (!r.ok) throw new Error('Binance klines failed');
  const raw = await r.json();
  return raw.map((k: any[]) => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
  }));
}

async function tdKlines(symbol: string, tf: string) {
  const { interval, outputsize } = tfToTD(tf);
  let sym = symbol;
  if (sym.endsWith('USDT')) sym = sym.replace('USDT', '/USD');
  else if (sym.endsWith('=X')) sym = sym.replace('=X', '').replace('USD', '/USD');
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=${interval}&outputsize=${outputsize}&apikey=${TD_KEY}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  const r = await fetch(url, { signal: ctrl.signal });
  clearTimeout(t);
  if (!r.ok) throw new Error('TwelveData failed');
  const d = await r.json();
  if (d.status === 'error' || !d.values) throw new Error(d.message || 'No data');
  return d.values.reverse().map((v: any) => ({
    t: new Date(v.datetime).getTime(),
    o: parseFloat(v.open),
    h: parseFloat(v.high),
    l: parseFloat(v.low),
    c: parseFloat(v.close),
    v: parseFloat(v.volume || '0'),
  }));
}

export async function GET(req: NextRequest, { params }: { params: { symbol: string } }) {
  const symbol = decodeURIComponent(params.symbol);
  const tf = req.nextUrl.searchParams.get('tf') || '1M';
  try {
    let candles;
    if (isCrypto(symbol)) {
      try { candles = await binanceKlines(symbol, tf); }
      catch { candles = await tdKlines(symbol, tf); }
    } else {
      try { candles = await tdKlines(symbol, tf); }
      catch { candles = await binanceKlines(symbol, tf); }
    }
    return NextResponse.json({ symbol, tf, candles });
  } catch (e: any) {
    return NextResponse.json({ symbol, tf, candles: [], error: e.message }, { status: 200 });
  }
}
