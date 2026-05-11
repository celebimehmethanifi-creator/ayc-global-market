import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

async function binanceBalance(apiKey: string, secret: string) {
  const ts = Date.now();
  const params = `timestamp=${ts}&recvWindow=5000`;
  const sig = crypto.createHmac('sha256', secret).update(params).digest('hex');
  const r = await fetch(`https://api.binance.com/api/v3/account?${params}&signature=${sig}`, {
    headers: { 'X-MBX-APIKEY': apiKey }, signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg);
  const relevant = d.balances?.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0) || [];
  const usdt = d.balances?.find((b: any) => b.asset === 'USDT');
  return { ok: true, totalBalance: parseFloat(usdt?.free || '0'), freeBalance: parseFloat(usdt?.free || '0'), currency: 'USDT', assets: relevant.slice(0, 30).map((b: any) => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) })) };
}

async function bybitBalance(apiKey: string, secret: string) {
  const ts = Date.now().toString();
  const recv = '5000';
  const sig = crypto.createHmac('sha256', secret).update(ts + apiKey + recv).digest('hex');
  const r = await fetch('https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED', {
    headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': ts, 'X-BAPI-RECV-WINDOW': recv, 'X-BAPI-SIGN': sig },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (d.retCode !== 0) throw new Error(d.retMsg);
  const wallet = d.result?.list?.[0];
  const coins = (wallet?.coin || []).filter((c: any) => parseFloat(c.walletBalance || '0') > 0);
  return { ok: true, totalBalance: parseFloat(wallet?.totalEquity || '0'), freeBalance: parseFloat(wallet?.totalAvailableBalance || '0'), currency: 'USDT', assets: coins.slice(0, 30).map((c: any) => ({ asset: c.coin, free: parseFloat(c.availableToWithdraw || '0'), locked: parseFloat(c.locked || '0') })) };
}

async function okxBalance(apiKey: string, secret: string, passphrase: string) {
  const ts = new Date().toISOString();
  const path = '/api/v5/account/balance';
  const sig = crypto.createHmac('sha256', secret).update(ts + 'GET' + path).digest('base64');
  const r = await fetch(`https://www.okx.com${path}`, {
    headers: { 'OK-ACCESS-KEY': apiKey, 'OK-ACCESS-SIGN': sig, 'OK-ACCESS-TIMESTAMP': ts, 'OK-ACCESS-PASSPHRASE': passphrase },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (d.code !== '0') throw new Error(d.msg);
  const details = (d.data?.[0]?.details || []).filter((c: any) => parseFloat(c.cashBal || '0') > 0);
  return { ok: true, totalBalance: parseFloat(d.data?.[0]?.totalEq || '0'), freeBalance: parseFloat(d.data?.[0]?.totalEq || '0'), currency: 'USD', assets: details.slice(0, 30).map((c: any) => ({ asset: c.ccy, free: parseFloat(c.availBal || '0'), locked: parseFloat(c.frozenBal || '0') })) };
}

export async function POST(req: NextRequest) {
  try {
    const { exchange, apiKey, apiSecret, passphrase } = await req.json();
    let r;
    if (exchange === 'binance') r = await binanceBalance(apiKey, apiSecret);
    else if (exchange === 'bybit') r = await bybitBalance(apiKey, apiSecret);
    else if (exchange === 'okx') r = await okxBalance(apiKey, apiSecret, passphrase || '');
    else return NextResponse.json({ ok: false, error: 'Unknown exchange' }, { status: 400 });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
