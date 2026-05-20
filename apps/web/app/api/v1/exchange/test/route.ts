import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromAuthHeader } from "../../_lib/auth";
import { upsertExchangeCredential } from "../../_lib/exchange-vault";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

async function testBinance(apiKey: string, secret: string) {
  const ts = Date.now();
  const params = `timestamp=${ts}&recvWindow=5000`;
  const sig = crypto.createHmac("sha256", secret).update(params).digest("hex");
  const r = await fetch(`https://api.binance.com/api/v3/account?${params}&signature=${sig}`, {
    headers: { "X-MBX-APIKEY": apiKey },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || "Binance API hatasi");
  const usdt = d.balances?.find((b: any) => b.asset === "USDT");
  return {
    ok: true,
    totalBalance: parseFloat(usdt?.free || "0"),
    currency: "USDT",
  };
}

async function testBybit(apiKey: string, secret: string) {
  const ts = Date.now().toString();
  const recv = "5000";
  const sig = crypto.createHmac("sha256", secret).update(ts + apiKey + recv).digest("hex");
  const r = await fetch("https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED", {
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recv,
      "X-BAPI-SIGN": sig,
    },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (d.retCode !== 0) throw new Error(d.retMsg || "Bybit API hatasi");
  const wallet = d.result?.list?.[0];
  return {
    ok: true,
    totalBalance: parseFloat(wallet?.totalEquity || "0"),
    currency: "USDT",
  };
}

async function testOkx(apiKey: string, secret: string, passphrase: string) {
  const ts = new Date().toISOString();
  const path = "/api/v5/account/balance";
  const msg = ts + "GET" + path;
  const sig = crypto.createHmac("sha256", secret).update(msg).digest("base64");
  const r = await fetch(`https://www.okx.com${path}`, {
    headers: {
      "OK-ACCESS-KEY": apiKey,
      "OK-ACCESS-SIGN": sig,
      "OK-ACCESS-TIMESTAMP": ts,
      "OK-ACCESS-PASSPHRASE": passphrase,
    },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (d.code !== "0") throw new Error(d.msg || "OKX API hatasi");
  return {
    ok: true,
    totalBalance: parseFloat(d.data?.[0]?.totalEq || "0"),
    currency: "USD",
  };
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Yetkisiz." }, { status: 401 });
  }

  if (IS_PRODUCTION) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Production ortaminda istemciden dogrudan API secret onboarding kapali.",
      },
      { status: 403 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const exchange = String(body.exchange || "").toLowerCase();
    const apiKey = String(body.apiKey || "").trim();
    const apiSecret = String(body.apiSecret || "").trim();
    const passphrase = String(body.passphrase || "").trim();

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { ok: false, error: "API key ve secret gerekli." },
        { status: 400 },
      );
    }

    let result: { ok: boolean; totalBalance: number; currency: string };
    if (exchange === "binance") {
      result = await testBinance(apiKey, apiSecret);
    } else if (exchange === "bybit") {
      result = await testBybit(apiKey, apiSecret);
    } else if (exchange === "okx") {
      result = await testOkx(apiKey, apiSecret, passphrase);
    } else {
      return NextResponse.json({ ok: false, error: "Desteklenmeyen borsa." }, { status: 400 });
    }

    const stored = upsertExchangeCredential(user.sub, exchange, {
      apiKey,
      apiSecret,
      passphrase: passphrase || undefined,
    });

    return NextResponse.json({
      ok: true,
      exchange,
      connectionId: stored.connectionId,
      connectedAt: stored.createdAt,
      totalBalance: result.totalBalance,
      currency: result.currency,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Baglanti hatasi." },
      { status: 500 },
    );
  }
}
