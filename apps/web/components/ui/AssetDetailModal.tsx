"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  FlaskConical,
  ShieldAlert,
  Target,
  BarChart3,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import ProfessionalChart from "@/components/ui/ProfessionalChart";
import { AITradeModal } from "@/components/ui/AITradeModal";
import RealTradeModal from "@/components/ui/RealTradeModal";
import { useExchange } from "@/lib/exchange/ExchangeContext";
import { mapLegacyStatus, getStatusLabel, getStatusColor, type DataStatus } from "@/lib/markets/data-status";

export type AssetInfo = {
  symbol: string;
  display?: string;
  name: string;
  price?: number;
  chg?: number;
  market?: string;
  confidence?: number;
  direction?: string;
};

type AssetAnalysis = {
  ok: boolean;
  symbol: string;
  timeframe: string;
  technicalSummary?: string;
  fundamentalSummary?: string;
  tradePlan?: {
    direction?: "LONG" | "SHORT" | "NEUTRAL";
    entry?: number | null;
    target?: number | null;
    stopLoss?: number | null;
    riskReward?: number | null;
    confidence?: number | null;
    reason?: string | null;
  };
  technical?: {
    trend?: string;
    rsi?: number | null;
    macd?: number | null;
    sma20?: number | null;
    sma50?: number | null;
    ema12?: number | null;
    ema26?: number | null;
    atr?: number | null;
    support?: number | null;
    resistance?: number | null;
  };
  dataQuality?: {
    status?: string;
    provider?: string | null;
    updatedAt?: string;
  };
  disclaimer?: string;
};

const TIMEFRAMES = ["15M", "1H", "4H", "1D", "1W", "1M"] as const;

function fmtPrice(value: number | null | undefined, maxDecimals = 2): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: Math.min(2, maxDecimals),
      maximumFractionDigits: Math.min(2, maxDecimals),
    });
  }
  if (value < 1) return value.toFixed(Math.min(Math.max(maxDecimals, 4), 8));
  return value.toFixed(Math.min(Math.max(maxDecimals, 2), 6));
}

function fmtPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function normalizeDirection(value: string | undefined): "LONG" | "SHORT" | "NEUTRAL" {
  const input = String(value || "").toUpperCase();
  if (input === "LONG" || input === "BUY" || input === "AL") return "LONG";
  if (input === "SHORT" || input === "SELL" || input === "SAT") return "SHORT";
  return "NEUTRAL";
}


function DirectionChip({ direction }: { direction: "LONG" | "SHORT" | "NEUTRAL" }) {
  const cfg =
    direction === "LONG"
      ? { color: "var(--up)", bg: "var(--up-dim)", border: "var(--up-border)", Icon: TrendingUp, label: "LONG" }
      : direction === "SHORT"
        ? { color: "var(--down)", bg: "var(--down-dim)", border: "var(--down-border)", Icon: TrendingDown, label: "SHORT" }
        : { color: "var(--gold)", bg: "var(--gold-dim)", border: "var(--gold-border)", Icon: Minus, label: "NÖTR" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 8,
        padding: "4px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <cfg.Icon size={12} />
      {cfg.label}
    </span>
  );
}

export function AssetDetailModal({ asset, onClose }: { asset: AssetInfo | null; onClose: () => void }) {
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("1D");
  const [analysis, setAnalysis] = useState<AssetAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [pollPrice, setPollPrice] = useState<number | null>(null);
  const [pollChange, setPollChange] = useState<number | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveChange, setLiveChange] = useState<number | null>(null);

  const [chartLatestClose, setChartLatestClose] = useState<number | null>(null);
  const [chartUpdatedAt, setChartUpdatedAt] = useState<number | null>(null);
  const [chartProvider, setChartProvider] = useState<string>("ohlcv");

  const [showDemoTrade, setShowDemoTrade] = useState(false);
  const [showRealTrade, setShowRealTrade] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const { exchanges } = useExchange();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!asset) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [asset, onClose]);

  useEffect(() => {
    if (!asset) return;
    document.body.classList.add("asset-modal-open");
    return () => {
      document.body.classList.remove("asset-modal-open");
    };
  }, [asset]);

  const fetchLivePrice = useCallback(async (symbol: string) => {
    const normalized = symbol.toUpperCase().replace("/", "");
    try {
      const response = await fetch(`/api/v1/prices/live?symbols=${encodeURIComponent(normalized)}`, {
        signal: AbortSignal.timeout(7000),
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      const entry = data?.prices?.[normalized];
      if (entry && Number(entry.price) > 0) {
        setLivePrice(Number(entry.price));
        const chg = Number(entry.change24h ?? entry.chg);
        if (Number.isFinite(chg)) setLiveChange(chg);
      }
    } catch {
      // no-op
    }
  }, []);

  const fetchFallbackPrice = useCallback(async (symbol: string) => {
    try {
      const response = await fetch(`/api/v1/price/${encodeURIComponent(symbol)}`, {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      if (Number(data?.price) > 0) {
        setPollPrice(Number(data.price));
      }
      const chg = Number(data?.change_24h ?? data?.chg);
      if (Number.isFinite(chg)) setPollChange(chg);
    } catch {
      // no-op
    }
  }, []);

  const fetchAnalysis = useCallback(async (symbol: string, tf: string) => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const response = await fetch(
        `/api/v1/assets/${encodeURIComponent(symbol)}/analysis?timeframe=${encodeURIComponent(tf)}&riskProfile=medium`,
        { signal: AbortSignal.timeout(12000), cache: "no-store" },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAnalysis(data);
    } catch {
      setAnalysis(null);
      setAnalysisError("Analiz verisi alınamadı.");
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!asset) return;

    setAnalysis(null);
    setAnalysisError(null);
    setLivePrice(null);
    setLiveChange(null);
    setPollPrice(asset.price ?? null);
    setPollChange(asset.chg ?? null);
    setChartLatestClose(null);
    setChartUpdatedAt(null);
    setChartProvider("ohlcv");

    fetchLivePrice(asset.symbol);
    fetchFallbackPrice(asset.symbol);
    fetchAnalysis(asset.symbol, timeframe);

    const interval = setInterval(() => {
      fetchLivePrice(asset.symbol);
      fetchFallbackPrice(asset.symbol);
    }, 15000);

    return () => clearInterval(interval);
  }, [asset?.symbol, timeframe, fetchAnalysis, fetchFallbackPrice, fetchLivePrice]);

  if (!asset) return null;

  const direction = normalizeDirection(analysis?.tradePlan?.direction || asset.direction);
  const displayPrice = livePrice ?? pollPrice ?? asset.price ?? 0;
  const displayChange = liveChange ?? pollChange ?? asset.chg ?? 0;
  const isUp = displayChange >= 0;

  const targetPrice = analysis?.tradePlan?.target ?? null;
  const stopLoss = analysis?.tradePlan?.stopLoss ?? null;
  const riskReward = analysis?.tradePlan?.riskReward ?? null;
  const mappedQualityStatus = mapLegacyStatus(analysis?.dataQuality?.status);
  // Only live or delayed real-market data is safe to show trading metrics.
  // fallback, ayc_data, demo, no_data, insufficient must all suppress actionable numbers.
  const hasSufficientData = mappedQualityStatus === "live" || mappedQualityStatus === "delayed";

  const priceDiffPct =
    chartLatestClose && displayPrice > 0 ? Math.abs((chartLatestClose - displayPrice) / displayPrice) * 100 : 0;
  const showDriftWarning = priceDiffPct > 1;
  const headerStatus: DataStatus = analysis?.dataQuality?.status
    ? mapLegacyStatus(analysis.dataQuality.status)
    : livePrice ? "delayed" : "no_data";
  const isBistAsset = asset.symbol.endsWith(".IS") || asset.market === "bist";

  const headerTitle = asset.display || asset.symbol;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(8,10,16,0.8)",
          backdropFilter: "blur(8px)",
        }}
      />

      <div
        className="asset-detail-panel"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobile ? "100vw" : "min(960px, 97vw)",
          maxWidth: "100vw",
          zIndex: 1001,
          background: "var(--bg-panel)",
          borderLeft: "1px solid var(--b2)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 12,
            background: "var(--bg-card)",
            borderBottom: "1px solid var(--b1)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-head)", fontSize: 22, fontWeight: 800, color: "var(--t1)" }}>{headerTitle}</span>
                <span style={{ fontSize: 13, color: "var(--t2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>{asset.name}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 800, color: "var(--t1)" }}>{fmtPrice(displayPrice)}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: isUp ? "var(--up)" : "var(--down)" }}>{fmtPercent(displayChange)}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: getStatusColor(headerStatus),
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 8,
                    border: `1px solid ${getStatusColor(headerStatus)}33`,
                    background: `${getStatusColor(headerStatus)}14`,
                    padding: "2px 8px",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: getStatusColor(headerStatus),
                      boxShadow: `0 0 8px ${getStatusColor(headerStatus)}`,
                    }}
                  />
                  {getStatusLabel(headerStatus)}
                </span>
                {isBistAsset && headerStatus !== "live" && (
                  <span style={{ fontSize: 11, color: "var(--t3)" }} title="BIST gerçek zamanlı fiyat/hacim için lisanslı veri sağlayıcı gereklidir.">
                    BIST: Lisans gerekli
                  </span>
                )}
                {showDriftWarning && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#f59e0b",
                      border: "1px solid rgba(245,158,11,0.35)",
                      borderRadius: 8,
                      padding: "1px 7px",
                      background: "rgba(245,158,11,0.1)",
                    }}
                    title={chartUpdatedAt ? new Date(chartUpdatedAt).toLocaleString("tr-TR") : undefined}
                  >
                    Fark %{priceDiffPct.toFixed(2)} ({chartProvider})
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                border: "1px solid var(--b1)",
                borderRadius: 8,
                background: "var(--bg-hover)",
                color: "var(--t2)",
                padding: 8,
                cursor: "pointer",
                display: "inline-flex",
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setShowDemoTrade(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                borderRadius: 8,
                border: "1px solid rgba(245,158,11,0.35)",
                background: "rgba(245,158,11,0.12)",
                color: "#f59e0b",
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <FlaskConical size={13} /> Demo İşlem
            </button>

            {exchanges.length > 0 ? (
              <button
                onClick={() => setShowRealTrade(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  borderRadius: 8,
                  border: "1px solid rgba(16,185,129,0.5)",
                  background: "rgba(16,185,129,0.2)",
                  color: "#10b981",
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Gerçek İşlem
              </button>
            ) : (
              <a
                href="/brokers"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)",
                  color: "var(--t3)",
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Borsa Bağla
              </a>
            )}
          </div>
        </div>

        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 14 }}>
          <ProfessionalChart
            symbol={asset.symbol}
            onLatestCandleClose={(close, updatedAt, source) => {
              setChartLatestClose(close);
              setChartUpdatedAt(updatedAt);
              setChartProvider(source || "ohlcv");
            }}
            height={isMobile ? 360 : 480}
          />

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  borderRadius: 7,
                  border: `1px solid ${timeframe === tf ? "var(--gold-border)" : "var(--b1)"}`,
                  background: timeframe === tf ? "var(--gold-dim)" : "var(--bg-card)",
                  color: timeframe === tf ? "var(--gold-bright)" : "var(--t3)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "5px 9px",
                  cursor: "pointer",
                }}
              >
                {tf}
              </button>
            ))}
            <button
              onClick={() => asset && fetchAnalysis(asset.symbol, timeframe)}
              className="btn-ghost"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "5px 10px" }}
            >
              <RefreshCw size={12} style={{ animation: analysisLoading ? "spin 0.9s linear infinite" : "none" }} />
              Yenile
            </button>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--b1)",
              borderRadius: "var(--r-lg)",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {hasSufficientData && <DirectionChip direction={direction} />}
                {analysis?.dataQuality?.status && (
                  <span style={{ fontSize: 10, color: getStatusColor(mapLegacyStatus(analysis.dataQuality.status)), fontWeight: 700 }}>
                    {getStatusLabel(mapLegacyStatus(analysis.dataQuality.status))}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, color: "var(--t4)" }}>
                {analysis?.dataQuality?.updatedAt
                  ? new Date(analysis.dataQuality.updatedAt).toLocaleString("tr-TR")
                  : ""}
              </span>
            </div>

            {analysisError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 7,
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.28)",
                  background: "rgba(239,68,68,0.1)",
                  padding: "8px 10px",
                }}
              >
                <AlertCircle size={14} color="var(--down)" style={{ marginTop: 1 }} />
                <span style={{ fontSize: 12, color: "#fca5a5" }}>{analysisError}</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              <MetricCard icon={<Target size={12} color="var(--up)" />} label="Hedef" value={hasSufficientData ? fmtPrice(targetPrice) : "Veri yetersiz"} />
              <MetricCard icon={<ShieldAlert size={12} color="var(--down)" />} label="Stop Loss" value={hasSufficientData ? fmtPrice(stopLoss) : "Veri yetersiz"} />
              <MetricCard
                icon={<BarChart3 size={12} color="var(--gold)" />}
                label="Risk/Ödül"
                value={hasSufficientData && riskReward != null && Number.isFinite(riskReward) ? `${riskReward.toFixed(2)}x` : "Veri yetersiz"}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              <TextBox title="Teknik Analiz" text={hasSufficientData ? (analysis?.technicalSummary || "Teknik analiz için yeterli veri yok.") : "Teknik analiz için yeterli veri yok."} />
              <TextBox title="Temel Analiz" text={hasSufficientData ? (analysis?.fundamentalSummary || "Temel analiz için güvenilir veri yok.") : "Temel analiz için güvenilir veri yok."} />
            </div>

            {hasSufficientData && analysis?.technical && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <TinyBadge label="RSI" value={analysis.technical.rsi != null ? analysis.technical.rsi.toFixed(2) : "—"} />
                <TinyBadge label="MACD" value={analysis.technical.macd != null ? analysis.technical.macd.toFixed(4) : "—"} />
                <TinyBadge label="ATR" value={analysis.technical.atr != null ? analysis.technical.atr.toFixed(4) : "—"} />
                <TinyBadge label="Destek" value={analysis.technical.support != null ? fmtPrice(analysis.technical.support) : "—"} />
                <TinyBadge label="Direnç" value={analysis.technical.resistance != null ? fmtPrice(analysis.technical.resistance) : "—"} />
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--t4)", lineHeight: 1.5 }}>
              {analysis?.disclaimer || "Bu içerik yatırım tavsiyesi değildir."}
            </div>
          </div>
        </div>
      </div>

      {showDemoTrade && asset && (
        <AITradeModal
          symbol={asset.symbol}
          name={asset.name || asset.display || asset.symbol}
          seedPrice={displayPrice}
          seedChg={displayChange}
          onClose={() => setShowDemoTrade(false)}
        />
      )}

      {showRealTrade && asset && (
        <RealTradeModal
          isOpen={showRealTrade}
          onClose={() => setShowRealTrade(false)}
          symbol={asset.symbol}
          name={asset.name || asset.display || asset.symbol}
          price={displayPrice}
          defaultSide="buy"
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--b1)", borderRadius: "var(--r-md)", background: "var(--bg)", padding: "10px 11px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--t1)", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function TextBox({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ border: "1px solid var(--b1)", borderRadius: "var(--r-md)", background: "var(--bg)", padding: "10px 11px" }}>
      <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function TinyBadge({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 6,
        border: "1px solid var(--b1)",
        background: "var(--bg)",
        padding: "4px 8px",
      }}
      >
      <span style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--t2)", fontWeight: 700 }}>{value}</span>
    </span>
  );
}

