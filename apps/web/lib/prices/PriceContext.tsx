"use client";
import {
  createContext, useContext, useEffect, useRef,
  useState, useCallback,
} from "react";

export interface PriceEntry {
  price: number;
  chg: number;      // 24h change %
  source: "binance-ws" | "finnhub" | "stooq" | "er-api" | "backend" | "coingecko";
  ts: number;       // epoch ms of last update
}

export type PriceMap = Record<string, PriceEntry>;

const PriceContext = createContext<PriceMap>({});

/* Binance WS pairs (crypto) */
const BINANCE_PAIRS = [
  "btcusdt","ethusdt","solusdt","bnbusdt","xrpusdt",
  "dogeusdt","adausdt","avaxusdt","linkusdt","dotusdt",
  "ltcusdt","maticusdt","uniusdt","atomusdt","nearusdt",
  "shibusdt","tonusdt","trxusdt","opusdt","arbusdt",
  // Extended crypto
  "ondousdt","suiusdt","aptusdt","pepeusdt","wldusdt",
  "injusdt","ftmusdt","seiusdt","renderusdt","fetusdt",
  "grtusdt","ldousdt","aaveusdt","mkrusdt","crvusdt",
  "pendleusdt","enausdt","eigenusdt","jupusdt","wifusdt",
  "bonkusdt","xlmusdt","vetusdt","icpusdt","filusdt",
  "hbarusdt","tiausdt","strkusdt","zkusdt","algousdt",
  "imxusdt","stxusdt","manausdt","sandusdt","axsusdt",
  "chzusdt","galausdt","celousdt","flokiusdt","notusdt",
];

const safeChg = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

const norm = (s: string) => s.replace("/","").toUpperCase();

export function PriceProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<PriceMap>({});
  const wsRef    = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout>>();

  /* ── 1. Binance WebSocket (crypto, real-time) ───────────────── */
  const connectBinance = useCallback(() => {
    if (typeof window === "undefined") return;
    const streams = BINANCE_PAIRS.map(p => `${p}@miniTicker`).join("/");
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const d = msg.data;
        if (!d?.s || !d?.c) return;
        const sym   = d.s.toUpperCase();
        const price = parseFloat(d.c);
        const openPx = parseFloat(d.o);
        // @miniTicker has no P field — compute from open
        const chg = openPx > 0 ? ((price - openPx) / openPx) * 100 : 0;
        if (!isFinite(price) || price <= 0) return;
        setPrices(prev => ({ ...prev, [sym]: { price, chg: safeChg(chg), source:"binance-ws", ts:Date.now() } }));
      } catch {}
    };
    ws.onclose = () => { retryRef.current = setTimeout(connectBinance, 3000); };
    ws.onerror = () => { ws.close(); };
  }, []);

  useEffect(() => {
    connectBinance();
    return () => { clearTimeout(retryRef.current); wsRef.current?.close(); };
  }, [connectBinance]);

  /* ── 2. Backend /api/v1/prices/live (all non-WS assets) ─────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const fetchLive = async () => {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch("/api/v1/prices/live", { signal: ctrl.signal });
        clearTimeout(tid);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!d.prices) return;
        if (!cancelled) {
          setPrices(prev => {
            const next = { ...prev };
            for (const [sym, val] of Object.entries(d.prices as Record<string,any>)) {
              if (!val?.price || val.price <= 0) continue;
              const existing = prev[sym];
              if (!existing || Date.now() - existing.ts > 15000) {
                next[sym] = { price: val.price, chg: safeChg(val.chg), source:"backend", ts:Date.now() };
              }
            }
            // Alias COMP → NDX so MarketTicker { key:"NDX" } resolves
            if (next["COMP"] && (!next["NDX"] || Date.now() - next["NDX"].ts > 15000)) {
              next["NDX"] = { ...next["COMP"] };
            }
            return next;
          });
        }
      } catch {}
    };
    fetchLive();
    const liveId = setInterval(fetchLive, 30000);
    return () => { cancelled = true; clearInterval(liveId); };
  }, []);

  return <PriceContext.Provider value={prices}>{children}</PriceContext.Provider>;
}

export const usePrices = () => useContext(PriceContext);

export function usePrice(symbol: string): PriceEntry | undefined {
  const prices = useContext(PriceContext);
  const key = symbol.toUpperCase();
  return prices[key] ?? prices[key + "USDT"] ?? prices[norm(key)] ?? undefined;
}

export function usePriceFormatted(symbol: string): {
  price: string; chg: string; live: boolean; source: string;
} {
  const entry = usePrice(symbol);
  if (!entry) return { price: "—", chg: "0.00%", live: false, source: "none" };
  const chgVal = safeChg(entry.chg);
  const chgStr = (chgVal >= 0 ? "+" : "") + chgVal.toFixed(2) + "%";
  const priceStr = entry.price >= 1000
    ? entry.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : entry.price < 0.01
      ? entry.price.toFixed(6)
      : entry.price.toFixed(4);
  const fresh = Date.now() - entry.ts < 30000;
  return { price: priceStr, chg: chgStr, live: fresh, source: entry.source };
}

