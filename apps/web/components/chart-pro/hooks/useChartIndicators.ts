"use client";
import { useState, useCallback } from "react";

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

export function useChartIndicators() {
  const [active, setActive] = useState<IndicatorId[]>(["VOL", "MA"]);

  const toggle = useCallback((id: IndicatorId) => {
    setActive(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const isActive = useCallback((id: IndicatorId) => active.includes(id), [active]);

  return { active, toggle, isActive, available: DEFAULT_INDICATORS };
}
