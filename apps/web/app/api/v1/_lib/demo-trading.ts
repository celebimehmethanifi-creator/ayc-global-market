import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { USERS_BY_ID, getUserFromAuthHeader } from "./auth";

const DEMO_MODE = "demo" as const;
const DEMO_SESSION_COOKIE = "ayc_demo_session";
const DEMO_DEFAULT_BALANCE = 10_000;
const DEMO_MAX_NOTIONAL = 1_000_000;
const DEMO_DEFAULT_MAX_LEVERAGE = 10;
const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

type PositionSide = "LONG" | "SHORT";
type OrderSide = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";
type OrderStatus = "FILLED" | "OPEN" | "CANCELLED" | "REJECTED";
type PositionStatus = "OPEN" | "CLOSED";

interface DemoAccount {
  id: string;
  userId: string | null;
  demoSessionId: string | null;
  balance: number;
  equity: number;
  availableBalance: number;
  usedMargin: number;
  openPnL: number;
  realizedPnL: number;
  totalPnL: number;
  winRate: number;
  createdAt: string;
  updatedAt: string;
  mode: typeof DEMO_MODE;
}

interface DemoOrder {
  id: string;
  accountId: string;
  symbol: string;
  side: OrderSide;
  positionSide: PositionSide;
  orderType: OrderType;
  status: OrderStatus;
  quantity: number;
  notional: number;
  price: number;
  leverage: number;
  stopLoss: number | null;
  takeProfit: number | null;
  createdAt: string;
  filledAt: string | null;
}

interface DemoPosition {
  id: string;
  accountId: string;
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  marginUsed: number;
  notional: number;
  openPnL: number;
  openPnLPct: number;
  stopLoss: number | null;
  takeProfit: number | null;
  status: PositionStatus;
  openedAt: string;
  closedAt: string | null;
  closePrice: number | null;
  realizedPnL: number | null;
}

interface DemoTradeHistory {
  id: string;
  positionId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  leverage: number;
  marginUsed: number;
  realizedPnL: number;
  realizedPnLPct: number;
  openedAt: string;
  closedAt: string;
  reason: string;
}

interface DemoStoreRecord {
  account: DemoAccount;
  orders: DemoOrder[];
  positions: DemoPosition[];
  history: DemoTradeHistory[];
}

interface DemoIdentity {
  ownerKey: string;
  userId: string | null;
  demoSessionId: string | null;
  riskLevel: "low" | "medium" | "high" | null;
  maxLeverage: number;
  applySessionCookie: (res: NextResponse) => void;
}

declare global {
  // eslint-disable-next-line no-var
  var __AYC_DEMO_TRADING_STORE: Map<string, DemoStoreRecord> | undefined;
}

if (!globalThis.__AYC_DEMO_TRADING_STORE) {
  globalThis.__AYC_DEMO_TRADING_STORE = new Map<string, DemoStoreRecord>();
}

const STORE = globalThis.__AYC_DEMO_TRADING_STORE;

function nowIso(): string {
  return new Date().toISOString();
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSymbol(raw: string): string {
  const clean = String(raw || "").trim().toUpperCase().replace(/\s+/g, "").replace("/", "");
  if (!clean) return clean;
  if (clean.endsWith(".IS")) return clean;
  if (clean.includes("=")) return clean;
  if (
    clean.endsWith("USDT") ||
    clean.endsWith("USD") ||
    clean.endsWith("TRY") ||
    clean.endsWith("JPY") ||
    clean.endsWith("EUR")
  ) {
    return clean;
  }
  if (/^[A-Z]{2,6}$/.test(clean)) return `${clean}USDT`;
  return clean;
}

function toOrderSide(side: PositionSide): OrderSide {
  return side === "LONG" ? "BUY" : "SELL";
}

function isFinitePositive(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function parseOptionalPositive(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function inferMaxLeverage(riskLevel: "low" | "medium" | "high" | null): number {
  if (riskLevel === "low") return 2;
  if (riskLevel === "medium") return 5;
  if (riskLevel === "high") return 10;
  return DEMO_DEFAULT_MAX_LEVERAGE;
}

function newDemoAccount(accountId: string, userId: string | null, demoSessionId: string | null): DemoAccount {
  const now = nowIso();
  return {
    id: accountId,
    userId,
    demoSessionId,
    balance: DEMO_DEFAULT_BALANCE,
    equity: DEMO_DEFAULT_BALANCE,
    availableBalance: DEMO_DEFAULT_BALANCE,
    usedMargin: 0,
    openPnL: 0,
    realizedPnL: 0,
    totalPnL: 0,
    winRate: 0,
    createdAt: now,
    updatedAt: now,
    mode: DEMO_MODE,
  };
}

function createRecord(accountId: string, userId: string | null, demoSessionId: string | null): DemoStoreRecord {
  return {
    account: newDemoAccount(accountId, userId, demoSessionId),
    orders: [],
    positions: [],
    history: [],
  };
}

function getOrCreateRecord(identity: DemoIdentity): DemoStoreRecord {
  const existing = STORE.get(identity.ownerKey);
  if (existing) return existing;
  const created = createRecord(identity.ownerKey, identity.userId, identity.demoSessionId);
  STORE.set(identity.ownerKey, created);
  return created;
}

async function fetchLivePrices(req: NextRequest, symbols: string[]): Promise<Record<string, number>> {
  const uniq = Array.from(new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean)));
  if (!uniq.length) return {};
  const url = new URL(`/api/v1/prices/live?symbols=${encodeURIComponent(uniq.join(","))}`, req.url);
  const res = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return {};
  const data = await res.json().catch(() => ({}));
  const out: Record<string, number> = {};
  const prices = data?.prices || {};
  for (const key of Object.keys(prices)) {
    const n = Number(prices[key]?.price);
    if (Number.isFinite(n) && n > 0) out[normalizeSymbol(key)] = n;
  }
  return out;
}

function computeOpenPnl(side: PositionSide, entryPrice: number, markPrice: number, quantity: number): number {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(markPrice) || !Number.isFinite(quantity)) return 0;
  if (entryPrice <= 0 || markPrice <= 0 || quantity <= 0) return 0;
  if (side === "LONG") return (markPrice - entryPrice) * quantity;
  return (entryPrice - markPrice) * quantity;
}

function computeRealizedPnlPct(side: PositionSide, entryPrice: number, exitPrice: number, leverage: number): number {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return 0;
  if (!Number.isFinite(exitPrice) || exitPrice <= 0) return 0;
  if (!Number.isFinite(leverage) || leverage <= 0) return 0;
  if (side === "LONG") return ((exitPrice - entryPrice) / entryPrice) * leverage * 100;
  return ((entryPrice - exitPrice) / entryPrice) * leverage * 100;
}

function computeAccountMetrics(record: DemoStoreRecord): DemoAccount {
  const now = nowIso();
  const usedMargin = record.positions.reduce((sum, position) => sum + Math.max(0, Number(position.marginUsed) || 0), 0);
  const openPnL = record.positions.reduce((sum, position) => sum + (Number(position.openPnL) || 0), 0);
  const realizedPnL = record.history.reduce((sum, item) => sum + (Number(item.realizedPnL) || 0), 0);
  const wins = record.history.filter((item) => (Number(item.realizedPnL) || 0) > 0).length;
  const winRate = record.history.length > 0 ? (wins / record.history.length) * 100 : 0;
  // `balance` is the fixed demo principal; realized/open PnL are derived ledgers added on top.
  const equity = record.account.balance + realizedPnL + openPnL;
  const availableBalance = record.account.balance + realizedPnL - usedMargin;
  const totalPnL = realizedPnL + openPnL;
  record.account = {
    ...record.account,
    equity: Number.isFinite(equity) ? equity : record.account.balance,
    availableBalance: Number.isFinite(availableBalance) ? availableBalance : record.account.balance,
    usedMargin: Number.isFinite(usedMargin) ? usedMargin : 0,
    openPnL: Number.isFinite(openPnL) ? openPnL : 0,
    realizedPnL: Number.isFinite(realizedPnL) ? realizedPnL : 0,
    totalPnL: Number.isFinite(totalPnL) ? totalPnL : 0,
    winRate: Number.isFinite(winRate) ? clampNumber(winRate, 0, 100) : 0,
    updatedAt: now,
  };
  return record.account;
}

async function syncPositionsWithMarket(req: NextRequest, record: DemoStoreRecord): Promise<void> {
  if (!record.positions.length) {
    computeAccountMetrics(record);
    return;
  }
  const symbols = record.positions.map((position) => position.symbol);
  const prices = await fetchLivePrices(req, symbols);
  record.positions = record.positions.map((position) => {
    const normalized = normalizeSymbol(position.symbol);
    const mark = prices[normalized] && prices[normalized] > 0 ? prices[normalized] : position.markPrice || position.entryPrice;
    const openPnL = computeOpenPnl(position.side, position.entryPrice, mark, position.quantity);
    const notional = position.entryPrice * position.quantity;
    const openPnLPct = notional > 0 ? (openPnL / notional) * 100 : 0;
    return {
      ...position,
      symbol: normalized,
      markPrice: mark,
      openPnL: Number.isFinite(openPnL) ? openPnL : 0,
      openPnLPct: Number.isFinite(openPnLPct) ? openPnLPct : 0,
      updatedAt: nowIso(),
    } as DemoPosition & { updatedAt?: string };
  });
  computeAccountMetrics(record);
}

export async function resolveDemoIdentity(req: NextRequest): Promise<DemoIdentity> {
  const payload = await getUserFromAuthHeader(req);
  if (payload?.sub) {
    const persisted = USERS_BY_ID.get(payload.sub);
    const riskLevel =
      persisted?.risk_level === "low" || persisted?.risk_level === "medium" || persisted?.risk_level === "high"
        ? persisted.risk_level
        : null;
    return {
      ownerKey: `user:${payload.sub}`,
      userId: payload.sub,
      demoSessionId: null,
      riskLevel,
      maxLeverage: inferMaxLeverage(riskLevel),
      applySessionCookie: (_res: NextResponse) => {},
    };
  }

  const existingSession = req.cookies.get(DEMO_SESSION_COOKIE)?.value;
  const sessionId = existingSession || `demo_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const shouldSetCookie = !existingSession;

  return {
    ownerKey: `guest:${sessionId}`,
    userId: null,
    demoSessionId: sessionId,
    riskLevel: null,
    maxLeverage: DEMO_DEFAULT_MAX_LEVERAGE,
    applySessionCookie: (res: NextResponse) => {
      if (!shouldSetCookie) return;
      res.cookies.set(DEMO_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "lax",
        path: "/",
        maxAge: DEMO_COOKIE_MAX_AGE,
      });
    },
  };
}

export function createResponse(identity: DemoIdentity, payload: unknown, status = 200): NextResponse {
  const res = NextResponse.json(payload, { status });
  identity.applySessionCookie(res);
  return res;
}

export async function getSynchronizedRecord(req: NextRequest, identity: DemoIdentity): Promise<DemoStoreRecord> {
  const record = getOrCreateRecord(identity);
  await syncPositionsWithMarket(req, record);
  STORE.set(identity.ownerKey, record);
  return record;
}

function toNoDataError(message: string) {
  return {
    ok: false,
    detail: message,
    mode: DEMO_MODE,
  };
}

export function toView(record: DemoStoreRecord) {
  return {
    mode: DEMO_MODE,
    warning: "Demo state is stored in-memory and can reset after redeploy/cold start.",
    account: record.account,
    positions: record.positions,
    orders: record.orders,
    history: record.history,
  };
}

export async function placeDemoOrder(
  req: NextRequest,
  identity: DemoIdentity,
  body: unknown,
): Promise<{ status: number; payload: unknown }> {
  const b = (body || {}) as Record<string, unknown>;
  const symbol = normalizeSymbol(String(b.symbol || ""));
  const side = String(b.side || "").toUpperCase();
  const notional = Number(b.notional);
  const leverage = Number(b.leverage);
  const stopLoss = parseOptionalPositive(b.stopLoss);
  const takeProfit = parseOptionalPositive(b.takeProfit);

  if (!symbol) return { status: 400, payload: toNoDataError("symbol gerekli.") };
  if (side !== "LONG" && side !== "SHORT") return { status: 400, payload: toNoDataError("side LONG veya SHORT olmalı.") };
  if (!Number.isFinite(notional) || notional <= 0) return { status: 400, payload: toNoDataError("Geçerli notional girin.") };
  if (notional > DEMO_MAX_NOTIONAL) return { status: 400, payload: toNoDataError("Notional demo limitini aşıyor.") };

  const maxAllowedLeverage = identity.maxLeverage;
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > maxAllowedLeverage) {
    return {
      status: 400,
      payload: toNoDataError(
        `Kaldıraç 1 ile ${maxAllowedLeverage} arasında olmalıdır. Leverage must be between 1 and ${maxAllowedLeverage}.`,
      ),
    };
  }

  if (b.stopLoss != null && stopLoss == null) return { status: 400, payload: toNoDataError("Geçerli stopLoss girin.") };
  if (b.takeProfit != null && takeProfit == null) return { status: 400, payload: toNoDataError("Geçerli takeProfit girin.") };

  const record = await getSynchronizedRecord(req, identity);
  if (record.account.availableBalance <= 0) {
    return { status: 400, payload: toNoDataError("Yetersiz demo bakiye.") };
  }

  if (notional > record.account.availableBalance) {
    return { status: 400, payload: toNoDataError("Notional kullanılabilir bakiyeyi aşıyor.") };
  }

  const prices = await fetchLivePrices(req, [symbol]);
  const entryPrice = prices[symbol];
  if (!entryPrice || !Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { status: 400, payload: toNoDataError("Bu varlık için demo işlem fiyatı alınamadı.") };
  }

  const quantity = notional / entryPrice;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { status: 400, payload: toNoDataError("Geçerli quantity hesaplanamadı.") };
  }

  const marginUsed = notional / leverage;
  const now = nowIso();
  const positionId = `dp_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;

  const position: DemoPosition = {
    id: positionId,
    accountId: record.account.id,
    symbol,
    side: side as PositionSide,
    quantity,
    entryPrice,
    markPrice: entryPrice,
    leverage,
    marginUsed,
    notional,
    openPnL: 0,
    openPnLPct: 0,
    stopLoss,
    takeProfit,
    status: "OPEN",
    openedAt: now,
    closedAt: null,
    closePrice: null,
    realizedPnL: null,
  };

  const order: DemoOrder = {
    id: `do_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`,
    accountId: record.account.id,
    symbol,
    side: toOrderSide(position.side),
    positionSide: position.side,
    orderType: "MARKET",
    status: "FILLED",
    quantity,
    notional,
    price: entryPrice,
    leverage,
    stopLoss,
    takeProfit,
    createdAt: now,
    filledAt: now,
  };

  record.positions.unshift(position);
  record.orders.unshift(order);
  computeAccountMetrics(record);
  STORE.set(identity.ownerKey, record);

  return {
    status: 201,
    payload: {
      ok: true,
      mode: DEMO_MODE,
      order,
      position,
      account: record.account,
      warning: "Demo işlem gerçek exchange emri göndermez.",
    },
  };
}

export async function closeDemoPosition(
  req: NextRequest,
  identity: DemoIdentity,
  body: unknown,
): Promise<{ status: number; payload: unknown }> {
  const b = (body || {}) as Record<string, unknown>;
  const positionId = String(b.positionId || "").trim();
  const reason = String(b.reason || "").trim() || "manual_close";
  if (!positionId) return { status: 400, payload: toNoDataError("positionId gerekli.") };

  const record = await getSynchronizedRecord(req, identity);
  const idx = record.positions.findIndex((position) => position.id === positionId);
  if (idx < 0) return { status: 404, payload: toNoDataError("Pozisyon bulunamadı.") };

  const position = record.positions[idx];
  if (position.status !== "OPEN") {
    return { status: 400, payload: toNoDataError("Pozisyon zaten kapalı.") };
  }

  const prices = await fetchLivePrices(req, [position.symbol]);
  const closePrice = prices[position.symbol] || position.markPrice || position.entryPrice;
  if (!closePrice || closePrice <= 0) {
    return { status: 400, payload: toNoDataError("Pozisyon kapatma fiyatı alınamadı.") };
  }

  const realizedPnLRaw = computeOpenPnl(position.side, position.entryPrice, closePrice, position.quantity);
  const realizedPnL = Number.isFinite(realizedPnLRaw) ? realizedPnLRaw : 0;
  const realizedPnLPctRaw = computeRealizedPnlPct(position.side, position.entryPrice, closePrice, position.leverage);
  const realizedPnLPct = Number.isFinite(realizedPnLPctRaw) ? realizedPnLPctRaw : 0;
  const closedAt = nowIso();

  const closedPosition: DemoPosition = {
    ...position,
    markPrice: closePrice,
    status: "CLOSED",
    closedAt,
    closePrice,
    openPnL: 0,
    openPnLPct: 0,
    realizedPnL,
  };

  record.positions.splice(idx, 1);
  const historyItem: DemoTradeHistory = {
    id: `dh_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`,
    positionId: position.id,
    symbol: position.symbol,
    side: position.side,
    entryPrice: position.entryPrice,
    exitPrice: closePrice,
    quantity: position.quantity,
    leverage: position.leverage,
    marginUsed: position.marginUsed,
    realizedPnL,
    realizedPnLPct,
    openedAt: position.openedAt,
    closedAt,
    reason,
  };
  record.history.unshift(historyItem);

  record.orders.unshift({
    id: `do_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`,
    accountId: record.account.id,
    symbol: position.symbol,
    side: position.side === "LONG" ? "SELL" : "BUY",
    positionSide: position.side,
    orderType: "MARKET",
    status: "FILLED",
    quantity: position.quantity,
    notional: closePrice * position.quantity,
    price: closePrice,
    leverage: position.leverage,
    stopLoss: position.stopLoss,
    takeProfit: position.takeProfit,
    createdAt: closedAt,
    filledAt: closedAt,
  });

  computeAccountMetrics(record);
  STORE.set(identity.ownerKey, record);

  return {
    status: 200,
    payload: {
      ok: true,
      mode: DEMO_MODE,
      closed: closedPosition,
      account: record.account,
      trade: historyItem,
      historyItem,
    },
  };
}

export async function resetDemoAccount(req: NextRequest, identity: DemoIdentity): Promise<DemoStoreRecord> {
  const reset = createRecord(identity.ownerKey, identity.userId, identity.demoSessionId);
  await syncPositionsWithMarket(req, reset);
  STORE.set(identity.ownerKey, reset);
  return reset;
}


