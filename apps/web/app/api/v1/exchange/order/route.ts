import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromAuthHeader } from "../../_lib/auth";
import { getExchangeCredential } from "../../_lib/exchange-vault";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const REAL_TRADING_GUARD = {
  enabled: false,
  code: "REAL_TRADING_DISABLED",
  reason:
    "Production ortaminda gercek emir akisi kapali. Sadece dry-run/paper trading izinli.",
  mandatoryControls: [
    "strong-authentication",
    "idempotency-keys",
    "2fa-step-up",
    "immutable-audit-log",
    "pre-trade-risk-confirmation",
  ],
};

function toExSym(sym: string): string {
  const cleaned = sym.replace("/", "").replace("-", "").toUpperCase();
  if (
    cleaned.endsWith("USDT") ||
    cleaned.endsWith("BTC") ||
    cleaned.endsWith("ETH") ||
    cleaned.endsWith("BNB")
  ) {
    return cleaned;
  }
  return `${cleaned}USDT`;
}

function dryRunResponse(input: {
  exchange: string;
  symbol: string;
  side: string;
  quoteAmount?: number;
  baseAmount?: number;
}) {
  return {
    ok: false,
    mode: "paper",
    guard: REAL_TRADING_GUARD,
    simulated: {
      exchange: input.exchange,
      symbol: toExSym(input.symbol),
      side: input.side,
      quoteAmount: input.quoteAmount || null,
      baseAmount: input.baseAmount || null,
      timestamp: new Date().toISOString(),
    },
  };
}

async function binanceOrder(
  apiKey: string,
  secret: string,
  symbol: string,
  side: string,
  quoteQty?: number,
  baseQty?: number,
) {
  const sym = toExSym(symbol);
  const ts = Date.now();
  const params = quoteQty
    ? `symbol=${sym}&side=${side.toUpperCase()}&type=MARKET&quoteOrderQty=${quoteQty}&timestamp=${ts}&recvWindow=5000`
    : `symbol=${sym}&side=${side.toUpperCase()}&type=MARKET&quantity=${baseQty}&timestamp=${ts}&recvWindow=5000`;
  const sig = crypto.createHmac("sha256", secret).update(params).digest("hex");
  const r = await fetch(`https://api.binance.com/api/v3/order?${params}&signature=${sig}`, {
    method: "POST",
    headers: { "X-MBX-APIKEY": apiKey },
    signal: AbortSignal.timeout(12000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || "Binance emir hatasi");
  return {
    orderId: String(d.orderId),
    status: d.status,
    executedQty: d.executedQty,
    price: d.fills?.[0]?.price || d.price || "0",
  };
}

async function bybitOrder(
  apiKey: string,
  secret: string,
  symbol: string,
  side: string,
  qty: number,
) {
  const sym = toExSym(symbol);
  const ts = Date.now().toString();
  const recv = "5000";
  const body = JSON.stringify({
    category: "spot",
    symbol: sym,
    side: side === "buy" ? "Buy" : "Sell",
    orderType: "Market",
    qty: String(qty),
  });
  const sig = crypto.createHmac("sha256", secret).update(ts + apiKey + recv + body).digest("hex");
  const r = await fetch("https://api.bybit.com/v5/order/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recv,
      "X-BAPI-SIGN": sig,
    },
    body,
    signal: AbortSignal.timeout(12000),
  });
  const d = await r.json();
  if (d.retCode !== 0) throw new Error(d.retMsg || "Bybit emir hatasi");
  return { orderId: d.result?.orderId, status: "NEW", executedQty: String(qty), price: "0" };
}

async function okxOrder(
  apiKey: string,
  secret: string,
  passphrase: string,
  symbol: string,
  side: string,
  qty: number,
) {
  const instId = symbol.replace("/", "-").replace("USDT", "-USDT").toUpperCase();
  const ts = new Date().toISOString();
  const body = JSON.stringify({
    instId,
    tdMode: "cash",
    side: side.toLowerCase(),
    ordType: "market",
    sz: String(qty),
  });
  const sig = crypto.createHmac("sha256", secret).update(ts + "POST" + "/api/v5/trade/order" + body).digest("base64");
  const r = await fetch("https://www.okx.com/api/v5/trade/order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": apiKey,
      "OK-ACCESS-SIGN": sig,
      "OK-ACCESS-TIMESTAMP": ts,
      "OK-ACCESS-PASSPHRASE": passphrase,
    },
    body,
    signal: AbortSignal.timeout(12000),
  });
  const d = await r.json();
  if (d.code !== "0") throw new Error(d.data?.[0]?.sMsg || d.msg || "OKX emir hatasi");
  return { orderId: d.data?.[0]?.ordId, status: "NEW", executedQty: String(qty), price: "0" };
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const connectionId = String(body.connectionId || "");
    const symbol = String(body.symbol || "");
    const side = String(body.side || "").toLowerCase();
    const quoteAmount = Number(body.quoteAmount || 0);
    const baseAmount = Number(body.baseAmount || 0);

    if (!connectionId || !symbol || !["buy", "sell"].includes(side)) {
      return NextResponse.json({ ok: false, error: "Eksik parametre." }, { status: 400 });
    }

    if (IS_PRODUCTION) {
      return NextResponse.json(
        dryRunResponse({
          exchange: String(body.exchange || "guarded"),
          symbol,
          side,
          quoteAmount: quoteAmount || undefined,
          baseAmount: baseAmount || undefined,
        }),
        { status: 403 },
      );
    }

    const connection = getExchangeCredential(user.sub, connectionId);
    if (!connection) {
      return NextResponse.json({ ok: false, error: "Borsa baglantisi bulunamadi." }, { status: 404 });
    }

    let result: {
      orderId: string;
      status: string;
      executedQty: string;
      price: string;
    };

    if (connection.exchange === "binance") {
      result = await binanceOrder(
        connection.apiKey,
        connection.apiSecret,
        symbol,
        side,
        quoteAmount || undefined,
        baseAmount || undefined,
      );
    } else if (connection.exchange === "bybit") {
      result = await bybitOrder(
        connection.apiKey,
        connection.apiSecret,
        symbol,
        side,
        baseAmount || quoteAmount,
      );
    } else if (connection.exchange === "okx") {
      result = await okxOrder(
        connection.apiKey,
        connection.apiSecret,
        connection.passphrase || "",
        symbol,
        side,
        baseAmount || quoteAmount,
      );
    } else {
      return NextResponse.json({ ok: false, error: "Desteklenmeyen borsa." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      mode: "live-dev-only",
      exchange: connection.exchange,
      symbol: toExSym(symbol),
      side,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Islem hatasi." },
      { status: 500 },
    );
  }
}
