import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Test broker connectivity - DO NOT STORE credentials server-side
export async function POST(req: NextRequest) {
  try {
    const { brokerId, credentials } = await req.json();

    switch (brokerId) {
      case "binance":
        return testBinance(credentials);
      case "bybit":
        return testBybit(credentials);
      case "okx":
        return testOKX(credentials);
      case "alpaca":
        return testAlpaca(credentials);
      case "algolab":
        return NextResponse.json({ success: true, balance: 0, message: "AlgoLab bağlantısı kaydedildi. SMS doğrulaması için AlgoLab panelini açın." });
      case "ibkr":
        return NextResponse.json({ success: true, balance: 0, message: "IBKR bilgileri kaydedildi. Masaüstünde CP Gateway'i başlatın." });
      case "metatrader5":
        return NextResponse.json({ success: true, balance: 0, message: "MT5 bilgileri kaydedildi. MetaTrader 5 uygulaması açıkken işlem yapılabilir." });
      default:
        return NextResponse.json({ success: false, error: "Bilinmeyen borsa." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Sunucu hatası." }, { status: 500 });
  }
}

async function testBinance(creds: Record<string, string>) {
  try {
    const { apiKey, secret } = creds;
    if (!apiKey || !secret) return NextResponse.json({ success: false, error: "API Key ve Secret gerekli." });
    const ts = Date.now();
    const params = `timestamp=${ts}`;
    const sig = crypto.createHmac("sha256", secret).update(params).digest("hex");
    const r = await fetch(`https://api.binance.com/api/v3/account?${params}&signature=${sig}`, {
      headers: { "X-MBX-APIKEY": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return NextResponse.json({ success: false, error: `Binance hatası: ${(err as Record<string,string>).msg || r.status}` });
    }
    const data = await r.json();
    const usdtBalance = (data.balances as Array<{asset:string;free:string}>)?.find((b) => b.asset === "USDT");
    const balance = parseFloat(usdtBalance?.free || "0");
    return NextResponse.json({ success: true, balance, message: "Binance bağlantısı doğrulandı." });
  } catch {
    return NextResponse.json({ success: false, error: "Binance'e bağlanılamadı." });
  }
}

async function testBybit(creds: Record<string, string>) {
  try {
    const { apiKey, secret } = creds;
    if (!apiKey || !secret) return NextResponse.json({ success: false, error: "API Key ve Secret gerekli." });
    const ts = String(Date.now());
    const recv = "5000";
    const params = "accountType=UNIFIED";
    const pre = ts + apiKey + recv + params;
    const sig = crypto.createHmac("sha256", secret).update(pre).digest("hex");
    const r = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${params}`, {
      headers: { "X-BAPI-API-KEY": apiKey, "X-BAPI-TIMESTAMP": ts, "X-BAPI-SIGN": sig, "X-BAPI-RECV-WINDOW": recv },
    });
    if (!r.ok) return NextResponse.json({ success: false, error: `Bybit hatası: ${r.status}` });
    const data = await r.json();
    if (data.retCode !== 0) return NextResponse.json({ success: false, error: `Bybit: ${data.retMsg}` });
    const balance = parseFloat(data.result?.list?.[0]?.totalEquity || "0");
    return NextResponse.json({ success: true, balance, message: "Bybit bağlantısı doğrulandı." });
  } catch {
    return NextResponse.json({ success: false, error: "Bybit'e bağlanılamadı." });
  }
}

async function testOKX(creds: Record<string, string>) {
  try {
    const { apiKey, secret, passphrase } = creds;
    if (!apiKey || !secret || !passphrase) return NextResponse.json({ success: false, error: "API Key, Secret ve Passphrase gerekli." });
    const ts = new Date().toISOString();
    const method = "GET";
    const path = "/api/v5/account/balance";
    const pre = ts + method + path + "";
    const sig = Buffer.from(crypto.createHmac("sha256", secret).update(pre).digest()).toString("base64");
    const r = await fetch(`https://www.okx.com${path}`, {
      headers: { "OK-ACCESS-KEY": apiKey, "OK-ACCESS-SIGN": sig, "OK-ACCESS-TIMESTAMP": ts, "OK-ACCESS-PASSPHRASE": passphrase },
    });
    if (!r.ok) return NextResponse.json({ success: false, error: `OKX hatası: ${r.status}` });
    const data = await r.json();
    if (data.code !== "0") return NextResponse.json({ success: false, error: `OKX: ${data.msg}` });
    const balance = parseFloat(data.data?.[0]?.totalEq || "0");
    return NextResponse.json({ success: true, balance, message: "OKX bağlantısı doğrulandı." });
  } catch {
    return NextResponse.json({ success: false, error: "OKX'e bağlanılamadı." });
  }
}

async function testAlpaca(creds: Record<string, string>) {
  try {
    const { apiKey, secret, paper } = creds;
    if (!apiKey || !secret) return NextResponse.json({ success: false, error: "API Key ve Secret Key gerekli." });
    const base = paper === "true" ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
    const r = await fetch(`${base}/v2/account`, {
      headers: { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": secret },
    });
    if (!r.ok) return NextResponse.json({ success: false, error: `Alpaca hatası: ${r.status}` });
    const data = await r.json();
    const balance = parseFloat(data.cash || data.equity || "0");
    return NextResponse.json({ success: true, balance, message: `Alpaca ${paper === "true" ? "Paper Trading " : ""}bağlantısı doğrulandı.` });
  } catch {
    return NextResponse.json({ success: false, error: "Alpaca'ya bağlanılamadı." });
  }
}
