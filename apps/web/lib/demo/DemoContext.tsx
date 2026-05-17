"use client";
import React, {
  createContext, useCallback, useContext,
  useEffect, useState,
} from "react";
import { usePrices } from "@/lib/prices/PriceContext";

const DEMO_INITIAL = 10000;          // $10,000 virtual USD
const STORAGE_KEY  = "ayc_demo_v2";  // bumped from v1: drop pre-seeded portfolio fixtures
const LEGACY_KEYS  = ["ayc_demo_v1", "ayc_portfolio", "ayc_portfolio_seed"];

/* ─── Types ────────────────────────────────────────────────── */
export interface DemoTrade {
  id: string;
  symbol: string;
  name: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  quantity: number;       // units of asset
  investedUSD: number;    // how much balance was used
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
    symbol: string, name: string,
    direction: "LONG" | "SHORT",
    price: number, investedUSD: number
  ) => boolean;
  closeTrade: (id: string, currentPrice: number) => void;
  reset: () => void;
}

/* ─── Init ─────────────────────────────────────────────────── */
function initState(): DemoState {
  return {
    balance: DEMO_INITIAL,
    initialBalance: DEMO_INITIAL,
    openTrades: [],
    closedTrades: [],
    createdAt: Date.now(),
  };
}

const Ctx = createContext<DemoCtx | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState<DemoState>(initState);
  const prices = usePrices();

  /* load from localStorage + clear legacy seeds */
  useEffect(() => {
    try {
      // Drop legacy keys (pre-seeded portfolio with BTCUSDT/ETHUSDT/NVDA/AAPL/XAUUSD)
      for (const k of LEGACY_KEYS) {
        try { localStorage.removeItem(k); } catch {}
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Only keep trades that originated from a real demo order
      const openTrades = Array.isArray(parsed?.openTrades)
        ? parsed.openTrades.filter((t: any) => t && typeof t.id === "string" && t.id.startsWith("dt_"))
        : [];
      const closedTrades = Array.isArray(parsed?.closedTrades)
        ? parsed.closedTrades.filter((t: any) => t && typeof t.id === "string" && t.id.startsWith("dt_"))
        : [];
      setDemo({
        balance: typeof parsed?.balance === "number" && Number.isFinite(parsed.balance) ? parsed.balance : DEMO_INITIAL,
        initialBalance: DEMO_INITIAL,
        openTrades,
        closedTrades,
        createdAt: typeof parsed?.createdAt === "number" ? parsed.createdAt : Date.now(),
      });
    } catch {}
  }, []);

  /* persist to localStorage */
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(demo)); } catch {}
  }, [demo]);

  /* helper: get live price */
  const lp = (sym: string) => {
    const e = prices[sym] ?? prices[sym + "USDT"] ?? prices[sym.replace("/", "").toUpperCase()];
    return e?.price ?? 0;
  };

  /* open P&L across all open trades */
  const openPnlUSD = demo.openTrades.reduce((sum, t) => {
    const cur = lp(t.symbol);
    if (!cur) return sum;
    const pnl =
      t.direction === "LONG"
        ? (cur - t.entryPrice) * t.quantity
        : (t.entryPrice - cur) * t.quantity;
    return sum + pnl;
  }, 0);

  const lockedUSD   = demo.openTrades.reduce((s, t) => s + t.investedUSD, 0);
  const totalValue  = demo.balance + lockedUSD + openPnlUSD;
  const totalPnlUSD = totalValue - DEMO_INITIAL;
  const totalPnlPct = (totalPnlUSD / DEMO_INITIAL) * 100;

  /* open trade */
  const openTrade = useCallback(
    (symbol: string, name: string, direction: "LONG" | "SHORT", price: number, investedUSD: number): boolean => {
      if (price <= 0 || investedUSD <= 0) return false;
      setDemo(prev => {
        if (investedUSD > prev.balance) return prev;
        const t: DemoTrade = {
          id: `dt_${Date.now()}`,
          symbol, name, direction,
          entryPrice: price,
          quantity: investedUSD / price,
          investedUSD,
          openedAt: Date.now(),
        };
        return { ...prev, balance: prev.balance - investedUSD, openTrades: [...prev.openTrades, t] };
      });
      return true;
    },
    []
  );

  /* close trade */
  const closeTrade = useCallback((id: string, currentPrice: number) => {
    setDemo(prev => {
      const t = prev.openTrades.find(x => x.id === id);
      if (!t) return prev;
      const pnlUSD = t.direction === "LONG"
        ? (currentPrice - t.entryPrice) * t.quantity
        : (t.entryPrice - currentPrice) * t.quantity;
      const closed: ClosedDemoTrade = {
        ...t, exitPrice: currentPrice, closedAt: Date.now(),
        pnlUSD, pnlPct: (pnlUSD / t.investedUSD) * 100,
      };
      return {
        ...prev,
        balance: prev.balance + t.investedUSD + pnlUSD,
        openTrades: prev.openTrades.filter(x => x.id !== id),
        closedTrades: [closed, ...prev.closedTrades],
      };
    });
  }, []);

  const reset = useCallback(() => setDemo(initState()), []);

  return (
    <Ctx.Provider value={{ demo, totalValue, totalPnlUSD, totalPnlPct, openPnlUSD, openTrade, closeTrade, reset }}>
      {children}
    </Ctx.Provider>
  );
}

export const useDemo = (): DemoCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo must be inside DemoProvider");
  return c;
};