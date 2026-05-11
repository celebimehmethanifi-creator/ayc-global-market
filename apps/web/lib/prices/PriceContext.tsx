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

/* Public keys (market data reads only) */
const FH_KEY  = process.env.NEXT_PUBLIC_FINNHUB_KEY || "d7pp429r01qosaapdudgd7pp429r01qosaapdue0";

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

/* Finnhub symbols: [outputKey, finnhubSymbol] — indices removed (use backend instead) */
const STOCK_SYMS: [string, string][] = [
  ["AAPL","AAPL"],["TSLA","TSLA"],["NVDA","NVDA"],["MSFT","MSFT"],
  ["AMZN","AMZN"],["GOOGL","GOOGL"],["META","META"],["AMD","AMD"],
  ["INTC","INTC"],["NFLX","NFLX"],["JPM","JPM"],["V","V"],["WMT","WMT"],
];

/* Stooq symbols for metals + energy polling */
const STOOQ_MAP: [string, string][] = [
  ["xauusd", "XAUUSD"],  // Gold
  ["xagusd", "XAGUSD"],  // Silver
  ["clusd",  "WTIUSD"],  // WTI crude oil
  ["lcousd", "BRENT"],   // Brent crude
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

  /* ── 2. Finnhub stock polling (every 15s) ───────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const fetchStocks = async () => {
      for (const [outKey, fhSym] of STOCK_SYMS) {
        if (cancelled) return;
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 5000);
          const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${fhSym}&token=${FH_KEY}`, { signal: ctrl.signal });
          clearTimeout(tid);
          if (!r.ok) continue;
          const d = await r.json();
          if (!d.c || d.c <= 0) continue;
          const chg = safeChg(d.pc > 0 ? ((d.c - d.pc) / d.pc) * 100 : 0);
          if (!cancelled) setPrices(prev => ({ ...prev, [outKey]: { price: d.c, chg, source:"finnhub", ts:Date.now() } }));
        } catch {}
        await new Promise(r => setTimeout(r, 500));
      }
    };

    fetchStocks();
    const id = setInterval(fetchStocks, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  /* ── 3. Stooq metals/energy + ER-API forex (every 60s) ─── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const fetchMetalsForex = async () => {
      // Stooq: metals + energy
      for (const [stooqSym, outKey] of STOOQ_MAP) {
        if (cancelled) return;
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 8000);
          const r = await fetch(
            `https://stooq.com/q/l/?s=${stooqSym}&f=sd2t2ohlcv&h&e=json`,
            { signal: ctrl.signal }
          );
          clearTimeout(tid);
          if (!r.ok || cancelled) continue;
          const d = await r.json();
          const item = Array.isArray(d.symbols) ? d.symbols[0] : null;
          if (!item) continue;
          const close = Number(item.Close || item.close || item.Last);
          const open  = Number(item.Open  || item.open);
          if (!isFinite(close) || close <= 0) continue;
          const chg = open > 0 ? ((close - open) / open) * 100 : 0;
          if (!cancelled) setPrices(prev => ({ ...prev, [outKey]: { price: close, chg: safeChg(chg), source: "stooq", ts: Date.now() } }));
        } catch {}
        await new Promise(res => setTimeout(res, 300));
      }

      // ER-API: forex
      if (cancelled) return;
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: ctrl.signal });
        clearTimeout(tid);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!d.rates) return;
        const rates = d.rates as Record<string, number>;
        const pairs: [string, string, boolean][] = [
          ["EUR","EURUSD",true], ["GBP","GBPUSD",true],
          ["TRY","USDTRY",false], ["JPY","USDJPY",false],
          ["CHF","USDCHF",false], ["CAD","USDCAD",false],
        ];
        const updates: PriceMap = {};
        for (const [ccy, key, inverse] of pairs) {
          const rate = Number(rates[ccy]);
          if (!isFinite(rate) || rate <= 0) continue;
          const price = inverse ? +(1/rate).toFixed(5) : +rate.toFixed(4);
          updates[key] = { price, chg: 0, source: "er-api", ts: Date.now() };
        }
        if (rates.EUR > 0 && rates.TRY > 0) {
          updates["EURTRY"] = { price: +(rates.TRY / rates.EUR).toFixed(4), chg: 0, source: "er-api", ts: Date.now() };
        }
        if (!cancelled) setPrices(prev => ({ ...prev, ...updates }));
      } catch {}
    };

    fetchMetalsForex();
    const id = setInterval(fetchMetalsForex, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  /* ── 4. CoinGecko fallback (if Binance WS stale >10s) ──────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const fetchCG = async () => {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 6000);
        const cgIds = [
          "bitcoin","ethereum","solana","binancecoin","ripple","dogecoin",
          "cardano","polkadot","chainlink","litecoin","uniswap","cosmos","near",
          "ondo-finance","sui","aptos","injective-protocol","fantom","render-token",
          "fetch-ai","the-graph","lido-dao","aave","maker","curve-dao-token",
          "pendle","ethena","eigenlayer","jupiter-exchange-solana","dogwifcoin",
          "stellar","vechain","internet-computer","filecoin","hedera-hashgraph",
          "toncoin","tron","shiba-inu","arbitrum","optimism",
        ].join(",");
        const r = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=usd&include_24hr_change=true`,
          { signal: ctrl.signal }
        );
        clearTimeout(tid);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const CG_MAP: Record<string,string> = {
          bitcoin:"BTCUSDT", ethereum:"ETHUSDT", solana:"SOLUSDT",
          binancecoin:"BNBUSDT", ripple:"XRPUSDT", dogecoin:"DOGEUSDT",
          cardano:"ADAUSDT", polkadot:"DOTUSDT", chainlink:"LINKUSDT", litecoin:"LTCUSDT",
          uniswap:"UNIUSDT", cosmos:"ATOMUSDT", near:"NEARUSDT",
          "ondo-finance":"ONDOUSDT", sui:"SUIUSDT", aptos:"APTUSDT",
          "injective-protocol":"INJUSDT", fantom:"FTMUSDT",
          "render-token":"RENDERUSDT", "fetch-ai":"FETUSDT",
          "the-graph":"GRTUSDT", "lido-dao":"LDOUSDT", aave:"AAVEUSDT",
          maker:"MKRUSDT", "curve-dao-token":"CRVUSDT", pendle:"PENDLEUSDT",
          ethena:"ENAUSDT", eigenlayer:"EIGENUSDT",
          "jupiter-exchange-solana":"JUPUSDT", dogwifcoin:"WIFUSDT",
          stellar:"XLMUSDT", vechain:"VETUSDT",
          "internet-computer":"ICPUSDT", filecoin:"FILUSDT",
          "hedera-hashgraph":"HBARUSDT", toncoin:"TONUSDT",
          tron:"TRXUSDT", "shiba-inu":"SHIBUSDT",
          arbitrum:"ARBUSDT", optimism:"OPUSDT",
        };
        if (!cancelled) {
          setPrices(prev => {
            const next = { ...prev };
            for (const [id, sym] of Object.entries(CG_MAP)) {
              const p = d[id] as any;
              if (!p?.usd || p.usd <= 0) continue;
              const existing = prev[sym];
              // Only use CG if WS data is stale >10s
              if (!existing || Date.now() - existing.ts > 10000) {
                next[sym] = { price: p.usd, chg: safeChg(p.usd_24h_change), source:"coingecko", ts:Date.now() };
              }
            }
            return next;
          });
        }
      } catch {}
    };

    const id = setInterval(fetchCG, 15000);
    fetchCG();
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  /* ── 5. Backend /api/v1/prices/live (BIST, indices, energy) ─── */
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