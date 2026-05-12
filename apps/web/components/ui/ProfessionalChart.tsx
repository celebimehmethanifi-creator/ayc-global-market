"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }
interface Props {
  symbol: string;
  market?: string;
  initialTf?: string;
  height?: number;
}

const TF_OPTIONS = ["5M","15M","1H","4H","1D","1W","1M","1Y"];
const TF_LABEL: Record<string,string> = {
  "5M":"5 Dk","15M":"15 Dk","1H":"1 Sa","4H":"4 Sa",
  "1D":"1 Gün","1W":"1 Hf","1M":"1 Ay","1Y":"1 Yıl",
};

function fmt(n: number): string {
  if (!n || !isFinite(n)) return "-";
  if (n >= 1000) return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.001) return n.toFixed(6);
  return n.toFixed(8);
}

function fmtVol(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}

export default function ProfessionalChart({ symbol, market, initialTf = "1D", height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [tf, setTf] = useState(initialTf);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ o:number; h:number; l:number; c:number; v:number; t:string; chg:number } | null>(null);
  const [lastPrice, setLastPrice] = useState<{ price:number; chg:number } | null>(null);

  const initChart = useCallback(async () => {
    if (!containerRef.current) return;
    // dynamic import - runs only client side
    const { createChart, ColorType, CrosshairMode, PriceScaleMode } = await import("lightweight-charts");
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a0f1e" },
        textColor: "#8892a4",
        fontSize: 11,
        fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif",
      },
      grid: {
        vertLines: { color: "#131b2e", style: 1 },
        horzLines: { color: "#131b2e", style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#3a4a6b", labelBackgroundColor: "#1a2540" },
        horzLine: { color: "#3a4a6b", labelBackgroundColor: "#1a2540" },
      },
      rightPriceScale: {
        borderColor: "#1a2035",
        textColor: "#8892a4",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#1a2035",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      watermark: { visible: false },
      handleScale: true,
      handleScroll: true,
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00d4aa",
      downColor: "#ff4757",
      borderVisible: false,
      wickUpColor: "#00d4aa",
      wickDownColor: "#ff4757",
      priceLineVisible: true,
      priceLineColor: "#00d4aa",
      priceLineWidth: 1,
    });

    // Volume series (as histogram on overlay)
    const volumeSeries = chart.addHistogramSeries({
      color: "#1e2d4a",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Crosshair tooltip
    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.seriesData) { setTooltip(null); return; }
      const cData = param.seriesData.get(candleSeries);
      const vData = param.seriesData.get(volumeSeries);
      if (!cData) { setTooltip(null); return; }
      const d = new Date(
        typeof param.time === "number" ? param.time * 1000 : param.time
      );
      const timeStr = d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" });
      const chg = cData.open > 0 ? ((cData.close - cData.open) / cData.open) * 100 : 0;
      setTooltip({ o: cData.open, h: cData.high, l: cData.low, c: cData.close, v: vData?.value || 0, t: timeStr, chg });
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    if (containerRef.current) ro.observe(containerRef.current);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
  }, []);

  const loadData = useCallback(async (currentTf: string) => {
    setLoading(true);
    setError(null);
    setTooltip(null);
    try {
      const r = await fetch(`/api/v1/ohlcv/${encodeURIComponent(symbol)}?tf=${currentTf}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const candles: Candle[] = data.candles || [];
      if (candles.length === 0) throw new Error(data.error || "Veri bulunamadı");

      // Format for lightweight-charts (time must be seconds)
      const lc = candles.map(c => ({
        time: Math.floor(c.t / 1000) as any,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
      }));
      const lv = candles.map(c => ({
        time: Math.floor(c.t / 1000) as any,
        value: c.v,
        color: c.c >= c.o ? "rgba(0,212,170,0.3)" : "rgba(255,71,87,0.3)",
      }));

      candleSeriesRef.current?.setData(lc);
      volumeSeriesRef.current?.setData(lv);
      chartRef.current?.timeScale().fitContent();

      // Last price
      const last = candles[candles.length - 1];
      const first = candles[0];
      const chg = first.c > 0 ? ((last.c - first.c) / first.c) * 100 : 0;
      setLastPrice({ price: last.c, chg });
    } catch (e: any) {
      setError(e.message || "Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    initChart().then(() => loadData(tf));
    return () => {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [symbol]);

  useEffect(() => {
    if (candleSeriesRef.current) loadData(tf);
  }, [tf]);

  const isUp = (lastPrice?.chg ?? 0) >= 0;

  return (
    <div style={{ background: "#0a0f1e", borderRadius: 12, overflow: "hidden", border: "1px solid #1a2540" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", borderBottom: "1px solid #131b2e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e0e6f0", letterSpacing: "0.02em" }}>{symbol}</span>
          {lastPrice && (
            <>
              <span style={{ fontWeight: 700, fontSize: 16, color: isUp ? "#00d4aa" : "#ff4757" }}>
                {fmt(lastPrice.price)}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600,
                padding: "2px 7px", borderRadius: 5,
                background: isUp ? "rgba(0,212,170,0.12)" : "rgba(255,71,87,0.12)",
                color: isUp ? "#00d4aa" : "#ff4757",
              }}>
                {isUp ? "+" : ""}{lastPrice.chg.toFixed(2)}%
              </span>
            </>
          )}
        </div>
        {/* TF Selector */}
        <div style={{ display: "flex", gap: 2 }}>
          {TF_OPTIONS.map(t => (
            <button key={t} onClick={() => setTf(t)} style={{
              padding: "4px 9px", fontSize: 11, fontWeight: 600, borderRadius: 5,
              border: "none", cursor: "pointer",
              background: tf === t ? "#2563eb" : "transparent",
              color: tf === t ? "#fff" : "#5a6a8a",
              transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Tooltip bar */}
      <div style={{
        height: 28, display: "flex", alignItems: "center", gap: 16,
        padding: "0 14px", fontSize: 11, color: "#5a6a8a",
        borderBottom: "1px solid #0f1828",
        visibility: tooltip ? "visible" : "hidden",
        opacity: tooltip ? 1 : 0,
        transition: "opacity 0.1s",
      }}>
        {tooltip && (
          <>
            <span style={{ color: "#8892a4" }}>{tooltip.t}</span>
            <span>O <b style={{ color: "#e0e6f0" }}>{fmt(tooltip.o)}</b></span>
            <span>H <b style={{ color: "#00d4aa" }}>{fmt(tooltip.h)}</b></span>
            <span>L <b style={{ color: "#ff4757" }}>{fmt(tooltip.l)}</b></span>
            <span>C <b style={{ color: tooltip.chg >= 0 ? "#00d4aa" : "#ff4757" }}>{fmt(tooltip.c)}</b></span>
            {tooltip.v > 0 && <span>V <b style={{ color: "#8892a4" }}>{fmtVol(tooltip.v)}</b></span>}
            <span style={{ color: tooltip.chg >= 0 ? "#00d4aa" : "#ff4757", fontWeight: 700 }}>
              {tooltip.chg >= 0 ? "+" : ""}{tooltip.chg.toFixed(2)}%
            </span>
          </>
        )}
      </div>

      {/* Chart container */}
      <div style={{ position: "relative", height, background: "#0a0f1e" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        {/* Loading overlay */}
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(10,15,30,0.85)", zIndex: 10,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 32, height: 32, border: "3px solid #1a2540",
                borderTop: "3px solid #2563eb", borderRadius: "50%",
                margin: "0 auto 10px", animation: "spin 0.7s linear infinite",
              }} />
              <div style={{ color: "#5a6a8a", fontSize: 12 }}>Grafik yükleniyor...</div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
            background: "#0a0f1e",
          }}>
            <div style={{ fontSize: 28 }}>📊</div>
            <div style={{ color: "#ff4757", fontSize: 13 }}>{error}</div>
            <button onClick={() => loadData(tf)} style={{
              marginTop: 6, padding: "6px 16px", borderRadius: 6,
              background: "#2563eb", color: "#fff", border: "none",
              fontSize: 12, cursor: "pointer",
            }}>Tekrar Dene</button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
