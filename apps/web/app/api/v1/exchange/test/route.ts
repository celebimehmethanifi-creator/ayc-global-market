import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

async function testBinance(apiKey: string, secret: string) {
  const ts = Date.now();
  const params = `timestamp=${ts}&recvWindow=5000`;
  const sig = crypto.createHmac('sha256', secret).update(params).digest('hex');
  const r = await fetch(`https://api.binance.com/api/v3/account?${params}&signature=${sig}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || 'Binance API hatasi');
  const usdt = d.balances?.find((b: any) => b.asset === 'USDT');
  return { ok: true, totalBalance: parseFloat(usdt?.free || '0'), currency: 'USDT', assets: d.balances?.slice(0, 20).map((b: any) => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) })) || [] };
}

async function testBybit(apiKey: string, secret: string) {
  const ts = Date.now().toString();
  const recv = '5000';
  const toSign = ts + apiKey + recv;
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest('hex');
  const r = await fetch('https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED', {
    headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': ts, 'X-BAPI-RECV-WINDOW': recv, 'X-BAPI-SIGN': sig },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (d.retCode !== 0) throw new Error(d.retMsg || 'Bybit API hatasi');
  const wallet = d.result?.list?.[0];
  const coins = wallet?.coin || [];
  return { ok: true, totalBalance: parseFloat(wallet?.totalEquity || '0'), currency: 'USDT', assets: coins.slice(0, 20).map((c: any) => ({ asset: c.coin, free: parseFloat(c.availableToWithdraw || '0'), locked: parseFloat(c.locked || '0') })) };
}

async function testOkx(apiKey: string, secret: string, passphrase: string) {
  const ts = new Date().toISOString();
  const path = '/api/v5/account/balance';
  const msg = ts + 'GET' + path;
  const sig = crypto.createHmac('sha256', secret).update(msg).digest('base64');
  const r = await fetch(`https://www.okx.com${path}`, {
    headers: { 'OK-ACCESS-KEY': apiKey, 'OK-ACCESS-SIGN': sig, 'OK-ACCESS-TIMESTAMP': ts, 'OK-ACCESS-PASSPHRASE': passphrase },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (d.code !== '0') throw new Error(d.msg || 'OKX API hatasi');
  const details = d.data?.[0]?.details || [];
  return { ok: true, totalBalance: parseFloat(d.data?.[0]?.totalEq || '0'), currency: 'USD', assets: details.slice(0, 20).map((c: any) => ({ asset: c.ccy, free: parseFloat(c.availBal || '0'), locked: parseFloat(c.frozenBal || '0') })) };
}

export async function POST(req: NextRequest) {
  try {
    const { exchange, apiKey, apiSecret, passphrase } = await req.json();
    if (!apiKey || !apiSecret) return NextResponse.json({ error: 'API key ve secret gerekli' }, { status: 400 });
    let result;
    if (exchange === 'binance') result = await testBinance(apiKey, apiSecret);
    else if (exchange === 'bybit') result = await testBybit(apiKey, apiSecret);
    else if (exchange === 'okx') result = await testOkx(apiKey, apiSecret, passphrase || '');
    else return NextResponse.json({ error: 'Desteklenmeyen borsa' }, { status: 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Baglanti hatasi' }, { status: 500 });
  }
}
