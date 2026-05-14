"use client";
import { useState, useCallback, useEffect, useMemo } from "react";

export type IndicatorId = "VOL" | "MA" | "EMA" | "BOLL" | "RSI" | "MACD" | "SAR" | "KDJ";

export interface IndicatorConfig {
  id: IndicatorId;
  label: string;
  paneId?: string; // if separate pane
  params?: Record<string, number>;
}

const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { id: "VOL", label: "Hacim", paneId: "vol" },
  { id: "MA", label: "MA (20,50)", params: { periods: 20 } },
  { id: "BOLL", label: "Bollinger", params: { period: 20, stdDev: 2 } },
];

const STORAGE_KEY = "ayc_chart_indicators_v1";
const ALL_INDICATORS: IndicatorId[] = ["VOL", "MA", "EMA", "BOLL", "RSI", "MACD", "SAR", "KDJ"];

function sanitize(value: unknown): IndicatorId[] {
  if (!Array.isArray(value)) return ["VOL"];
  const next = value.filter((item): item is IndicatorId =>
    typeof item === "string" && ALL_INDICATORS.includes(item as IndicatorId),
  );
  return next.length > 0 ? Array.from(new Set(next)) : ["VOL"];
}

function loadStored(scopeKey: string): IndicatorId[] {
  if (typeof window === "undefined") return ["VOL"];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return ["VOL"];
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return sanitize(parsed?.[scopeKey]);
  } catch {
    return ["VOL"];
  }
}

function saveStored(scopeKey: string, values: IndicatorId[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = typeof parsed === "object" && parsed !== null ? parsed : {};
    next[scopeKey] = values;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function useChartIndicators(symbol: string, timeframe: string) {
  const scopeKey = useMemo(() => `${symbol.toUpperCase()}::${timeframe.toUpperCase()}`, [symbol, timeframe]);
  const [active, setActive] = useState<IndicatorId[]>(["VOL"]);

  useEffect(() => {
    setActive(loadStored(scopeKey));
  }, [scopeKey]);

  const toggle = useCallback((id: IndicatorId) => {
    setActive(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      const sanitized = sanitize(next);
      saveStored(scopeKey, sanitized);
      return sanitized;
    });
  }, [scopeKey]);

  const replaceAll = useCallback((ids: IndicatorId[]) => {
    const next = sanitize(ids);
    setActive(next);
    saveStored(scopeKey, next);
  }, [scopeKey]);

  const isActive = useCallback((id: IndicatorId) => active.includes(id), [active]);

  return { active, toggle, replaceAll, isActive, available: DEFAULT_INDICATORS };
}
