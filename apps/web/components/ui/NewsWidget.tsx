"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: string;
  sentiment: "bullish" | "bearish" | "neutral";
  category: string;
}

interface Props {
  category?: string;
  limit?: number;
  compact?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "Tüm Haberler",
  global: "Global",
  turkey: "BIST / TR",
  crypto: "Kripto",
  macro: "Makro",
  geo: "Jeopolitik",
};

const SENTIMENT_COLORS = {
  bullish: "var(--up)",
  bearish: "var(--down)",
  neutral: "var(--t3)",
};

export function NewsWidget({ category = "all", limit = 8, compact = false }: Props) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["news", category, limit],
    queryFn: () =>
      api.get(`/news/global?category=${category === "turkey" ? "bist" : category}&limit=${limit}`).then((r) => r.data),
    refetchInterval: 5 * 60 * 1000, // 5 min
    staleTime: 4 * 60 * 1000,
  });

  const items: NewsItem[] = data?.items || [];

  const SentimentIcon = ({ s }: { s: string }) =>
    s === "bullish" ? <TrendingUp size={9} color="var(--up)" /> :
    s === "bearish" ? <TrendingDown size={9} color="var(--down)" /> :
    <Minus size={9} color="var(--t4)" />;

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--b1)",
      borderRadius: "var(--r-xl)", padding: compact ? 12 : 16,
      display: "flex", flexDirection: "column", gap: 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Newspaper size={12} color="var(--gold)" />
          <span style={{ fontFamily: "var(--font-head)", fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>
            {CATEGORY_LABELS[category] || "Haberler"}
          </span>
          {data?.count > 0 && (
            <span style={{
              padding: "1px 6px", borderRadius: 8, background: "var(--gold-dim)",
              fontSize: 9, fontWeight: 700, color: "var(--gold)",
            }}>{data.count}</span>
          )}
        </div>
        <button onClick={() => refetch()} style={{
          background: "none", border: "none", cursor: "pointer", padding: 4,
          display: "flex", alignItems: "center",
        }}>
          <RefreshCw size={11} color="var(--t3)"
            style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{
              height: 48, background: "rgba(255,255,255,0.03)",
              borderRadius: "var(--r-sm)", animation: "pulse 1.5s ease-in-out infinite"
            }} />
          ))}
        </div>
      )}

      {/* News list */}
      {!isLoading && items.map((item, i) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", gap: 8, padding: "9px 0",
            borderBottom: i < items.length - 1 ? "1px solid var(--b1)" : "none",
            textDecoration: "none", cursor: "pointer",
          }}
        >
          <div style={{ flexShrink: 0, marginTop: 3 }}>
            <SentimentIcon s={item.sentiment} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: compact ? 11 : 12, color: "var(--t1)", fontWeight: 500,
              lineHeight: 1.4, marginBottom: 3,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>
              {item.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 9, color: "var(--gold)", fontWeight: 600,
                background: "var(--gold-dim)", padding: "1px 6px", borderRadius: 4,
              }}>{item.source || "News"}</span>
              <span style={{
                fontSize: 9, color: (SENTIMENT_COLORS as any)[item.sentiment] || "var(--t3)",
                fontWeight: 600,
              }}>
                {item.sentiment === "bullish" ? "↑ Yükseliş" : item.sentiment === "bearish" ? "↓ Düşüş" : "→ Nötr"}
              </span>
            </div>
          </div>
          <ExternalLink size={9} color="var(--t4)" style={{ flexShrink: 0, marginTop: 3 }} />
        </a>
      ))}

      {!isLoading && items.length === 0 && (
        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
          Haber yüklenemedi — RSS bağlantısı kontrol ediliyor...
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
    </div>
  );
}

