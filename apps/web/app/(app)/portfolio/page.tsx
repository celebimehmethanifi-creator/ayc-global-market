"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AssetDetailModal, type AssetInfo } from "@/components/ui/AssetDetailModal";
import { useDemo } from "@/lib/demo/DemoContext";
import { usePrices } from "@/lib/prices/PriceContext";
import { useI18n } from "@/lib/i18n";
import {
  getAssetDisplayName,
  getCategoryLabel,
  searchAssets,
} from "@/lib/markets/asset-universe";
import {
  Briefcase,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  FlaskConical,
  Plus,
  Search,
  X,
} from "lucide-react";

type WatchAsset = {
  symbol: string;
  name: string;
  category: string;
  custom: boolean;
};

type DemoPortfolioPosition = {
  id: string;
  symbol: string;
  name: string;
  category: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  markPrice: number;
  quantity: number;
  investedUSD: number;
  openPnl: number;
  openPnlPct: number;
};

const WATCHLIST_KEY = "ayc_portfolio_watchlist_v1";

function fmtCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (value >= 1) return value.toFixed(3);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

function getPositionCategory(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith(".IS")) return "bist";
  if (upper.endsWith("USDT")) return "crypto";
  if (upper === "XAUUSD" || upper === "XAGUSD") return "precious";
  if (upper.endsWith("USD") || upper.endsWith("TRY") || upper.endsWith("JPY") || upper.endsWith("EUR")) return "forex";
  return "us";
}

function SymbolSearch({
  locale,
  onSelect,
}: {
  locale: "tr" | "en";
  onSelect: (item: WatchAsset) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const results = searchAssets(q, locale, 8);
  const trimmed = q.trim().toUpperCase();
  const hasCustomOption = trimmed.length >= 2 && results.length === 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }} />
        <input
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={locale === "en" ? "BTC, THYAO, AAPL or custom symbol" : "BTC, THYAO, AAPL veya özel sembol"}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "8px 12px 8px 32px",
            borderRadius: 8,
            border: "1px solid var(--b1)",
            background: "var(--bg-hover)",
            color: "var(--t1)",
            fontFamily: "var(--font-body)",
          }}
        />
      </div>

      {open && (results.length > 0 || hasCustomOption) && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 200,
            background: "var(--bg-panel)",
            border: "1px solid var(--b2)",
            borderRadius: "var(--r-md)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          {results.map((asset) => (
            <button
              key={asset.symbol}
              type="button"
              onClick={() => {
                onSelect({
                  symbol: asset.symbol,
                  name: getAssetDisplayName(asset, locale),
                  category: asset.category,
                  custom: false,
                });
                setQ(asset.symbol);
                setOpen(false);
              }}
              style={{
                width: "100%",
                border: "none",
                borderBottom: "1px solid var(--b1)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                textAlign: "left",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>{asset.displaySymbol}</div>
                <div style={{ fontSize: 10, color: "var(--t3)" }}>{getAssetDisplayName(asset, locale)}</div>
              </div>
              <span style={{ fontSize: 10, color: "var(--t3)" }}>{getCategoryLabel(asset.category, locale)}</span>
            </button>
          ))}

          {hasCustomOption && (
            <button
              type="button"
              onClick={() => {
                onSelect({
                  symbol: trimmed,
                  name: trimmed,
                  category: "custom",
                  custom: true,
                });
                setQ(trimmed);
                setOpen(false);
              }}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                textAlign: "left",
              }}
            >
              <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--gold-dim)", border: "1px solid var(--gold-border)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Plus size={12} color="var(--gold)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{trimmed}</div>
                <div style={{ fontSize: 10, color: "var(--t3)", lineHeight: 1.45 }}>
                  {trimmed} {locale === "en" ? "has no live market data." : "için canlı piyasa verisi bulunamadı."}
                </div>
                <div style={{ fontSize: 10, color: "var(--t3)", lineHeight: 1.45 }}>
                  {locale === "en"
                    ? "You can add it as a custom watch item. AI analysis may be limited."
                    : "Özel takip kaydı olarak ekleyebilirsiniz. AI analizi sınırlı olabilir."}
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const { demo, totalValue, totalPnlUSD, totalPnlPct, openPnlUSD } = useDemo();
  const prices = usePrices();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "tr";

  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);
  const [showAddWatch, setShowAddWatch] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchAsset[]>([]);

  const getLivePrice = (symbol: string): number | null => {
    const normalized = symbol.toUpperCase();
    const compact = normalized.replace(/[/.]/g, "");
    const keys = [normalized, compact];
    if (!normalized.endsWith("USDT") && normalized.length <= 6) {
      keys.push(`${normalized}USDT`);
    }
    for (const key of keys) {
      const entry = prices[key];
      if (entry && Number(entry.price) > 0) {
        return Number(entry.price);
      }
    }
    return null;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setWatchlist(
          parsed
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              symbol: String(item.symbol || "").toUpperCase(),
              name: String(item.name || item.symbol || "").trim(),
              category: String(item.category || "custom"),
              custom: Boolean(item.custom),
            }))
            .filter((item) => item.symbol.length > 0),
        );
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch {
      // no-op
    }
  }, [watchlist]);

  const demoPositions = useMemo<DemoPortfolioPosition[]>(() => {
    return demo.openTrades.map((trade) => {
      const live = getLivePrice(trade.symbol) ?? trade.entryPrice;
      const invested = Number.isFinite(trade.investedUSD) && trade.investedUSD > 0
        ? trade.investedUSD
        : trade.entryPrice * trade.quantity;
      const openPnl = trade.direction === "LONG"
        ? (live - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - live) * trade.quantity;
      const openPnlPct = invested > 0 ? (openPnl / invested) * 100 : 0;
      return {
        id: trade.id,
        symbol: trade.symbol,
        name: trade.name || trade.symbol,
        category: getPositionCategory(trade.symbol),
        side: trade.direction,
        entryPrice: trade.entryPrice,
        markPrice: live,
        quantity: trade.quantity,
        investedUSD: invested,
        openPnl,
        openPnlPct,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.openTrades, prices]);

  const addWatch = (asset: WatchAsset) => {
    setWatchlist((prev) => {
      if (prev.some((item) => item.symbol === asset.symbol)) return prev;
      return [asset, ...prev].slice(0, 30);
    });
    setShowAddWatch(false);
  };

  const removeWatch = (symbol: string) => {
    setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
  };

  const openAssetDetail = (symbol: string, name: string, market: string, price = 0) => {
    setSelectedAsset({
      symbol,
      display: symbol,
      name,
      price,
      chg: 0,
      market,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Briefcase size={18} color="var(--gold)" />
            <h1 style={{ margin: 0, fontFamily: "var(--font-head)", fontSize: 20, color: "var(--t1)" }}>
              {lang === "en" ? "Portfolio" : "Portföyüm"}
            </h1>
          </div>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--t3)", paddingLeft: 27 }}>
            {lang === "en"
              ? "Portfolio is derived from your demo positions."
              : "Portföy, demo işlemlerinizden otomatik oluşturulur."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowAddWatch(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={13} /> {lang === "en" ? "Add Watch Item" : "Takip Varlığı Ekle"}
          </button>
          <Link href="/market" className="btn-gold" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <FlaskConical size={13} /> {lang === "en" ? "Open Demo Trade" : "Demo İşlem Aç"}
          </Link>
        </div>
      </div>

      <div style={{
        border: "1px solid rgba(245,158,11,0.28)",
        background: "rgba(245,158,11,0.08)",
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 12,
        color: "var(--t2)",
      }}>
        {lang === "en"
          ? "Demo trades are educational. Real exchange orders are never sent from demo mode."
          : "Demo işlemler eğitim amaçlıdır. Demo moddan gerçek borsa emri gönderilmez."}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <StatCard
          icon={<DollarSign size={13} color="var(--gold)" />}
          label={lang === "en" ? "Demo Balance" : "Demo Bakiye"}
          value={fmtCurrency(demo.balance)}
          sub={lang === "en" ? "Virtual principal" : "Sanal ana bakiye"}
        />
        <StatCard
          icon={<Activity size={13} color="var(--info)" />}
          label="Equity"
          value={fmtCurrency(totalValue)}
          sub={lang === "en" ? "Balance + PnL" : "Bakiye + K/Z"}
        />
        <StatCard
          icon={openPnlUSD >= 0 ? <TrendingUp size={13} color="var(--up)" /> : <TrendingDown size={13} color="var(--down)" />}
          label={lang === "en" ? "Open PnL" : "Açık K/Z"}
          value={`${openPnlUSD >= 0 ? "+" : ""}${fmtCurrency(openPnlUSD)}`}
          sub={`${demo.openTrades.length} ${lang === "en" ? "open positions" : "açık pozisyon"}`}
        />
        <StatCard
          icon={demo.realizedPnl >= 0 ? <TrendingUp size={13} color="var(--up)" /> : <TrendingDown size={13} color="var(--down)" />}
          label={lang === "en" ? "Realized PnL" : "Gerçekleşen K/Z"}
          value={`${demo.realizedPnl >= 0 ? "+" : ""}${fmtCurrency(demo.realizedPnl)}`}
          sub={`${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}% ${lang === "en" ? "total" : "toplam"}`}
        />
      </div>

      {demoPositions.length === 0 ? (
        <div style={{
          border: "1px dashed var(--b1)",
          borderRadius: "var(--r-lg)",
          padding: 28,
          textAlign: "center",
          color: "var(--t3)",
          background: "var(--bg-card)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>
            {lang === "en" ? "No demo positions yet" : "Henüz demo pozisyon yok"}
          </div>
          <div style={{ fontSize: 12, marginBottom: 14 }}>
            {lang === "en"
              ? "Open a demo trade from market or asset detail to populate your portfolio."
              : "Portföyü doldurmak için marketten veya varlık detayından demo işlem açın."}
          </div>
          <Link href="/market" className="btn-gold" style={{ textDecoration: "none" }}>
            {lang === "en" ? "Go to Markets" : "Piyasalara Git"}
          </Link>
        </div>
      ) : (
        <>
          <div className="portfolio-demo-table-wrap">
            <table className="market-table" style={{ width: "100%", minWidth: 760 }}>
              <thead>
                <tr>
                  <th>{lang === "en" ? "Symbol" : "Kod"}</th>
                  <th>{lang === "en" ? "Side" : "Yön"}</th>
                  <th style={{ textAlign: "right" }}>{lang === "en" ? "Entry" : "Giriş"}</th>
                  <th style={{ textAlign: "right" }}>{lang === "en" ? "Mark" : "Anlık"}</th>
                  <th style={{ textAlign: "right" }}>{lang === "en" ? "Quantity" : "Miktar"}</th>
                  <th style={{ textAlign: "right" }}>{lang === "en" ? "Open PnL" : "Açık K/Z"}</th>
                  <th>{lang === "en" ? "Analysis" : "Analiz"}</th>
                </tr>
              </thead>
              <tbody>
                {demoPositions.map((position) => {
                  const up = position.openPnl >= 0;
                  return (
                    <tr key={position.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => openAssetDetail(position.symbol, position.name, position.category, position.markPrice)}
                          style={{ border: "none", background: "none", padding: 0, color: "inherit", cursor: "pointer", textAlign: "left" }}
                        >
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>{position.symbol}</div>
                          <div style={{ fontSize: 10, color: "var(--t3)" }}>{position.name}</div>
                        </button>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 4,
                          padding: "2px 7px",
                          border: up ? "1px solid var(--up-border)" : "1px solid var(--down-border)",
                          background: up ? "var(--up-dim)" : "var(--down-dim)",
                          color: up ? "var(--up)" : "var(--down)",
                        }}>
                          {position.side}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>${fmtPrice(position.entryPrice)}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>${fmtPrice(position.markPrice)}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{position.quantity.toFixed(position.quantity < 1 ? 4 : 2)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: up ? "var(--up)" : "var(--down)", fontSize: 12 }}>
                          {up ? "+" : ""}{fmtCurrency(position.openPnl)}
                        </div>
                        <div style={{ fontSize: 10, color: up ? "var(--up)" : "var(--down)" }}>
                          {up ? "+" : ""}{position.openPnlPct.toFixed(2)}%
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn-ghost"
                          type="button"
                          onClick={() => openAssetDetail(position.symbol, position.name, position.category, position.markPrice)}
                          style={{ padding: "4px 10px", fontSize: 11 }}
                        >
                          {lang === "en" ? "Open" : "Aç"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="portfolio-mobile-list" style={{ display: "none", flexDirection: "column", gap: 10 }}>
            {demoPositions.map((position) => {
              const up = position.openPnl >= 0;
              return (
                <button
                  key={position.id}
                  type="button"
                  onClick={() => openAssetDetail(position.symbol, position.name, position.category, position.markPrice)}
                  style={{
                    border: "1px solid var(--b1)",
                    background: "var(--bg-card)",
                    borderRadius: "var(--r-lg)",
                    padding: 12,
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>{position.symbol}</div>
                      <div style={{ fontSize: 10, color: "var(--t3)" }}>{position.name}</div>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 4,
                      padding: "2px 7px",
                      border: position.side === "LONG" ? "1px solid var(--up-border)" : "1px solid var(--down-border)",
                      background: position.side === "LONG" ? "var(--up-dim)" : "var(--down-dim)",
                      color: position.side === "LONG" ? "var(--up)" : "var(--down)",
                    }}>
                      {position.side}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                    <div style={{ color: "var(--t3)" }}>{lang === "en" ? "Entry" : "Giriş"}: <span style={{ color: "var(--t1)", fontFamily: "var(--font-mono)" }}>${fmtPrice(position.entryPrice)}</span></div>
                    <div style={{ color: "var(--t3)" }}>{lang === "en" ? "Mark" : "Anlık"}: <span style={{ color: "var(--t1)", fontFamily: "var(--font-mono)" }}>${fmtPrice(position.markPrice)}</span></div>
                    <div style={{ color: "var(--t3)" }}>{lang === "en" ? "Qty" : "Miktar"}: <span style={{ color: "var(--t1)", fontFamily: "var(--font-mono)" }}>{position.quantity.toFixed(position.quantity < 1 ? 4 : 2)}</span></div>
                    <div style={{ color: "var(--t3)" }}>{lang === "en" ? "Open PnL" : "Açık K/Z"}: <span style={{ color: up ? "var(--up)" : "var(--down)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{up ? "+" : ""}{fmtCurrency(position.openPnl)}</span></div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div style={{
        border: "1px solid var(--b1)",
        borderRadius: "var(--r-lg)",
        background: "var(--bg-card)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 700 }}>{lang === "en" ? "Watch Items" : "Takip Kayıtları"}</div>
          <span style={{ fontSize: 11, color: "var(--t4)" }}>{watchlist.length}</span>
        </div>

        {watchlist.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--t3)" }}>
            {lang === "en"
              ? "No custom watch item yet."
              : "Henüz özel takip kaydı yok."}
          </div>
        ) : (
          watchlist.map((item) => {
            const live = getLivePrice(item.symbol);
            return (
              <div key={item.symbol} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--b1)", paddingTop: 10 }}>
                <button
                  type="button"
                  onClick={() => openAssetDetail(item.symbol, item.name, item.category, live || 0)}
                  style={{ border: "none", background: "none", padding: 0, color: "inherit", cursor: "pointer", textAlign: "left", minWidth: 0 }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--t1)", fontWeight: 700 }}>{item.symbol}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>{item.name}</div>
                </button>
                <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--t3)", textAlign: "right" }}>
                  {live ? `$${fmtPrice(live)}` : (lang === "en" ? "No live data" : "Canlı veri yok")}
                  {item.custom && (
                    <div style={{ fontSize: 10, color: "var(--warn)" }}>
                      {lang === "en" ? "Custom tracking" : "Özel takip"}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeWatch(item.symbol)}
                  style={{ border: "1px solid var(--b1)", borderRadius: 6, background: "var(--bg-hover)", color: "var(--t3)", padding: 4, cursor: "pointer" }}
                  aria-label={lang === "en" ? "Remove" : "Sil"}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {showAddWatch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1400,
            background: "var(--bg-modal)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowAddWatch(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              maxHeight: "min(92dvh, 720px)",
              overflowY: "auto",
              background: "var(--bg-panel)",
              border: "1px solid var(--b2)",
              borderRadius: "var(--r-xl)",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, color: "var(--t1)", fontWeight: 700 }}>
                  {lang === "en" ? "Add Watch Item" : "Takip Varlığı Ekle"}
                </div>
                <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                  {lang === "en"
                    ? "Known assets and custom watch records are separated."
                    : "Bilinen varlıklar ve özel takip kayıtları ayrı gösterilir."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWatch(false)}
                style={{ border: "1px solid var(--b1)", borderRadius: 8, background: "var(--bg-hover)", color: "var(--t3)", padding: 6, cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            </div>

            <SymbolSearch locale={lang} onSelect={addWatch} />

            <div style={{ marginTop: 12, fontSize: 11, color: "var(--t4)", lineHeight: 1.6 }}>
              {lang === "en"
                ? "Custom symbols are only watch records. They do not imply guaranteed live price/signal/AI output."
                : "Özel semboller sadece takip kaydıdır. Canlı fiyat/sinyal/AI çıktısı garanti edilmez."}
            </div>
          </div>
        </div>
      )}

      {selectedAsset && <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}

      <style>{`
        @media (max-width: 820px) {
          .portfolio-demo-table-wrap { display: none; }
          .portfolio-mobile-list { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div style={{
      border: "1px solid var(--b1)",
      borderRadius: "var(--r-lg)",
      background: "var(--bg-card)",
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 5,
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{label}</span>
        {icon}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, color: "var(--t1)", fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--t4)" }}>{sub}</div>
    </div>
  );
}
