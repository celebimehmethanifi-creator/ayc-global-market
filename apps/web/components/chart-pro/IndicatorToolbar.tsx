"use client";
import type { IndicatorId } from "./hooks/useChartIndicators";

interface Props {
  active: IndicatorId[];
  onToggle: (id: IndicatorId) => void;
}

const INDICATORS: { id: IndicatorId; label: string; color: string }[] = [
  { id: "VOL", label: "Vol", color: "#60a5fa" },
  { id: "MA", label: "MA", color: "#f59e0b" },
  { id: "EMA", label: "EMA", color: "#a78bfa" },
  { id: "BOLL", label: "BB", color: "#94a3b8" },
  { id: "RSI", label: "RSI", color: "#10b981" },
  { id: "MACD", label: "MACD", color: "#ef4444" },
  { id: "SAR", label: "SAR", color: "#f472b6" },
  { id: "KDJ", label: "KDJ", color: "#22d3ee" },
];

export function IndicatorToolbar({ active, onToggle }: Props) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4, padding: "4px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 10, color: "rgba(232,232,239,0.35)", fontWeight: 600, marginRight: 4 }}>İndikatörler</span>
      {INDICATORS.map(ind => {
        const isOn = active.includes(ind.id);
        return (
          <button key={ind.id} onClick={() => onToggle(ind.id)} style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
            fontFamily: "IBM Plex Mono", cursor: "pointer", transition: "all 0.15s",
            border: `1px solid ${isOn ? ind.color + "40" : "transparent"}`,
            background: isOn ? ind.color + "15" : "transparent",
            color: isOn ? ind.color : "rgba(232,232,239,0.4)",
          }}>{ind.label}</button>
        );
      })}
    </div>
  );
}
