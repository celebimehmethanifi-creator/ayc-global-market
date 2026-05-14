"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { init, dispose, OverlayMode, type Chart, type IndicatorCreate, type OverlayCreate } from "klinecharts";
import { ChartHeader } from "./ChartHeader";
import { IndicatorToolbar } from "./IndicatorToolbar";
import { DrawingToolbar } from "./DrawingToolbar";
import { Depth3DPlaceholder } from "./Depth3DPlaceholder";
import { useChartData } from "./hooks/useChartData";
import { useChartDrawings } from "./hooks/useChartDrawings";
import { useChartIndicators, type IndicatorId } from "./hooks/useChartIndicators";
import { useChartInteractions } from "./hooks/useChartInteractions";
import type { Drawing, DrawingPoint, DrawingStyle, DrawingType } from "./engine/drawingTypes";
import { createDrawingId } from "./engine/drawingTypes";

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
  },
  indicator: {
    lines: [{ color: "#60a5fa" }, { color: "#f59e0b" }, { color: "#a78bfa" }, { color: "#fb923c" }, { color: "#22d3ee" }],
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
    horizontal: {
      show: true,
      line: { show: true, style: "dashed" as const, size: 1, color: "rgba(212,175,55,0.4)" },
      text: { show: true, color: "#0C0E16", borderColor: "#D4AF37", backgroundColor: "#D4AF37", size: 10, family: "IBM Plex Mono" },
    },
    vertical: {
      show: true,
      line: { show: true, style: "dashed" as const, size: 1, color: "rgba(212,175,55,0.4)" },
      text: { show: true, color: "#0C0E16", borderColor: "#D4AF37", backgroundColor: "#D4AF37", size: 10, family: "IBM Plex Mono" },
    },
  },
  separator: { size: 1, color: "rgba(255,255,255,0.06)" },
};

const INDICATOR_MAP: Record<IndicatorId, { name: string; paneId?: string; calcParams?: number[] }> = {
  VOL: { name: "VOL", paneId: "vol_pane" },
  MA: { name: "MA", calcParams: [20, 50] },
  EMA: { name: "EMA", calcParams: [12, 26] },
  BOLL: { name: "BOLL", calcParams: [20, 2] },
  RSI: { name: "RSI", paneId: "rsi_pane", calcParams: [14] },
  MACD: { name: "MACD", paneId: "macd_pane", calcParams: [12, 26, 9] },
  SAR: { name: "SAR" },
  KDJ: { name: "KDJ", paneId: "kdj_pane", calcParams: [9, 3, 3] },
};

const DRAWING_TO_OVERLAY: Record<DrawingType, { overlayName: string; partial?: boolean }> = {
  trendLine: { overlayName: "straightLine" },
  horizontalLine: { overlayName: "horizontalStraightLine" },
  verticalLine: { overlayName: "verticalStraightLine" },
  rectangle: { overlayName: "priceChannelLine", partial: true },
  fibonacci: { overlayName: "fibonacciLine" },
  text: { overlayName: "simpleAnnotation" },
  entryLine: { overlayName: "priceLine" },
  targetLine: { overlayName: "priceLine" },
  priceLine: { overlayName: "priceLine" },
  stopLine: { overlayName: "priceLine" },
};

interface Props {
  symbol: string;
  defaultTimeframe?: string;
}

type Tool = DrawingType | "cursor" | "eraser";

function isDrawingTool(tool: Tool): tool is DrawingType {
  return tool !== "cursor" && tool !== "eraser";
}

function toOverlayPoints(points: DrawingPoint[]) {
  return points.map((point) => ({ timestamp: point.time, value: point.price }));
}

function fromOverlayPoints(points: Array<{ timestamp?: number; value?: number }> | undefined): DrawingPoint[] {
  if (!Array.isArray(points)) return [];
  return points
    .map((point) => ({ time: Number(point?.timestamp || 0), price: Number(point?.value || 0) }))
    .filter((point) => Number.isFinite(point.time) && point.time > 0 && Number.isFinite(point.price) && point.price > 0);
}

function getDefaultStyle(type: DrawingType): DrawingStyle {
  switch (type) {
    case "entryLine":
      return { color: "#60a5fa", width: 2, label: "ENTRY" };
    case "targetLine":
      return { color: "#10b981", width: 2, label: "TARGET" };
    case "horizontalLine":
      return { color: "#f59e0b", width: 2 };
    case "verticalLine":
      return { color: "#a78bfa", width: 2 };
    case "fibonacci":
      return { color: "#D4AF37", width: 2, dash: true };
    case "rectangle":
      return { color: "#22d3ee", width: 2 };
    case "text":
      return { color: "#e8e8ef", width: 1, label: "NOT" };
    default:
      return { color: "#60a5fa", width: 2 };
  }
}

function buildOverlayStyles(style: DrawingStyle) {
  return {
    line: {
      color: style.color,
      size: Math.max(1, Math.min(6, Number(style.width || 2))),
      style: style.dash ? "dashed" : "solid",
    },
    text: {
      color: style.color,
      size: 11,
    },
  };
}

export function AYCChartTerminal({ symbol, defaultTimeframe = "1H" }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const activeToolRef = useRef<Tool>("cursor");
  const runtimeOverlayIdsRef = useRef<Set<string>>(new Set());
  const pendingOverlayIdsRef = useRef<Set<string>>(new Set());
  const mutedRemovalIdsRef = useRef<Set<string>>(new Set());

  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [activeTab, setActiveTab] = useState<"chart" | "3d">("chart");
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  const { bars, loading, error, provider, updatedAt, refetch } = useChartData(symbol, timeframe);
  const { drawings, addDrawing, removeDrawing, clearDrawings } = useChartDrawings(symbol, timeframe);
  const { active: activeIndicators, toggle: toggleIndicator } = useChartIndicators(symbol, timeframe);
  const { isFullscreen, toggleFullscreen, exitFullscreen, activeTool, setActiveTool } = useChartInteractions();

  const isBIST = /\.(IS|E)$/.test(symbol) || ["THYAO", "GARAN", "ASELS", "SISE", "KCHOL"].some((s) => symbol.startsWith(s));

  const createOverlayFromDrawing = useCallback(
    (drawing: Drawing, interactive: boolean) => {
      const chart = chartInstance.current;
      if (!chart) return;
      const mapping = DRAWING_TO_OVERLAY[drawing.type] || { overlayName: "straightLine", partial: true };
      const overlayName = mapping.overlayName;
      const overlayStyles = buildOverlayStyles(drawing.style);

      const overlay: OverlayCreate = {
        id: drawing.id,
        name: overlayName,
        mode: OverlayMode.WeakMagnet,
        modeSensitivity: 8,
        lock: false,
        styles: overlayStyles as any,
        points: interactive ? [] : toOverlayPoints(drawing.points),
        extendData: drawing.style.label || (drawing.type === "text" ? "NOT" : undefined),
        onDrawEnd: (event: any) => {
          const resolved = fromOverlayPoints(event?.overlay?.points);
          if (!resolved.length) return false;
          addDrawing({
            id: drawing.id,
            type: drawing.type,
            points: resolved,
            style: drawing.style,
            createdAt: drawing.createdAt,
            updatedAt: new Date().toISOString(),
          });
          pendingOverlayIdsRef.current.delete(drawing.id);
          runtimeOverlayIdsRef.current.add(drawing.id);
          setSelectedDrawingId(drawing.id);
          setActiveTool("cursor");
          return false;
        },
        onClick: () => {
          if (activeToolRef.current === "eraser") {
            mutedRemovalIdsRef.current.add(drawing.id);
            chart.removeOverlay({ id: drawing.id });
            runtimeOverlayIdsRef.current.delete(drawing.id);
            pendingOverlayIdsRef.current.delete(drawing.id);
            removeDrawing(drawing.id);
            if (selectedDrawingId === drawing.id) setSelectedDrawingId(null);
            return true;
          }
          setSelectedDrawingId(drawing.id);
          return false;
        },
        onSelected: () => {
          setSelectedDrawingId(drawing.id);
          return false;
        },
        onDeselected: () => {
          if (selectedDrawingId === drawing.id) setSelectedDrawingId(null);
          return false;
        },
        onRemoved: () => {
          if (mutedRemovalIdsRef.current.has(drawing.id)) {
            mutedRemovalIdsRef.current.delete(drawing.id);
            runtimeOverlayIdsRef.current.delete(drawing.id);
            pendingOverlayIdsRef.current.delete(drawing.id);
            return false;
          }
          runtimeOverlayIdsRef.current.delete(drawing.id);
          pendingOverlayIdsRef.current.delete(drawing.id);
          removeDrawing(drawing.id);
          if (selectedDrawingId === drawing.id) setSelectedDrawingId(null);
          return false;
        },
      };

      const created = chart.createOverlay(overlay, "candle_pane");
      if (typeof created === "string" && created) runtimeOverlayIdsRef.current.add(drawing.id);
    },
    [addDrawing, removeDrawing, selectedDrawingId, setActiveTool],
  );

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;
    const chart = init(container, { styles: AYC_STYLES as any });
    chartInstance.current = chart || null;
    return () => {
      dispose(container);
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart || !bars.length) return;
    chart.applyNewData(
      bars.map((bar) => ({
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
    );
  }, [bars]);

  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;
    try {
      chart.removeIndicator("candle_pane");
      ["vol_pane", "rsi_pane", "macd_pane", "kdj_pane"].forEach((paneId) => {
        try {
          chart.removeIndicator(paneId);
        } catch {}
      });
    } catch {}

    activeIndicators.forEach((id) => {
      const cfg = INDICATOR_MAP[id];
      if (!cfg) return;
      const create: IndicatorCreate = { name: cfg.name };
      if (cfg.calcParams) create.calcParams = cfg.calcParams;
      if (cfg.paneId) chart.createIndicator(create, true, { id: cfg.paneId });
      else chart.createIndicator(create, true, { id: "candle_pane" });
    });
  }, [activeIndicators, bars]);

  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart || !bars.length) return;
    if (!isDrawingTool(activeTool)) return;

    const draftId = createDrawingId();
    if (pendingOverlayIdsRef.current.has(draftId)) return;
    pendingOverlayIdsRef.current.add(draftId);

    const style = getDefaultStyle(activeTool);
    const now = new Date().toISOString();
    const draft: Drawing = {
      id: draftId,
      symbol,
      timeframe,
      type: activeTool,
      points: [],
      style,
      createdAt: now,
      updatedAt: now,
    };
    createOverlayFromDrawing(draft, true);
  }, [activeTool, bars.length, createOverlayFromDrawing, symbol, timeframe]);

  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;
    const scopedIds = new Set(drawings.map((drawing) => drawing.id));

    Array.from(runtimeOverlayIdsRef.current).forEach((id) => {
      if (!scopedIds.has(id)) {
        mutedRemovalIdsRef.current.add(id);
        chart.removeOverlay({ id });
        runtimeOverlayIdsRef.current.delete(id);
      }
    });

    drawings.forEach((drawing) => {
      if (runtimeOverlayIdsRef.current.has(drawing.id)) return;
      createOverlayFromDrawing(drawing, false);
    });
  }, [createOverlayFromDrawing, drawings, symbol, timeframe]);

  const clearRuntimeDrawings = useCallback(() => {
    const chart = chartInstance.current;
    if (!chart) return;
    Array.from(runtimeOverlayIdsRef.current).forEach((id) => {
      mutedRemovalIdsRef.current.add(id);
      chart.removeOverlay({ id });
    });
    runtimeOverlayIdsRef.current.clear();
    pendingOverlayIdsRef.current.clear();
    setSelectedDrawingId(null);
    clearDrawings();
  }, [clearDrawings]);

  const deleteSelectedDrawing = useCallback(() => {
    if (!selectedDrawingId) return;
    const chart = chartInstance.current;
    if (chart) {
      mutedRemovalIdsRef.current.add(selectedDrawingId);
      chart.removeOverlay({ id: selectedDrawingId });
    }
    runtimeOverlayIdsRef.current.delete(selectedDrawingId);
    pendingOverlayIdsRef.current.delete(selectedDrawingId);
    removeDrawing(selectedDrawingId);
    setSelectedDrawingId(null);
  }, [removeDrawing, selectedDrawingId]);

  const containerStyle: React.CSSProperties = useMemo(
    () =>
      isFullscreen
        ? {
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#0C0E16",
            display: "flex",
            flexDirection: "column",
          }
        : {
            width: "100%",
            height: "100%",
            minHeight: 500,
            background: "#0C0E16",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
    [isFullscreen],
  );

  return (
    <div style={containerStyle}>
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

      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 12px" }}>
        {(["chart", "3d"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              borderBottom: activeTab === tab ? "2px solid #D4AF37" : "2px solid transparent",
              color: activeTab === tab ? "#D4AF37" : "rgba(232,232,239,0.4)",
              fontFamily: "DM Sans",
              transition: "all 0.15s",
            }}
          >
            {tab === "chart" ? "Grafik" : "3D Derinlik"}
          </button>
        ))}
      </div>

      {activeTab === "chart" && <IndicatorToolbar active={activeIndicators} onToggle={toggleIndicator} />}

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {activeTab === "chart" ? (
          <div style={{ flex: 1, position: "relative", minHeight: 0, display: "flex", overflow: "hidden" }}>
            <DrawingToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onClear={clearRuntimeDrawings}
              hasSelected={Boolean(selectedDrawingId)}
              onDeleteSelected={deleteSelectedDrawing}
            />
            <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
              {error && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(12,14,22,0.9)",
                    zIndex: 10,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <p style={{ color: "rgba(239,68,68,0.85)", fontSize: 13, marginBottom: 8 }}>{error}</p>
                    <button
                      onClick={refetch}
                      style={{
                        padding: "6px 16px",
                        borderRadius: 6,
                        border: "1px solid rgba(212,175,55,0.3)",
                        background: "rgba(212,175,55,0.1)",
                        color: "#D4AF37",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Tekrar Dene
                    </button>
                  </div>
                </div>
              )}

              {isBIST && (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 5,
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 700,
                    background: "rgba(245,158,11,0.15)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245,158,11,0.2)",
                    fontFamily: "IBM Plex Mono",
                  }}
                >
                  GECIKMELI
                </div>
              )}

              <div ref={chartRef} style={{ width: "100%", height: "100%" }} />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, padding: 16 }}>
            <Depth3DPlaceholder symbol={symbol} isBIST={isBIST} />
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 12px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 10,
          color: "rgba(232,232,239,0.35)",
          fontFamily: "IBM Plex Mono",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span>AYC Chart Pro - POC v0.1</span>
        <span>
          {bars.length} mum · {activeIndicators.length} indikator
        </span>
        {provider && <span>Kaynak: {provider}</span>}
      </div>
    </div>
  );
}
