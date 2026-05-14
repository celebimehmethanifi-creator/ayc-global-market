"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { webApi } from "@/lib/api";

const DEMO_INITIAL = 10000;
const STORAGE_KEY = "ayc_demo_api_fallback_v1";
const POLL_INTERVAL_MS = 15000;

/* ¦¦¦ Types ¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦ */
export interface DemoTrade {
  id: string;
  symbol: string;
  name: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  quantity: number;
  investedUSD: number;
  openedAt: number;
}
export interface ClosedDemoTrade extends DemoTrade {
  exitPrice: number;
  closedAt: number;
  pnlUSD: number;
  pnlPct: number;
}
export interface DemoState {
  balance: number;
  initialBalance: number;
  equity: number;
  availableBalance: number;
  usedMargin: number;
  openPnl: number;
  realizedPnl: number;
  totalPnl: number;
  winRate: number;
  mode: "demo";
  source: "api" | "local-fallback";
  openTrades: DemoTrade[];
  closedTrades: ClosedDemoTrade[];
  createdAt: number;
}
export interface DemoCtx {
  demo: DemoState;
  totalValue: number;
  totalPnlUSD: number;
  totalPnlPct: number;
  openPnlUSD: number;
  openTrade: (
    symbol: string,
    name: string,
    direction: "LONG" | "SHORT",
    price: number,
    investedUSD: number,
    options?: {
      leverage?: number;
      stopLoss?: number | null;
      takeProfit?: number | null;
    },
  ) => Promise<boolean>;
  closeTrade: (id: string, currentPrice?: number) => Promise<boolean>;
  reset: () => Promise<void>;
  refresh: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

/* ¦¦¦ Init ¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦ */
function initState(): DemoState {
  return {
    balance: DEMO_INITIAL,
    initialBalance: DEMO_INITIAL,
    equity: DEMO_INITIAL,
    availableBalance: DEMO_INITIAL,
    usedMargin: 0,
    openPnl: 0,
    realizedPnl: 0,
    totalPnl: 0,
    winRate: 0,
    mode: "demo",
    source: "local-fallback",
    openTrades: [],
    closedTrades: [],
    createdAt: Date.now(),
  };
}

const Ctx = createContext<DemoCtx | null>(null);

function safeNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function loadFallbackState(): DemoState {
  if (typeof window === "undefined") return initState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initState();
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return {
      ...initState(),
      ...parsed,
      source: "local-fallback",
    };
  } catch {
    return initState();
  }
}

function toOpenTrade(position: any): DemoTrade {
  return {
    id: String(position.id),
    symbol: String(position.symbol || ""),
    name: String(position.symbol || ""),
    direction: String(position.side || "LONG").toUpperCase() === "SHORT" ? "SHORT" : "LONG",
    entryPrice: safeNum(position.entryPrice),
    quantity: safeNum(position.quantity),
    investedUSD: safeNum(position.notional),
    openedAt: new Date(String(position.openedAt || Date.now())).getTime(),
  };
}

function toClosedTrade(item: any): ClosedDemoTrade {
  const entry = safeNum(item.entryPrice);
  const exit = safeNum(item.exitPrice);
  const side = String(item.side || "LONG").toUpperCase() === "SHORT" ? "SHORT" : "LONG";
  const pnl = safeNum(item.realizedPnL);
  const invested = safeNum(item.investedUSD, safeNum(item.notional, Math.abs(entry)));
  const qty = entry > 0 ? invested / entry : 0;

  return {
    id: String(item.id || item.positionId || `closed_${Date.now()}`),
    symbol: String(item.symbol || ""),
    name: String(item.symbol || ""),
    direction: side,
    entryPrice: entry,
    quantity: qty,
    investedUSD: invested,
    openedAt: new Date(String(item.openedAt || Date.now())).getTime(),
    exitPrice: exit,
    closedAt: new Date(String(item.closedAt || Date.now())).getTime(),
    pnlUSD: pnl,
    pnlPct: safeNum(item.realizedPnLPct, invested > 0 ? (pnl / invested) * 100 : 0),
  };
}

function fromApiPayload(payload: any): DemoState {
  const account = payload?.account || {};
  const positions = Array.isArray(payload?.positions) ? payload.positions : [];
  const history = Array.isArray(payload?.history) ? payload.history : [];
  const available = safeNum(account.availableBalance, DEMO_INITIAL);
  const baseBalance = safeNum(account.balance, DEMO_INITIAL);

  return {
    balance: baseBalance,
    initialBalance: baseBalance,
    equity: safeNum(account.equity, baseBalance),
    availableBalance: available,
    usedMargin: safeNum(account.usedMargin),
    openPnl: safeNum(account.openPnL),
    realizedPnl: safeNum(account.realizedPnL),
    totalPnl: safeNum(account.totalPnL),
    winRate: safeNum(account.winRate),
    mode: "demo",
    source: "api",
    openTrades: positions.map(toOpenTrade),
    closedTrades: history.map(toClosedTrade),
    createdAt: new Date(String(account.createdAt || Date.now())).getTime(),
  };
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState<DemoState>(initState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await webApi.get("/demo/account", { timeout: 12000 });
      const next = fromApiPayload(response.data);
      setDemo(next);
      setError(null);
    } catch {
      const fallback = loadFallbackState();
      setDemo(fallback);
      setError("Demo servisine erisilemedi. Yerel fallback kullaniliyor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
    } catch {}
  }, [demo]);

  const openPnlUSD = demo.openPnl;
  const totalValue = demo.equity;
  const totalPnlUSD = demo.totalPnl;
  const totalPnlPct = demo.initialBalance > 0 ? (totalPnlUSD / demo.initialBalance) * 100 : 0;

  const openTrade = useCallback(
    async (
      symbol: string,
      _name: string,
      direction: "LONG" | "SHORT",
      _price: number,
      investedUSD: number,
      options?: {
        leverage?: number;
        stopLoss?: number | null;
        takeProfit?: number | null;
      },
    ): Promise<boolean> => {
      try {
        const leverage = Number(options?.leverage);
        const stopLoss = Number(options?.stopLoss);
        const takeProfit = Number(options?.takeProfit);

        const response = await webApi.post(
          "/demo/order",
          {
            symbol,
            side: direction,
            notional: investedUSD,
            leverage: Number.isFinite(leverage) ? leverage : 1,
            ...(Number.isFinite(stopLoss) && stopLoss > 0 ? { stopLoss } : {}),
            ...(Number.isFinite(takeProfit) && takeProfit > 0 ? { takeProfit } : {}),
          },
          { timeout: 12000 },
        );
        if (!response.data?.ok) {
          setError(String(response.data?.detail || "Demo işlem açılamadı."));
          return false;
        }
        await refresh();
        return true;
      } catch (err: any) {
        setError(String(err?.response?.data?.detail || "Demo işlem açılamadı."));
        return false;
      }
    },
    [refresh],
  );

  const closeTrade = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await webApi.post("/demo/close", { positionId: id }, { timeout: 12000 });
        if (!response.data?.ok) {
          setError(String(response.data?.detail || "Pozisyon kapatılamadı."));
          return false;
        }
        await refresh();
        return true;
      } catch (err: any) {
        setError(String(err?.response?.data?.detail || "Pozisyon kapatılamadı."));
        return false;
      }
    },
    [refresh],
  );

  const reset = useCallback(async () => {
    try {
      await webApi.post("/demo/reset", {}, { timeout: 12000 });
      await refresh();
    } catch {
      setDemo(initState());
      setError("Demo reset API erişilemedi, yerel reset uygulandı.");
    }
  }, [refresh]);

  const value = useMemo<DemoCtx>(
    () => ({
      demo,
      totalValue,
      totalPnlUSD,
      totalPnlPct,
      openPnlUSD,
      openTrade,
      closeTrade,
      reset,
      refresh,
      loading,
      error,
    }),
    [closeTrade, demo, error, loading, openPnlUSD, openTrade, refresh, reset, totalPnlPct, totalPnlUSD, totalValue],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useDemo = (): DemoCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo must be inside DemoProvider");
  return c;
};

