"use client";
import { useState, useEffect, useCallback, useRef } from "react";

export interface KLineBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartDataState {
  bars: KLineBar[];
  loading: boolean;
  error: string | null;
  provider: string | null;
  updatedAt: number | null;
  refetch: () => void;
}

export function useChartData(symbol: string, timeframe: string): ChartDataState {
  const [bars, setBars] = useState<KLineBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/ohlcv/${encodeURIComponent(symbol)}?tf=${timeframe}`,
        { signal: ctrl.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.candles?.length) {
        setError("Mum verisi alınamadı");
        setBars([]);
        return;
      }
      const normalized: KLineBar[] = data.candles
        .filter((c: any) => c.t > 0 && isFinite(c.o))
        .map((c: any) => ({
          timestamp: c.t,
          open: c.o, high: c.h, low: c.l, close: c.c,
          volume: c.v || 0,
        }))
        .sort((a: KLineBar, b: KLineBar) => a.timestamp - b.timestamp);
      setBars(normalized);
      setProvider(data.provider || null);
      setUpdatedAt(Date.now());
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message || "Veri çekilemedi");
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => { fetchData(); return () => abortRef.current?.abort(); }, [fetchData]);

  return { bars, loading, error, provider, updatedAt, refetch: fetchData };
}
