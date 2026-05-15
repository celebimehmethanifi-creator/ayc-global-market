"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AssetDetailModal, type AssetInfo } from "@/components/ui/AssetDetailModal";
import {
  Activity,
  ChevronRight,
  Crosshair,
  Eye,
  FlaskConical,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { usePrices } from "@/lib/prices/PriceContext";
import { AITradeModal } from "@/components/ui/AITradeModal";
import { useI18n } from "@/lib/i18n";

type Stage = "TRIGGER" | "SETUP" | "WATCH" | "KALKAN" | "NONE";
type SignalStatus = "active" | "pending" | "blocked" | "no_signal" | "insufficient_data";
type FeedStatus = "live_signals" | "market_live_signal_wait" | "market_live_no_signal" | "insufficient_data" | "api_error";

type RawSignal = {
  symbol?: string;
  name?: string;
  market?: string;
  price?: number;
  change_24h?: number;
  direction?: string;
  confidence?: number;
  reason?: string | null;
  stage?: string;
  signalStatus?: SignalStatus;
  hasSignal?: boolean;
  dataQuality?: string;
  updatedAt?: string;
  created_at?: string;
  trigger_level?: number | null;
  invalidation?: number | null;
  take_profit?: number | null;
  kalkan_reason?: string | null;
  scores?: Record<string, number | null | undefined>;
};

type NormalizedSignal = {
  symbol: string;
  name: string;
  market: string;
  price: number | null;
  change24h: number | null;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number | null;
  stage: Stage;
  hasSignal: boolean;
  signalStatus: SignalStatus;
  reason: string;
  dataQuality: string;
  updatedAtLabel: string;
  triggerLevel: number | null;
  invalidation: number | null;
  takeProfit: number | null;
  kalkanReason: string | null;
  scores: Partial<Record<"opportunity" | "risk" | "confidence" | "trend" | "liquidity" | "volatility", number>>;
};

type StageMeta = {
  label: { tr: string; en: string };
  color: string;
  dim: string;
  border: string;
  icon: ComponentType<any>;
  desc: { tr: string; en: string };
};

const STAGE_META: Record<Stage, StageMeta> = {
  TRIGGER: {
    label: { tr: "Tetik Alarmı", en: "Trigger" },
    color: "var(--up)",
    dim: "var(--up-dim)",
    border: "var(--up-border)",
    icon: Crosshair,
    desc: { tr: "Koşullar tetiklendi, işlem planı oluştu.", en: "Conditions triggered and plan formed." },
  },
  SETUP: {
    label: { tr: "Kurulum Oluşuyor", en: "Setup" },
    color: "var(--gold)",
    dim: "var(--gold-dim)",
    border: "var(--gold-border)",
    icon: Zap,
    desc: { tr: "Kurulum var, tetik bekleniyor.", en: "Setup is ready, waiting for trigger." },
  },
  WATCH: {
    label: { tr: "İzleme", en: "Watch" },
    color: "var(--info)",
    dim: "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.25)",
    icon: Eye,
    desc: { tr: "Piyasa izleniyor, sinyal olgunlaşıyor.", en: "Market is monitored while signal matures." },
  },
  KALKAN: {
    label: { tr: "Kalkan Bloke", en: "Shield Blocked" },
    color: "var(--down)",
    dim: "var(--down-dim)",
    border: "var(--down-border)",
    icon: Shield,
    desc: { tr: "Risk filtresi sinyali engelledi.", en: "Risk filters blocked the signal." },
  },
  NONE: {
    label: { tr: "Sinyal Yok", en: "No Signal" },
    color: "var(--t4)",
    dim: "var(--bg-hover)",
    border: "var(--b1)",
    icon: Activity,
    desc: { tr: "Aktif sinyal bulunmuyor.", en: "No active signal available." },
  },
};

const SCORE_LABELS = {
  opportunity: { tr: "Fırsat", en: "Opportunity" },
  risk: { tr: "Risk", en: "Risk" },
  confidence: { tr: "Güven", en: "Confidence" },
  trend: { tr: "Trend", en: "Trend" },
  liquidity: { tr: "Likidite", en: "Liquidity" },
  volatility: { tr: "Volatilite", en: "Volatility" },
} as const;

function safeNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStatus(raw: RawSignal, hasPrice: boolean): SignalStatus {
  if (raw.signalStatus) return raw.signalStatus;
  if (!hasPrice) return "insufficient_data";
  const stage = String(raw.stage || "").toUpperCase();
  if (stage === "KALKAN") return "blocked";
  if (stage === "TRIGGER" || stage === "SETUP" || stage === "WATCH") return "active";
  const hasSignal = raw.hasSignal ?? ((raw.direction === "LONG" || raw.direction === "SHORT") && (safeNum(raw.confidence) ?? 0) > 0);
  return hasSignal ? "active" : "no_signal";
}

function toStage(raw: RawSignal, status: SignalStatus): Stage {
  const stage = String(raw.stage || "").toUpperCase();
  if (stage === "TRIGGER" || stage === "SETUP" || stage === "WATCH" || stage === "KALKAN" || stage === "NONE") {
    return stage;
  }
  if (status === "blocked") return "KALKAN";
  if (status === "active") return "SETUP";
  if (status === "pending") return "WATCH";
  return "NONE";
}

function toFeedStatus(raw: unknown, pricesLive: boolean, activeCount: number, pendingCount: number): FeedStatus {
  if (raw === "live_signals" || raw === "market_live_signal_wait" || raw === "market_live_no_signal" || raw === "insufficient_data" || raw === "api_error") {
    return raw;
  }
  if (pricesLive && activeCount > 0) return "live_signals";
  if (pricesLive && pendingCount > 0) return "market_live_signal_wait";
  if (pricesLive) return "market_live_no_signal";
  return "insufficient_data";
}

function formatTime(isoLike: string | undefined, locale: "tr" | "en"): string {
  if (!isoLike) return locale === "en" ? "Unknown update time" : "Güncelleme zamanı bilinmiyor";
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return locale === "en" ? "Unknown update time" : "Güncelleme zamanı bilinmiyor";
  return date.toLocaleTimeString(locale === "en" ? "en-US" : "tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatPrice(price: number | null): string {
  if (price == null || price <= 0) return "—";
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
}

function scoreColor(key: keyof typeof SCORE_LABELS, value: number): string {
  if (key === "risk" || key === "volatility") {
    if (value <= 35) return "var(--up)";
    if (value <= 60) return "var(--gold)";
    return "var(--down)";
  }
  if (value >= 65) return "var(--up)";
  if (value >= 45) return "var(--gold)";
  return "var(--down)";
}

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 9, color: "var(--t4)", width: 58, flexShrink: 0, fontWeight: 600 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: "var(--b1)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, color, width: 28, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function SignalCard({
  signal,
  locale,
  onDetail,
  onDemo,
}: {
  signal: NormalizedSignal;
  locale: "tr" | "en";
  onDetail: () => void;
  onDemo: () => void;
}) {
  const stageMeta = STAGE_META[signal.stage];
  const up = (signal.change24h ?? 0) >= 0;
  const scoreEntries = Object.entries(signal.scores).filter(([, value]) => Number.isFinite(value)) as Array<
    [keyof typeof SCORE_LABELS, number]
  >;
  const showScores = signal.hasSignal && scoreEntries.length > 0;
  const showDemoButton = signal.price != null && signal.price > 0;

  return (
    <div
      onClick={onDetail}
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${stageMeta.border}`,
        borderRadius: "var(--r-xl)",
        padding: "16px 18px",
        cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: stageMeta.color, opacity: 0.8 }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              flexShrink: 0,
              background: stageMeta.dim,
              border: `1px solid ${stageMeta.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <stageMeta.icon size={16} color={stageMeta.color} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 800, color: "var(--t1)" }}>{signal.symbol}</div>
            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {signal.name}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: stageMeta.color,
              background: stageMeta.dim,
              border: `1px solid ${stageMeta.border}`,
              padding: "2px 8px",
              borderRadius: 4,
              marginBottom: 4,
              display: "inline-block",
            }}
          >
            {stageMeta.label[locale].toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              color: up ? "var(--up)" : "var(--down)",
              display: "flex",
              alignItems: "center",
              gap: 3,
              justifyContent: "flex-end",
            }}
          >
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {signal.change24h == null ? "—" : `${up ? "+" : ""}${signal.change24h.toFixed(2)}%`}
          </div>
        </div>
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 800, color: "var(--t1)", marginBottom: 10 }}>
        {formatPrice(signal.price)}
      </div>

      <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5, marginBottom: 12, minHeight: 32 }}>
        {signal.reason}
      </div>

      {showScores ? (
        <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 10 }}>
          {scoreEntries.map(([key, value]) => (
            <ScoreBar key={key} label={SCORE_LABELS[key][locale]} value={Math.round(value)} color={scoreColor(key, value)} />
          ))}
        </div>
      ) : (
        <div
          style={{
            border: "1px dashed var(--b1)",
            background: "var(--bg-hover)",
            borderRadius: "var(--r-sm)",
            padding: "9px 10px",
            fontSize: 10,
            color: "var(--t3)",
            lineHeight: 1.45,
            marginBottom: 8,
          }}
        >
          {signal.signalStatus === "insufficient_data"
            ? locale === "en"
              ? "Insufficient technical data for this asset."
              : "Bu varlık için yeterli teknik veri yok."
            : locale === "en"
              ? "No active signal yet. Market data is monitored."
              : "Aktif sinyal yok. Piyasa verisi izleniyor."}
        </div>
      )}

      {(signal.triggerLevel != null || signal.invalidation != null || signal.takeProfit != null) && signal.hasSignal && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 10,
            padding: "8px 10px",
            background: "var(--bg-hover)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {signal.triggerLevel != null && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: "var(--t4)", fontWeight: 700, letterSpacing: "0.06em" }}>{locale === "en" ? "TRIGGER" : "TETİK"}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--up)" }}>${signal.triggerLevel.toLocaleString()}</div>
            </div>
          )}
          {signal.invalidation != null && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: "var(--t4)", fontWeight: 700, letterSpacing: "0.06em" }}>{locale === "en" ? "INVALID" : "İPTAL"}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--down)" }}>${signal.invalidation.toLocaleString()}</div>
            </div>
          )}
          {signal.takeProfit != null && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: "var(--t4)", fontWeight: 700, letterSpacing: "0.06em" }}>{locale === "en" ? "TARGET" : "HEDEF"}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--up)" }}>${signal.takeProfit.toLocaleString()}</div>
            </div>
          )}
        </div>
      )}

      {signal.kalkanReason && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 10px",
            background: "var(--down-dim)",
            border: "1px solid var(--down-border)",
            borderRadius: "var(--r-sm)",
            fontSize: 10,
            color: "var(--down)",
            lineHeight: 1.4,
            display: "flex",
            gap: 6,
            alignItems: "flex-start",
          }}
        >
          <Shield size={10} style={{ flexShrink: 0, marginTop: 1 }} />
          {signal.kalkanReason}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ fontSize: 10, color: "var(--t3)" }}>
          {locale === "en" ? "Updated" : "Güncellendi"}: {signal.updatedAtLabel}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDemo();
            }}
            disabled={!showDemoButton}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid rgba(245,158,11,0.4)",
              background: showDemoButton ? "rgba(245,158,11,0.1)" : "rgba(107,114,128,0.15)",
              color: showDemoButton ? "#f59e0b" : "var(--t4)",
              fontSize: 10,
              fontWeight: 700,
              cursor: showDemoButton ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            title={
              showDemoButton
                ? locale === "en"
                  ? "Open demo trade"
                  : "Demo işlem aç"
                : locale === "en"
                  ? "Demo order disabled because price data is unavailable"
                  : "Fiyat verisi olmadığı için demo işlem kapalı"
            }
          >
            <FlaskConical size={9} />
            {locale === "en" ? "Demo" : "Demo"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--t3)" }}>
            {locale === "en" ? "Deep Analysis" : "Derin Analiz"} <ChevronRight size={10} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignalsPage() {
  const [filter, setFilter] = useState<"all" | "TRIGGER" | "SETUP" | "WATCH" | "KALKAN">("all");
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);
  const [demoTrade, setDemoTrade] = useState<{ symbol: string; name: string } | null>(null);
  const prices = usePrices();
  const { locale } = useI18n();
  const lang: "tr" | "en" = locale === "en" ? "en" : "tr";

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["signals-live", filter],
    queryFn: () =>
      api
        .get("/signals/live?market=all&limit=15")
        .then((response) => response.data)
        .catch(() => ({
          signals: [],
          stage_counts: { TRIGGER: 0, SETUP: 0, WATCH: 0, KALKAN: 0, NONE: 0 },
          prices_live: false,
          feed_status: "api_error",
        })),
    refetchInterval: 60_000,
  });

  const allSignals = useMemo<NormalizedSignal[]>(() => {
    const rawSignals: RawSignal[] = Array.isArray(data?.signals) ? data.signals : [];
    return rawSignals.map((raw) => {
      const symbol = String(raw.symbol || "").toUpperCase();
      const compact = symbol.replace("/", "");
      const liveEntry =
        prices[symbol] ||
        prices[compact] ||
        prices[`${compact}USDT`] ||
        prices[symbol.replace("USDT", "")];

      const livePrice = safeNum(liveEntry?.price);
      const liveChange = safeNum(liveEntry?.chg);
      const rawPrice = safeNum(raw.price);
      const rawChange = safeNum(raw.change_24h);
      const price = livePrice ?? rawPrice;
      const change24h = liveChange ?? rawChange;
      const hasPrice = price != null && price > 0;

      const signalStatus = toStatus(raw, hasPrice);
      const stage = toStage(raw, signalStatus);
      const hasSignal =
        typeof raw.hasSignal === "boolean"
          ? raw.hasSignal
          : signalStatus === "active" || signalStatus === "pending";

      const rawReason = String(raw.reason || "").trim();
      const reason =
        rawReason ||
        (signalStatus === "insufficient_data"
          ? lang === "en"
            ? "Insufficient technical data for this asset."
            : "Bu varlık için yeterli teknik veri yok."
          : signalStatus === "blocked"
            ? lang === "en"
              ? "Signal is blocked by risk filters."
              : "Sinyal risk filtreleri nedeniyle bloke edildi."
            : lang === "en"
              ? "No active signal. Market movement is monitored."
              : "Aktif sinyal yok. Piyasa hareketi izleniyor.");

      const scoreRaw = raw.scores || {};
      const scoreKeys: Array<keyof typeof SCORE_LABELS> = [
        "opportunity",
        "risk",
        "confidence",
        "trend",
        "liquidity",
        "volatility",
      ];
      const scores: NormalizedSignal["scores"] = {};
      for (const key of scoreKeys) {
        const value = safeNum(scoreRaw[key]);
        if (value != null && hasSignal) {
          scores[key] = Math.max(0, Math.min(100, value));
        }
      }

      const confidence = safeNum(raw.confidence);
      if (hasSignal && confidence != null && scores.confidence == null) {
        scores.confidence = Math.max(0, Math.min(100, confidence));
      }

      return {
        symbol,
        name: String(raw.name || symbol || (lang === "en" ? "Unknown asset" : "Bilinmeyen varlık")),
        market: String(raw.market || ""),
        price,
        change24h,
        direction: raw.direction === "SHORT" ? "SHORT" : raw.direction === "LONG" ? "LONG" : "NEUTRAL",
        confidence,
        stage,
        hasSignal,
        signalStatus,
        reason,
        dataQuality: String(raw.dataQuality || (hasPrice ? "live" : "insufficient_data")),
        updatedAtLabel: formatTime(raw.updatedAt || raw.created_at, lang),
        triggerLevel: safeNum(raw.trigger_level),
        invalidation: safeNum(raw.invalidation),
        takeProfit: safeNum(raw.take_profit),
        kalkanReason: raw.kalkan_reason ? String(raw.kalkan_reason) : null,
        scores,
      };
    });
  }, [data?.signals, lang, prices]);

  const counts = useMemo(() => {
    return allSignals.reduce(
      (acc, signal) => {
        acc[signal.stage] += 1;
        return acc;
      },
      { TRIGGER: 0, SETUP: 0, WATCH: 0, KALKAN: 0, NONE: 0 },
    );
  }, [allSignals]);

  const filteredSignals = useMemo(
    () => (filter === "all" ? allSignals : allSignals.filter((signal) => signal.stage === filter)),
    [allSignals, filter],
  );

  const activeCount = allSignals.filter((signal) => signal.signalStatus === "active").length;
  const pendingCount = allSignals.filter((signal) => signal.signalStatus === "pending" || signal.signalStatus === "blocked").length;
  const feedStatus = toFeedStatus(data?.feed_status, Boolean(data?.prices_live), activeCount, pendingCount);

  const feedBadge = useMemo(() => {
    if (feedStatus === "live_signals") {
      return {
        label: lang === "en" ? "LIVE SIGNAL FEED" : "CANLI SİNYAL AKIŞI",
        bg: "rgba(16,185,129,0.15)",
        color: "var(--up)",
        border: "rgba(16,185,129,0.35)",
        subtitle: lang === "en" ? "Market data and signal engine are both active." : "Piyasa verisi ve sinyal motoru aktif.",
      };
    }
    if (feedStatus === "market_live_signal_wait") {
      return {
        label: lang === "en" ? "LIVE MARKET • SIGNAL WAIT" : "CANLI PİYASA • SİNYAL BEKLENİYOR",
        bg: "rgba(245,158,11,0.15)",
        color: "var(--gold)",
        border: "rgba(245,158,11,0.35)",
        subtitle: lang === "en" ? "Price feed is live; signals are still maturing." : "Fiyat verisi canlı; sinyaller olgunlaşıyor.",
      };
    }
    if (feedStatus === "market_live_no_signal") {
      return {
        label: lang === "en" ? "LIVE MARKET • NO ACTIVE SIGNAL" : "CANLI PİYASA • AKTİF SİNYAL YOK",
        bg: "rgba(96,165,250,0.15)",
        color: "var(--info)",
        border: "rgba(96,165,250,0.35)",
        subtitle: lang === "en" ? "Price feed is live; no qualified setup at the moment." : "Fiyat verisi canlı; şu an nitelikli kurulum yok.",
      };
    }
    if (feedStatus === "api_error") {
      return {
        label: lang === "en" ? "SIGNAL API ERROR" : "SİNYAL API HATASI",
        bg: "rgba(239,68,68,0.12)",
        color: "var(--down)",
        border: "rgba(239,68,68,0.35)",
        subtitle: lang === "en" ? "Signal feed could not be fetched." : "Sinyal akışı alınamadı.",
      };
    }
    return {
      label: lang === "en" ? "INSUFFICIENT DATA" : "VERİ YETERSİZ",
      bg: "rgba(107,114,128,0.18)",
      color: "var(--t3)",
      border: "rgba(107,114,128,0.4)",
      subtitle: lang === "en" ? "Insufficient data for reliable signal generation." : "Güvenilir sinyal üretimi için veri yetersiz.",
    };
  }, [feedStatus, lang]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Zap size={18} color="var(--gold)" />
            <h1 style={{ fontFamily: "var(--font-head)", fontSize: 20, fontWeight: 800, color: "var(--t1)", margin: 0 }}>
              {lang === "en" ? "Signal Intelligence" : "Sinyal İstihbaratı"}
            </h1>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                borderRadius: 4,
                padding: "3px 8px",
                background: feedBadge.bg,
                color: feedBadge.color,
                border: `1px solid ${feedBadge.border}`,
              }}
            >
              {feedBadge.label}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--t3)", margin: "4px 0 0", paddingLeft: 28 }}>
            {feedBadge.subtitle}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-ghost" style={{ gap: 6, display: "flex", alignItems: "center" }}>
          <RefreshCw size={12} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          {lang === "en" ? "Refresh" : "Güncelle"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setFilter("all")}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--b1)",
            background: filter === "all" ? "var(--bg-hover)" : "transparent",
            color: filter === "all" ? "var(--t1)" : "var(--t3)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {lang === "en" ? "All" : "Tümü"} ({allSignals.length})
        </button>
        {(["TRIGGER", "SETUP", "WATCH", "KALKAN"] as const).map((stage) => {
          const meta = STAGE_META[stage];
          const count = counts[stage] || 0;
          return (
            <button
              key={stage}
              onClick={() => setFilter(stage)}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--r-md)",
                border: `1px solid ${filter === stage ? meta.border : "var(--b1)"}`,
                background: filter === stage ? meta.dim : "transparent",
                color: filter === stage ? meta.color : "var(--t3)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s",
              }}
            >
              <meta.icon size={11} />
              {meta.label[lang]}
              {count > 0 && (
                <span
                  style={{
                    background: meta.color,
                    color: "var(--bg)",
                    borderRadius: "50%",
                    width: 14,
                    height: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8,
                    fontWeight: 800,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="signal-grid">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="skeleton" style={{ height: 320, borderRadius: "var(--r-xl)" }} />
          ))}
        </div>
      ) : filteredSignals.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--b1)",
            background: "var(--bg-card)",
            borderRadius: "var(--r-xl)",
            padding: "20px 18px",
            color: "var(--t2)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>
            {lang === "en" ? "No active signal" : "Aktif sinyal yok"}
          </div>
          <div>
            {lang === "en"
              ? "There is currently no qualifying setup for this filter. Live market data is monitored continuously."
              : "Bu filtre için şu an nitelikli bir kurulum yok. Canlı piyasa verisi izlenmeye devam ediyor."}
          </div>
        </div>
      ) : (
        <div className="signal-grid">
          {filteredSignals.map((signal) => (
            <SignalCard
              key={signal.symbol}
              signal={signal}
              locale={lang}
              onDemo={() => setDemoTrade({ symbol: signal.symbol.replace("USDT", ""), name: signal.name || signal.symbol })}
              onDetail={() =>
                setSelectedAsset({
                  symbol: signal.symbol,
                  name: signal.name,
                  display: signal.symbol,
                  price: signal.price ?? 0,
                  chg: signal.change24h ?? 0,
                  market: signal.market,
                })
              }
            />
          ))}
        </div>
      )}

      {selectedAsset && <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}
      {demoTrade && (
        <AITradeModal
          symbol={demoTrade.symbol}
          name={demoTrade.name}
          onClose={() => setDemoTrade(null)}
        />
      )}

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--b1)",
          borderRadius: "var(--r-xl)",
          padding: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 12,
        }}
      >
        <div style={{ gridColumn: "1/-1", fontFamily: "var(--font-head)", fontSize: 12, fontWeight: 700, color: "var(--t2)", marginBottom: 4 }}>
          {lang === "en" ? "Signal State Guide" : "Sinyal Durum Rehberi"}
        </div>
        {(["TRIGGER", "SETUP", "WATCH", "KALKAN", "NONE"] as Stage[]).map((stage) => {
          const meta = STAGE_META[stage];
          return (
            <div key={stage} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <meta.icon size={12} color={meta.color} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: meta.color, marginBottom: 2 }}>{meta.label[lang]}</div>
                <div style={{ fontSize: 10, color: "var(--t4)", lineHeight: 1.4 }}>{meta.desc[lang]}</div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
