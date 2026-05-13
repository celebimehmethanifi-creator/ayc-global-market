"use client";
import React, { useRef, useEffect, useCallback, useState } from "react";
import { init, dispose, Chart, IndicatorCreate } from "klinecharts";
import { ChartHeader } from "./ChartHeader";
import { IndicatorToolbar } from "./IndicatorToolbar";
import { DrawingToolbar } from "./DrawingToolbar";
import { Depth3DPlaceholder } from "./Depth3DPlaceholder";
import { useChartData } from "./hooks/useChartData";
import { useChartDrawings } from "./hooks/useChartDrawings";
import { useChartIndicators, type IndicatorId } from "./hooks/useChartIndicators";
import { useChartInteractions } from "./hooks/useChartInteractions";
import type { DrawingType } from "./engine/drawingTypes";

// ─── AYC Theme ───────────────────────────────────────────────────────────────
const AYC_STYLES = {
  grid: {
    show: true,
    horizontal: { show: true, size: 1, color: "rgba(255,255,255,0.03)", style: "dashed" as const },
    vertical: { show: true, size: 1, color: "rgba(255,255,255,0.03)", style: "dashed" as const },
  },
  candle: {
    type: "candle_solid" as const,
    bar: {
      upColor: "#10b981",
      downColor: "#ef4444",
      noChangeColor: "#888",
      upBorderColor: "#10b981",
      downBorderColor: "#ef4444",
      noChangeBorderColor: "#888",
      upWickColor: "#10b981",
      downWickColor: "#ef4444",
      noChangeWickColor: "#888",
    },
    priceMark: {
      show: true,
      high: { show: true, color: "rgba(232,232,239,0.6)", textSize: 10 },
      low: { show: true, color: "rgba(232,232,239,0.6)", textSize: 10 },
      last: {
        show: true,
        upColor: "#10b981",
        downColor: "#ef4444",
        noChangeColor: "#888",
        line: { show: true, style: "dashed" as const, size: 1 },
        text: { show: true, size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
      },
    },
  },
  indicator: {
    lines: [
      { color: "#60a5fa" }, { color: "#f59e0b" }, { color: "#a78bfa" },
      { color: "#fb923c" }, { color: "#22d3ee" },
    ],
  },
  xAxis: {
    show: true,
    axisLine: { show: true, color: "rgba(255,255,255,0.06)" },
    tickLine: { show: true, color: "rgba(255,255,255,0.06)" },
    tickText: { show: true, color: "rgba(232,232,239,0.4)", size: 10, family: "IBM Plex Mono" },
  },
  yAxis: {
    show: true,
    axisLine: { show: true, color: "rgba(255,255,255,0.06)" },
    tickLine: { show: true, color: "rgba(255,255,255,0.06)" },
    tickText: { show: true, color: "rgba(232,232,239,0.4)", size: 10, family: "IBM Plex Mono" },
  },
  crosshair: {
    show: true,
    horizontal: { show: true, line: { show: true, style: "dashed" as const, size: 1, color: "rgba(212,175,55,0.4)" }, text: { show: true, color: "#0C0E16", borderColor: "#D4AF37", backgroundColor: "#D4AF37", size: 10, family: "IBM Plex Mono" } },
    vertical: { show: true, line: { show: true, style: "dashed" as const, size: 1, color: "rgba(212,175,55,0.4)" }, text: { show: true, color: "#0C0E16", borderColor: "#D4AF37", backgroundColor: "#D4AF37", size: 10, family: "IBM Plex Mono" } },
  },
  separator: { size: 1, color: "rgba(255,255,255,0.06)" },
};

// ─── Indicator Mapping ───────────────────────────────────────────────────────
const INDICATOR_MAP: Record<IndicatorId, { name: string; paneId?: string; calcParams?: number[] }> = {
  VOL:  { name: "VOL", paneId: "vol_pane" },
  MA:   { name: "MA", calcParams: [20, 50] },
  EMA:  { name: "EMA", calcParams: [12, 26] },
  BOLL: { name: "BOLL", calcParams: [20, 2] },
  RSI:  { name: "RSI", paneId: "rsi_pane", calcParams: [14] },
  MACD: { name: "MACD", paneId: "macd_pane", calcParams: [12, 26, 9] },
  SAR:  { name: "SAR" },
  KDJ:  { name: "KDJ", paneId: "kdj_pane", calcParams: [9, 3, 3] },
};

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  symbol: string;
  defaultTimeframe?: string;
}

export function AYCChartTerminal({ symbol, defaultTimeframe = "1H" }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [activeTab, setActiveTab] = useState<"chart" | "3d">("chart");

  const { bars, loading, error, provider, updatedAt, refetch } = useChartData(symbol, timeframe);
  const { drawings, addDrawing, removeDrawing, clearDrawings } = useChartDrawings(symbol, timeframe);
  const { active: activeIndicators, toggle: toggleIndicator } = useChartIndicators();
  const { isFullscreen, toggleFullscreen, exitFullscreen, activeTool, setActiveTool } = useChartInteractions();

  const isBIST = /\.(IS|E)$/.test(symbol) || ["THYAO", "GARAN", "ASELS", "SISE", "KCHOL"].some(s => symbol.startsWith(s));

  // ─── Init Chart ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = init(chartRef.current, { styles: AYC_STYLES as any });
    chartInstance.current = chart!;
    return () => {
      if (chartRef.current) dispose(chartRef.current);
      chartInstance.current = null;
    };
  }, []);

  // ─── Load Data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart || !bars.length) return;
    chart.applyNewData(bars.map(b => ({
      timestamp: b.timestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    })));
  }, [bars]);

  // ─── Sync Indicators ────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;

    // Remove all current indicators
    chart.removeIndicator("candle_pane");
    const paneIds = ["vol_pane", "rsi_pane", "macd_pane", "kdj_pane"];
    paneIds.forEach(id => { try { chart.removeIndicator(id); } catch {} });

    // Add active indicators
    activeIndicators.forEach(id => {
      const cfg = INDICATOR_MAP[id];
      if (!cfg) return;
      const create: IndicatorCreate = { name: cfg.name };
      if (cfg.calcParams) create.calcParams = cfg.calcParams;
      if (cfg.paneId) {
        chart.createIndicator(create, true, { id: cfg.paneId });
      } else {
        chart.createIndicator(create, true, { id: "candle_pane" });
      }
    });
  }, [activeIndicators, bars]);

  // ─── Container Style ────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = isFullscreen ? {
    position: "fixed", inset: 0, zIndex: 9999, background: "#0C0E16",
    display: "flex", flexDirection: "column",
  } : {
    width: "100%", height: "100%", minHeight: 500,
    background: "#0C0E16", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    display: "flex", flexDirection: "column", overflow: "hidden",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <ChartHeader
        symbol={symbol}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        provider={provider}
        updatedAt={updatedAt}
        loading={loading}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 12px" }}>
        {(["chart", "3d"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "6px 14px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
            background: "transparent", borderBottom: activeTab === tab ? "2px solid #D4AF37" : "2px solid transparent",
            color: activeTab === tab ? "#D4AF37" : "rgba(232,232,239,0.4)",
            fontFamily: "DM Sans", transition: "all 0.15s",
          }}>
            {tab === "chart" ? "Grafik" : "3D Derinlik"}
          </button>
        ))}
      </div>

      {/* Indicator toolbar */}
      {activeTab === "chart" && (
        <IndicatorToolbar active={activeIndicators} onToggle={toggleIndicator} />
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {activeTab === "chart" ? (
          <>
            {/* Drawing toolbar */}
            <DrawingToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onClear={clearDrawings}
            />
            {/* Chart canvas */}
            <div style={{ flex: 1, position: "relative" }}>
              {error && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(12,14,22,0.9)", zIndex: 10,
                }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ color: "rgba(239,68,68,0.8)", fontSize: 13, marginBottom: 8 }}>{error}</p>
                    <button onClick={refetch} style={{
                      padding: "6px 16px", borderRadius: 6, border: "1px solid rgba(212,175,55,0.3)",
                      background: "rgba(212,175,55,0.1)", color: "#D4AF37", fontSize: 12,
                      fontWeight: 600, cursor: "pointer",
                    }}>Tekrar Dene</button>
                  </div>
                </div>
              )}
              {isBIST && (
                <div style={{
                  position: "absolute", top: 8, right: 8, zIndex: 5,
                  padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                  background: "rgba(245,158,11,0.15)", color: "#f59e0b",
                  border: "1px solid rgba(245,158,11,0.2)", fontFamily: "IBM Plex Mono",
                }}>GECİKMELİ</div>
              )}
              <div ref={chartRef} style={{ width: "100%", height: "100%" }} />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, padding: 16 }}>
            <Depth3DPlaceholder symbol={symbol} isBIST={isBIST} />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 12px", borderTop: "1px solid rgba(255,255,255,0.06)",
        fontSize: 10, color: "rgba(232,232,239,0.35)", fontFamily: "IBM Plex Mono",
      }}>
        <span>AYC Chart Pro — POC v0.1</span>
        <span>{bars.length} mum · {activeIndicators.length} indikatör</span>
        {provider && <span>Kaynak: {provider}</span>}
      </div>
    </div>
  );
}