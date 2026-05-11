import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Convert display symbol to exchange format
function toExSym(sym: string): string {
  const s = sym.replace('/', '').replace('-', '').toUpperCase();
  // Ensure USDT pair for crypto
  if (!s.endsWith('USDT') && !s.endsWith('BTC') && !s.endsWith('ETH') && !s.endsWith('BNB')) {
    return s + 'USDT';
  }
  return s;
}

async function binanceOrder(apiKey: string, secret: string, symbol: string, side: string, quoteQty?: number, baseQty?: number) {
  const sym = toExSym(symbol);
  const ts = Date.now();
  let params: string;
  if (quoteQty) {
    params = `symbol=${sym}&side=${side.toUpperCase()}&type=MARKET&quoteOrderQty=${quoteQty}&timestamp=${ts}&recvWindow=5000`;
  } else {
    params = `symbol=${sym}&side=${side.toUpperCase()}&type=MARKET&quantity=${baseQty}&timestamp=${ts}&recvWindow=5000`;
  }
  const sig = crypto.createHmac('sha256', secret).update(params).digest('hex');
  const r = await fetch(`https://api.binance.com/api/v3/order?${params}&signature=${sig}`, {
    method: 'POST', headers: { 'X-MBX-APIKEY': apiKey }, signal: AbortSignal.timeout(12000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || 'Binance siparis hatasi');
  return { orderId: String(d.orderId), status: d.status, executedQty: d.executedQty, price: d.fills?.[0]?.price || d.price || '0' };
}

async function bybitOrder(apiKey: string, secret: string, symbol: string, side: string, qty: number) {
  const sym = toExSym(symbol);
  const ts = Date.now().toString();
  const recv = '5000';
  const body = JSON.stringify({ category: 'spot', symbol: sym, side: side === 'buy' ? 'Buy' : 'Sell', orderType: 'Market', qty: String(qty) });
  const sig = crypto.createHmac('sha256', secret).update(ts + apiKey + recv + body).digest('hex');
  const r = await fetch('https://api.bybit.com/v5/order/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': ts, 'X-BAPI-RECV-WINDOW': recv, 'X-BAPI-SIGN': sig },
    body, signal: AbortSignal.timeout(12000),
  });
  const d = await r.json();
  if (d.retCode !== 0) throw new Error(d.retMsg || 'Bybit siparis hatasi');
  return { orderId: d.result?.orderId, status: 'NEW', executedQty: String(qty), price: '0' };
}

async function okxOrder(apiKey: string, secret: string, passphrase: string, symbol: string, side: string, sz: number) {
  const instId = symbol.replace('/', '-').replace('USDT', '-USDT').toUpperCase();
  const ts = new Date().toISOString();
  const body = JSON.stringify({ instId, tdMode: 'cash', side: side.toLowerCase(), ordType: 'market', sz: String(sz) });
  const sig = crypto.createHmac('sha256', secret).update(ts + 'POST' + '/api/v5/trade/order' + body).digest('base64');
  const r = await fetch('https://www.okx.com/api/v5/trade/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'OK-ACCESS-KEY': apiKey, 'OK-ACCESS-SIGN': sig, 'OK-ACCESS-TIMESTAMP': ts, 'OK-ACCESS-PASSPHRASE': passphrase },
    body, signal: AbortSignal.timeout(12000),
  });
  const d = await r.json();
  if (d.code !== '0') throw new Error(d.data?.[0]?.sMsg || d.msg || 'OKX siparis hatasi');
  return { orderId: d.data?.[0]?.ordId, status: 'NEW', executedQty: String(sz), price: '0' };
}

export async function POST(req: NextRequest) {
  try {
    const { exchange, apiKey, apiSecret, passphrase, symbol, side, quoteAmount, baseAmount } = await req.json();
    if (!apiKey || !apiSecret || !symbol || !side) {
      return NextResponse.json({ ok: false, error: 'Eksik parametre' }, { status: 400 });
    }
    let result;
    if (exchange === 'binance') result = await binanceOrder(apiKey, apiSecret, symbol, side, quoteAmount, baseAmount);
    else if (exchange === 'bybit') result = await bybitOrder(apiKey, apiSecret, symbol, side, baseAmount || quoteAmount);
    else if (exchange === 'okx') result = await okxOrder(apiKey, apiSecret, passphrase || '', symbol, side, baseAmount || quoteAmount);
    else return NextResponse.json({ ok: false, error: 'Desteklenmeyen borsa' }, { status: 400 });
    return NextResponse.json({ ok: true, exchange, symbol, side, timestamp: new Date().toISOString(), ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Islem hatasi' }, { status: 500 });
  }
}
