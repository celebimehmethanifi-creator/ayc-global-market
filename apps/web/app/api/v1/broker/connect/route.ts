import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromAuthHeader } from "../../_lib/auth";
import { upsertExchangeCredential } from "../../_lib/exchange-vault";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SUPPORTED_EXCHANGES = new Set(["binance", "bybit", "okx"]);

async function testBinance(apiKey: string, secret: string) {
  const ts = Date.now();
  const params = `timestamp=${ts}&recvWindow=5000`;
  const sig = crypto.createHmac("sha256", secret).update(params).digest("hex");
  const r = await fetch(`https://api.binance.com/api/v3/account?${params}&signature=${sig}`, {
    headers: { "X-MBX-APIKEY": apiKey },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || "Binance hatasi");
  const usdt = d.balances?.find((b: any) => b.asset === "USDT");
  return { balance: parseFloat(usdt?.free || "0"), currency: "USDT" };
}

async function testBybit(apiKey: string, secret: string) {
  const ts = String(Date.now());
  const recv = "5000";
  const params = "accountType=UNIFIED";
  const pre = ts + apiKey + recv + params;
  const sig = crypto.createHmac("sha256", secret).update(pre).digest("hex");
  const r = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${params}`, {
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-SIGN": sig,
      "X-BAPI-RECV-WINDOW": recv,
    },
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json();
  if (data.retCode !== 0) throw new Error(data.retMsg || "Bybit hatasi");
  return {
    balance: parseFloat(data.result?.list?.[0]?.totalEquity || "0"),
    currency: "USDT",
  };
}

async function testOKX(apiKey: string, secret: string, passphrase: string) {
  const ts = new Date().toISOString();
  const path = "/api/v5/account/balance";
  const pre = ts + "GET" + path;
  const sig = Buffer.from(crypto.createHmac("sha256", secret).update(pre).digest()).toString("base64");
  const r = await fetch(`https://www.okx.com${path}`, {
    headers: {
      "OK-ACCESS-KEY": apiKey,
      "OK-ACCESS-SIGN": sig,
      "OK-ACCESS-TIMESTAMP": ts,
      "OK-ACCESS-PASSPHRASE": passphrase,
    },
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json();
  if (data.code !== "0") throw new Error(data.msg || "OKX hatasi");
  return { balance: parseFloat(data.data?.[0]?.totalEq || "0"), currency: "USD" };
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Yetkisiz." }, { status: 401 });
  }

  if (IS_PRODUCTION) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Production ortaminda istemciden dogrudan broker credential kabul edilmez.",
      },
      { status: 403 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const brokerId = String(body.brokerId || "").toLowerCase();
    const credentials = (body.credentials || {}) as Record<string, string>;

    if (!SUPPORTED_EXCHANGES.has(brokerId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Bu broker icin dogrudan API baglantisi devre disi.",
        },
        { status: 400 },
      );
    }

    const apiKey = String(credentials.apiKey || "").trim();
    const secret = String(credentials.secret || credentials.apiSecret || "").trim();
    const passphrase = String(credentials.passphrase || "").trim();
    if (!apiKey || !secret) {
      return NextResponse.json({ success: false, error: "API key ve secret gerekli." }, { status: 400 });
    }

    let testResult: { balance: number; currency: string };
    if (brokerId === "binance") testResult = await testBinance(apiKey, secret);
    else if (brokerId === "bybit") testResult = await testBybit(apiKey, secret);
    else testResult = await testOKX(apiKey, secret, passphrase);

    const stored = upsertExchangeCredential(user.sub, brokerId, {
      apiKey,
      apiSecret: secret,
      passphrase: passphrase || undefined,
    });

    return NextResponse.json({
      success: true,
      exchange: brokerId,
      connectionId: stored.connectionId,
      connectedAt: stored.createdAt,
      balance: testResult.balance,
      currency: testResult.currency,
      message: "Borsa baglantisi dogrulandi.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Sunucu hatasi." },
      { status: 500 },
    );
  }
}
