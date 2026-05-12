import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { symbol: string } }) {
  const symbol = decodeURIComponent(params.symbol);
  const base = req.nextUrl.origin;
  try {
    const r = await fetch(`${base}/api/v1/prices/live?symbols=${symbol}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined,
    });
    const d = await r.json();
    const prices = d.prices || d;
    const pd = prices[symbol] || prices[symbol.replace('USDT', '')] || prices[symbol+'USDT'] || Object.values(prices)[0];
    if (pd && (pd as any).price) {
      return NextResponse.json({ symbol, price: (pd as any).price, chg: (pd as any).chg || 0, source: (pd as any).source });
    }
    return NextResponse.json({ symbol, price: 0, chg: 0, source: 'none' });
  } catch (e: any) {
    return NextResponse.json({ symbol, price: 0, chg: 0, error: e.message });
  }
}
