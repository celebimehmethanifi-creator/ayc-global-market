"use client";

import { useMemo, useState } from "react";
import { Users, Zap } from "lucide-react";
import { AssetDetailModal, type AssetInfo } from "@/components/ui/AssetDetailModal";
import {
  ASSET_UNIVERSE,
  getAssetDisplayName,
  getCategoryLabel,
  type AssetCategory,
} from "@/lib/markets/asset-universe";
import { useI18n } from "@/lib/i18n";

type SentimentPoint = {
  bull: number;
  bear: number;
  neutral: number;
  votes: number;
  dataQuality: "demo" | "live" | "fallback";
};

type CategoryKey = "all" | AssetCategory;

const CATEGORY_ORDER: CategoryKey[] = [
  "all",
  "crypto",
  "us",
  "bist",
  "precious",
  "commodity",
  "energy",
  "forex",
  "index",
  "etf",
];

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  all: "var(--t2)",
  crypto: "#f59e0b",
  us: "#818cf8",
  bist: "#f97316",
  precious: "#10b981",
  commodity: "#14b8a6",
  energy: "#0ea5e9",
  forex: "#38bdf8",
  index: "#a78bfa",
  etf: "#22c55e",
};

function seededSentiment(symbol: string): SentimentPoint {
  const hash = symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const bull = 35 + (hash % 46);
  const bear = 12 + ((hash * 3) % 35);
  const neutral = Math.max(0, 100 - bull - bear);
  const votes = 120 + (hash % 1800);
  return {
    bull,
    bear,
    neutral,
    votes,
    dataQuality: "demo",
  };
}

function VoteBar({ bull, bear, neutral }: { bull: number; bear: number; neutral: number }) {
  return (
    <div style={{ display: "flex", height: 6, borderRadius: 4, overflow: "hidden", gap: 1 }}>
      <div style={{ width: `${bull}%`, background: "var(--up)" }} />
      <div style={{ width: `${neutral}%`, background: "var(--neutral)" }} />
      <div style={{ width: `${bear}%`, background: "var(--down)" }} />
    </div>
  );
}

export default function SocialPage() {
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "tr";
  const [category, setCategory] = useState<CategoryKey>("all");
  const [votes, setVotes] = useState<Record<string, "bull" | "neutral" | "bear">>({});
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);

  const rows = useMemo(() => {
    return ASSET_UNIVERSE.filter((item) => item.isChartable).map((item) => ({
      ...item,
      sentiment: seededSentiment(item.symbol),
    }));
  }, []);

  const filtered = useMemo(() => {
    const base = category === "all" ? rows : rows.filter((row) => row.category === category);
    return base.slice(0, 36);
  }, [category, rows]);

  const categoryStats = useMemo(() => {
    return CATEGORY_ORDER.filter((key) => key !== "all").map((key) => {
      const items = rows.filter((row) => row.category === key);
      const bullAvg = items.length
        ? Math.round(items.reduce((sum, row) => sum + row.sentiment.bull, 0) / items.length)
        : 0;
      const bearAvg = items.length
        ? Math.round(items.reduce((sum, row) => sum + row.sentiment.bear, 0) / items.length)
        : 0;
      return {
        key,
        count: items.length,
        bullAvg,
        bearAvg,
      };
    });
  }, [rows]);

  const categoryLabel = (key: CategoryKey): string => {
    if (key === "all") return lang === "en" ? "All" : "Tümü";
    return getCategoryLabel(key, lang);
  };

  const trendLabel = (direction: "bull" | "neutral" | "bear") => {
    if (lang === "en") {
      if (direction === "bull") return "Bullish";
      if (direction === "bear") return "Bearish";
      return "Neutral";
    }
    if (direction === "bull") return "Yükseliş";
    if (direction === "bear") return "Düşüş";
    return "Nötr";
  };

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={18} color="var(--gold)" />
          <h1 style={{ margin: 0, fontSize: 20, color: "var(--t1)", fontFamily: "var(--font-head)" }}>
            {lang === "en" ? "Social Radar" : "Sosyal Radar"}
          </h1>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t3)" }}>
          {lang === "en"
            ? "Community sentiment by market category (demo fallback shown transparently)."
            : "Piyasa kategorilerine göre topluluk duyarlılığı (demo fallback açıkça gösterilir)."}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        {categoryStats.map((stat) => (
          <button
            key={stat.key}
            onClick={() => setCategory(category === stat.key ? "all" : stat.key)}
            style={{
              background: "var(--bg-card)",
              border: `1px solid ${category === stat.key ? `${CATEGORY_COLORS[stat.key]}55` : "var(--b1)"}`,
              borderRadius: "var(--r-md)",
              padding: "10px 12px",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: CATEGORY_COLORS[stat.key], fontWeight: 700 }}>{categoryLabel(stat.key)}</span>
              <span style={{ fontSize: 10, color: "var(--t4)" }}>{stat.count}</span>
            </div>
            {stat.count > 0 ? (
              <>
                <VoteBar bull={stat.bullAvg} bear={stat.bearAvg} neutral={Math.max(0, 100 - stat.bullAvg - stat.bearAvg)} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                  <span style={{ fontSize: 10, color: "var(--up)" }}>{trendLabel("bull")} {stat.bullAvg}%</span>
                  <span style={{ fontSize: 10, color: "var(--down)" }}>{trendLabel("bear")} {stat.bearAvg}%</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "var(--t3)" }}>{lang === "en" ? "No data" : "Veri yok"}</div>
            )}
          </button>
        ))}
      </div>

      <div className="cat-pills social-cats">
        {CATEGORY_ORDER.map((key) => (
          <button
            key={key}
            className={`cat-pill${category === key ? " active" : ""}`}
            onClick={() => setCategory(key)}
          >
            {categoryLabel(key)}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
        {filtered.map((asset) => {
          const sentiment = asset.sentiment;
          const userVote = votes[asset.symbol];

          return (
            <div
              key={asset.symbol}
              className="card"
              style={{ display: "flex", flexDirection: "column", gap: 10, cursor: "pointer" }}
              onClick={() =>
                setSelectedAsset({
                  symbol: asset.symbol,
                  display: asset.displaySymbol,
                  name: getAssetDisplayName(asset, lang),
                  price: 0,
                  chg: 0,
                  market: asset.category,
                })
              }
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--t1)", fontWeight: 800 }}>
                    {asset.displaySymbol}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {getAssetDisplayName(asset, lang)}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--t3)",
                    border: "1px solid var(--b1)",
                    borderRadius: 6,
                    padding: "2px 7px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {categoryLabel(asset.category)}
                </span>
              </div>

              <VoteBar bull={sentiment.bull} bear={sentiment.bear} neutral={sentiment.neutral} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                <SmallMetric label={trendLabel("bull")} value={`${sentiment.bull}%`} color="var(--up)" />
                <SmallMetric label={trendLabel("neutral")} value={`${sentiment.neutral}%`} color="var(--t3)" />
                <SmallMetric label={trendLabel("bear")} value={`${sentiment.bear}%`} color="var(--down)" />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 10, color: "var(--t4)" }}>{sentiment.votes.toLocaleString("en-US")} {lang === "en" ? "votes" : "oy"}</span>
                <span style={{ fontSize: 10, color: "var(--warn)" }}>{lang === "en" ? "Demo" : "Demo"}</span>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {(["bull", "neutral", "bear"] as const).map((dir) => {
                  const active = userVote === dir;
                  const isBull = dir === "bull";
                  const isBear = dir === "bear";
                  return (
                    <button
                      key={`${asset.symbol}-${dir}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setVotes((prev) => ({ ...prev, [asset.symbol]: dir }));
                      }}
                      style={{
                        flex: 1,
                        borderRadius: 7,
                        border: `1px solid ${active ? (isBull ? "var(--up-border)" : isBear ? "var(--down-border)" : "var(--b2)") : "var(--b1)"}`,
                        background: active ? (isBull ? "var(--up-dim)" : isBear ? "var(--down-dim)" : "var(--bg-hover)") : "transparent",
                        color: active ? (isBull ? "var(--up)" : isBear ? "var(--down)" : "var(--t2)") : "var(--t3)",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "7px 4px",
                        cursor: "pointer",
                      }}
                    >
                      {trendLabel(dir)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ border: "1px dashed var(--b1)", borderRadius: "var(--r-md)", padding: 20, textAlign: "center", color: "var(--t3)" }}>
          {lang === "en" ? "No assets in this category" : "Bu kategoride varlık yok"}
        </div>
      )}

      <div
        style={{
          border: "1px solid var(--b1)",
          borderRadius: "var(--r-md)",
          padding: "10px 12px",
          background: "var(--bg-hover)",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <Zap size={12} color="var(--warn)" style={{ marginTop: 1 }} />
        <span style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5 }}>
          {lang === "en"
            ? "Social Radar is informational and may run in demo fallback mode when provider data is missing. This is not investment advice."
            : "Sosyal Radar bilgilendirme amaçlıdır; sağlayıcı verisi yoksa demo fallback modunda çalışabilir. Bu içerik yatırım tavsiyesi değildir."}
        </span>
      </div>

      <style>{`
        .social-cats {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          flex-wrap: nowrap;
          scrollbar-width: none;
          padding-bottom: 2px;
        }
        .social-cats::-webkit-scrollbar {
          display: none;
        }
        .social-cats .cat-pill {
          white-space: nowrap;
          flex-shrink: 0;
        }
      `}</style>
      <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </div>
  );
}

function SmallMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--bg-hover)", borderRadius: 7, padding: "7px 8px" }}>
      <div style={{ fontSize: 9, color: "var(--t4)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color }}>{value}</div>
    </div>
  );
}

