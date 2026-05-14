"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, RefreshCw, Search, TrendingUp } from "lucide-react";
import { AssetDetailModal } from "@/components/ui/AssetDetailModal";
import type { AssetInfo } from "@/components/ui/AssetDetailModal";
import { usePrices } from "@/lib/prices/PriceContext";
import {
  ASSET_UNIVERSE,
  getAssetDisplayName,
  getCategoryLabel,
  normalizeSearchText,
  type AssetCategory,
} from "@/lib/markets/asset-universe";
import { buildDataStatusMeta } from "@/lib/markets/data-status";
import { useI18n } from "@/lib/i18n";
import { useBreakpoint } from "@/lib/responsive/useBreakpoint";

const API = "/api/v1";

type SortKey = "symbol" | "price" | "chg" | "chg7d" | "name";

type MarketRow = {
  symbol: string;
  displaySymbol: string;
  name_tr: string;
  name_en: string;
  category: AssetCategory;
  exchange: string;
  precision: number;
  price: number | null;
  chg: number;
  chg7d: number | null;
  volume: string | null;
  source: string;
  sourceLabel: string;
  dataStatus: string;
  dataStatusLabel: string;
  delayMinutes: number | null;
  hasVolume: boolean;
  volumeStatus: string;
  volumeStatusLabel: string;
  provider: string;
  updatedAt: string | null;
};

const BIST_REALTIME_LICENSED = process.env.NEXT_PUBLIC_BIST_REALTIME_LICENSED === "1";

const CATEGORY_FILTERS: Array<{ key: "all" | AssetCategory; labelTr: string; labelEn: string }> = [
  { key: "all", labelTr: "Tümü", labelEn: "All" },
  { key: "crypto", labelTr: "Kripto", labelEn: "Crypto" },
  { key: "us", labelTr: "ABD Borsası", labelEn: "US Stocks" },
  { key: "bist", labelTr: "BIST", labelEn: "BIST" },
  { key: "commodity", labelTr: "Emtia", labelEn: "Commodity" },
  { key: "energy", labelTr: "Enerji", labelEn: "Energy" },
  { key: "forex", labelTr: "Forex", labelEn: "Forex" },
  { key: "index", labelTr: "Endeksler", labelEn: "Indices" },
  { key: "etf", labelTr: "ETF", labelEn: "ETF" },
  { key: "precious", labelTr: "Değerli Metaller", labelEn: "Precious" },
];

function toInitialRows(): MarketRow[] {
  return ASSET_UNIVERSE.map((asset) => ({
    symbol: asset.symbol,
    displaySymbol: asset.displaySymbol,
    name_tr: asset.name_tr,
    name_en: asset.name_en,
    category: asset.category,
    exchange: asset.exchange,
    precision: asset.precision,
    price: null,
    chg: 0,
    chg7d: null,
    volume: null,
    source: "unavailable",
    sourceLabel: "Veri yok",
    dataStatus: "no_data",
    dataStatusLabel: "Veri yok",
    delayMinutes: null,
    hasVolume: false,
    volumeStatus: "no_volume",
    volumeStatusLabel: "Hacim yok",
    provider: "UNAVAILABLE",
    updatedAt: null,
  }));
}

function mapToLiveKeys(symbol: string): string[] {
  const normalized = symbol.toUpperCase();
  const compact = normalized.replace(/[/.]/g, "");
  const keys = [normalized, compact];

  if (normalized.endsWith(".IS")) keys.push(normalized.replace(".IS", ""));
  if (!compact.endsWith("USDT") && compact.length <= 6) keys.push(`${compact}USDT`);

  if (normalized === "USDTRY") keys.push("USD/TRY");
  if (normalized === "EURTRY") keys.push("EUR/TRY");
  if (normalized === "EURUSD") keys.push("EUR/USD");
  if (normalized === "GBPUSD") keys.push("GBP/USD");

  return Array.from(new Set(keys));
}

function fmtPrice(price: number | null, precision: number): string {
  if (price == null || !Number.isFinite(price) || price <= 0) return "—";
  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.min(2, precision),
    });
  }
  if (price < 1) {
    return price.toFixed(Math.min(Math.max(precision, 4), 8));
  }
  return price.toFixed(Math.min(Math.max(precision, 2), 6));
}

function fmtTime(ts: string | null): string {
  if (!ts) return "—";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function parseNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmtChange(value: number | null, locale: "tr" | "en"): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function statusVisual(status: string) {
  if (status === "live") {
    return {
      color: "var(--up)",
      bg: "var(--up-dim)",
      border: "var(--up-border)",
    };
  }
  if (status === "delayed" || status === "license_required") {
    return {
      color: "var(--warn)",
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.35)",
    };
  }
  if (status === "fallback") {
    return {
      color: "var(--gold)",
      bg: "var(--gold-dim)",
      border: "var(--gold-border)",
    };
  }
  return {
    color: "var(--t3)",
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.25)",
  };
}

export default function MarketPage() {
  const { locale, t } = useI18n();
  const { isMobile } = useBreakpoint();
  const livePrices = usePrices();
  const [rows, setRows] = useState<MarketRow[]>(toInitialRows());
  const [cat, setCat] = useState<"all" | AssetCategory>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("chg");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<AssetInfo | null>(null);

  const fetchMarketData = useCallback(async () => {
    setLoading(true);
    try {
      const symbols = ASSET_UNIVERSE.map((asset) => asset.symbol).join(",");
      const [liveRes, scanRes] = await Promise.all([
        fetch(`${API}/prices/live?symbols=${encodeURIComponent(symbols)}`, {
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        }),
        fetch(`${API}/brain/scan?market=all&limit=250`, {
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        }).catch(() => null),
      ]);

      if (!liveRes.ok) throw new Error("prices-live-failed");
      const liveData = await liveRes.json();
      const scanData = scanRes && scanRes.ok ? await scanRes.json() : null;

      const scanMap = new Map<string, any>();
      for (const item of scanData?.items || []) {
        const key = String(item?.symbol || "").toUpperCase();
        if (!key) continue;
        scanMap.set(key, item);
        scanMap.set(key.replace(/[/.]/g, ""), item);
      }

      setRows((prev) =>
        prev.map((row) => {
          const liveEntry = mapToLiveKeys(row.symbol)
            .map((key) => liveData?.prices?.[key])
            .find((entry: any) => entry && Number(entry.price) > 0);

          const scanEntry = scanMap.get(row.symbol) || scanMap.get(row.symbol.replace(/[/.]/g, ""));

          const fallbackPrice = parseNumber(scanEntry?.current_price ?? scanEntry?.price);
          const price = parseNumber(liveEntry?.price) ?? fallbackPrice ?? row.price;
          const chg =
            parseNumber(liveEntry?.change24h ?? liveEntry?.chg) ??
            parseNumber(scanEntry?.change_pct ?? scanEntry?.chg) ??
            row.chg;
          const chg7d = parseNumber(scanEntry?.change_7d) ?? row.chg7d;
          const source = String(liveEntry?.source || scanEntry?.source || row.source || "unavailable");
          const updatedAt = String(liveEntry?.updatedAt || liveData?.updated_at || row.updatedAt || "") || null;
          const volumeValue = parseNumber(scanEntry?.volume);
          const hasVolume = volumeValue != null && volumeValue > 0;
          const statusMeta = buildDataStatusMeta({
            source,
            provider: source,
            category: row.category,
            updatedAt,
            hasPrice: Boolean(price && price > 0),
            hasVolume,
            locale: locale === "en" ? "en" : "tr",
            bistRealtimeLicensed: BIST_REALTIME_LICENSED,
          });
          const volumeLabel =
            scanEntry?.volume_label ||
            (parseNumber(scanEntry?.volume) != null
              ? Number(scanEntry.volume).toLocaleString("en-US")
              : row.volume);

          return {
            ...row,
            price: price && price > 0 ? price : null,
            chg: Number.isFinite(chg) ? Number(chg) : 0,
            chg7d,
            volume: volumeLabel || null,
            source: statusMeta.source,
            sourceLabel: statusMeta.sourceLabel,
            dataStatus: statusMeta.dataStatus,
            dataStatusLabel: statusMeta.dataStatusLabel,
            delayMinutes: statusMeta.delayMinutes,
            hasVolume: statusMeta.hasVolume,
            volumeStatus: statusMeta.volumeStatus,
            volumeStatusLabel: statusMeta.volumeStatusLabel,
            provider: statusMeta.provider,
            updatedAt,
          };
        }),
      );

      setApiOk(true);
    } catch {
      setApiOk(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData().catch(() => {});
    const interval = setInterval(() => {
      fetchMarketData().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  useEffect(() => {
    if (Object.keys(livePrices).length === 0) return;
    setRows((prev) =>
      prev.map((row) => {
        const liveEntry = mapToLiveKeys(row.symbol)
          .map((key) => livePrices[key])
          .find((entry) => entry && Number(entry.price) > 0);
        if (!liveEntry) return row;
        const updatedAt = new Date(liveEntry.ts).toISOString();
        const statusMeta = buildDataStatusMeta({
          source: liveEntry.source || row.source,
          provider: liveEntry.source || row.provider,
          category: row.category,
          updatedAt,
          hasPrice: Number(liveEntry.price) > 0,
          hasVolume: row.hasVolume,
          locale: locale === "en" ? "en" : "tr",
          bistRealtimeLicensed: BIST_REALTIME_LICENSED,
        });
        return {
          ...row,
          price: liveEntry.price,
          chg: Number.isFinite(liveEntry.chg) ? liveEntry.chg : row.chg,
          source: statusMeta.source,
          sourceLabel: statusMeta.sourceLabel,
          dataStatus: statusMeta.dataStatus,
          dataStatusLabel: statusMeta.dataStatusLabel,
          delayMinutes: statusMeta.delayMinutes,
          volumeStatus: statusMeta.volumeStatus,
          volumeStatusLabel: statusMeta.volumeStatusLabel,
          provider: statusMeta.provider,
          updatedAt,
        };
      }),
    );
  }, [livePrices, locale]);

  const filteredRows = useMemo(() => {
    const q = normalizeSearchText(search);

    let output = rows;
    if (cat !== "all") {
      output = output.filter((row) => row.category === cat);
    }

    if (q) {
      output = output.filter((row) => {
        const label = normalizeSearchText(row.displaySymbol);
        const symbol = normalizeSearchText(row.symbol);
        const trName = normalizeSearchText(row.name_tr);
        const enName = normalizeSearchText(row.name_en);
        const categoryLabel = normalizeSearchText(getCategoryLabel(row.category, locale));
        return (
          label.includes(q) ||
          symbol.includes(q) ||
          trName.includes(q) ||
          enName.includes(q) ||
          categoryLabel.includes(q)
        );
      });
    }

    return [...output].sort((a, b) => {
      if (sortKey === "symbol") {
        return sortDir * a.displaySymbol.localeCompare(b.displaySymbol);
      }
      if (sortKey === "name") {
        return sortDir * getAssetDisplayName(a, locale).localeCompare(getAssetDisplayName(b, locale));
      }
      const aValue = sortKey === "price" ? a.price || 0 : sortKey === "chg7d" ? a.chg7d || 0 : a.chg || 0;
      const bValue = sortKey === "price" ? b.price || 0 : sortKey === "chg7d" ? b.chg7d || 0 : b.chg || 0;
      return sortDir * (aValue - bValue);
    });
  }, [cat, locale, rows, search, sortDir, sortKey]);

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDir((dir) => (dir === -1 ? 1 : -1));
    } else {
      setSortKey(nextKey);
      setSortDir(-1);
    }
  };

  const categoryPills = CATEGORY_FILTERS.map((filter) => ({
    ...filter,
    label: locale === "en" ? filter.labelEn : filter.labelTr,
  }));

  const openAssetDetail = (row: MarketRow) => {
    setSelected({
      symbol: row.symbol,
      display: row.displaySymbol,
      name: getAssetDisplayName(row, locale),
      price: row.price || 0,
      chg: row.chg,
      market: row.category,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-head)", fontSize: 18, fontWeight: 800, color: "var(--t1)" }}>
            {t("market.title")}
          </h1>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
            {filteredRows.length} {t("market.subtitle")} · {locale === "en" ? "Live/Delayed mixed by asset" : "Veri durumu varlığa göre değişir"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search
              size={12}
              style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }}
            />
            <input
              className="inp"
              style={{ paddingLeft: 28, width: "100%", maxWidth: 260, minWidth: 150 }}
              placeholder={t("market.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button onClick={fetchMarketData} disabled={loading} className="btn-ghost" title="refresh">
            <RefreshCw size={12} style={{ animation: loading ? "spin 0.8s linear infinite" : "" }} />
          </button>
        </div>
      </div>

      <div className="cat-pills">
        {categoryPills.map((item) => (
          <button
            key={item.key}
            className={`cat-pill${cat === item.key ? " active" : ""}`}
            onClick={() => setCat(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--b1)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        {!isMobile && (
        <div className="market-table-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="market-table" style={{ minWidth: 1120 }}>
            <thead>
              <tr>
                <th onClick={() => toggleSort("symbol")} style={{ cursor: "pointer" }}>{t("market.col.symbol")}</th>
                <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>{t("market.col.name")}</th>
                <th>{t("market.col.category")}</th>
                <th className="right" onClick={() => toggleSort("price")} style={{ cursor: "pointer" }}>{t("market.col.price")}</th>
                <th className="right" onClick={() => toggleSort("chg")} style={{ cursor: "pointer" }}>{t("market.col.change24h")}</th>
                <th className="right" onClick={() => toggleSort("chg7d")} style={{ cursor: "pointer" }}>{t("market.col.change7d")}</th>
                <th className="right">{t("market.col.volume")}</th>
                <th className="right">{locale === "en" ? "Data Status" : "Veri Durumu"}</th>
                <th className="right">{t("market.col.source")}</th>
                <th className="right">{t("market.col.updated")}</th>
                <th className="right">{t("market.col.chart")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const up24 = row.chg >= 0;
                const up7d = (row.chg7d || 0) >= 0;
                const hasPrice = row.price != null && row.price > 0;
                const statusStyle = statusVisual(row.dataStatus);
                return (
                  <tr
                    key={row.symbol}
                    className="fade-in"
                    onClick={() => openAssetDetail(row)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{row.displaySymbol}</td>
                    <td>{getAssetDisplayName(row, locale)}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 4,
                          border: "1px solid var(--b1)",
                          background: "var(--bg-hover)",
                          color: "var(--t3)",
                        }}
                      >
                        {getCategoryLabel(row.category, locale)}
                      </span>
                    </td>
                    <td className="right" style={{ fontFamily: "var(--font-mono)", color: "var(--t1)", fontWeight: 700 }}>
                      {fmtPrice(row.price, row.precision)}
                    </td>
                    <td className={`right ${up24 ? "chg-up" : "chg-down"}`}>
                      {hasPrice ? (up24 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />) : null}
                      {hasPrice ? fmtChange(row.chg, locale === "en" ? "en" : "tr") : (locale === "en" ? "No data" : "Veri yok")}
                    </td>
                    <td className={`right ${up7d ? "chg-up" : "chg-down"}`}>
                      {hasPrice && row.chg7d != null ? `${up7d ? "+" : ""}${row.chg7d.toFixed(2)}%` : (locale === "en" ? "No data" : "Veri yok")}
                    </td>
                    <td className="right" style={{ color: "var(--t3)" }}>
                      {hasPrice ? (row.volume || row.volumeStatusLabel) : (locale === "en" ? "No volume" : "Hacim yok")}
                    </td>
                    <td className="right">
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: statusStyle.color,
                          background: statusStyle.bg,
                          border: `1px solid ${statusStyle.border}`,
                          borderRadius: 6,
                          padding: "2px 8px",
                        }}
                      >
                        {hasPrice ? row.dataStatusLabel : (locale === "en" ? "No data" : "Veri yok")}
                      </span>
                    </td>
                    <td className="right" style={{ color: "var(--t3)" }}>{row.sourceLabel}</td>
                    <td className="right" style={{ color: "var(--t3)" }}>{fmtTime(row.updatedAt)}</td>
                    <td className="right">
                      <button
                        className="btn-ghost"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          openAssetDetail(row);
                        }}
                      >
                        {t("market.chartButton")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {isMobile && (
        <div className="market-mobile-list">
          {filteredRows.map((row) => {
            const up24 = row.chg >= 0;
            const up7d = (row.chg7d || 0) >= 0;
            const hasPrice = row.price != null && row.price > 0;
            const source = row.sourceLabel;
            const quality = statusVisual(row.dataStatus);

            return (
              <div
                key={`mobile-${row.symbol}`}
                className="market-mobile-card"
                onClick={() => openAssetDetail(row)}
                style={{ cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--t1)", fontWeight: 800 }}>
                      {row.displaySymbol}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "95%" }}>
                      {getAssetDisplayName(row, locale)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 5,
                      border: "1px solid var(--b1)",
                      background: "var(--bg-hover)",
                      color: "var(--t3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getCategoryLabel(row.category, locale)}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--t4)" }}>{t("market.col.price")}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--t1)", fontWeight: 700 }}>
                      {fmtPrice(row.price, row.precision)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--t4)" }}>{t("market.col.change24h")}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: hasPrice ? (up24 ? "var(--up)" : "var(--down)") : "var(--t3)", fontWeight: 700 }}>
                      {hasPrice ? fmtChange(row.chg, locale === "en" ? "en" : "tr") : (locale === "en" ? "No data" : "Veri yok")}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--t4)" }}>{t("market.col.change7d")}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: hasPrice && row.chg7d != null ? (up7d ? "var(--up)" : "var(--down)") : "var(--t3)", fontWeight: 700 }}>
                      {hasPrice && row.chg7d != null ? fmtChange(row.chg7d, locale === "en" ? "en" : "tr") : (locale === "en" ? "No data" : "Veri yok")}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--t4)" }}>{locale === "en" ? "Data Status" : "Veri Durumu"}</div>
                    <div
                      style={{
                        marginTop: 1,
                        fontSize: 11,
                        color: quality.color,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 6,
                        padding: "2px 8px",
                        background: quality.bg,
                        border: `1px solid ${quality.border}`,
                      }}
                    >
                      {row.dataStatusLabel}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "var(--t4)" }}>{t("market.col.source")}:</span>
                    <span style={{ fontSize: 10, color: quality.color, fontWeight: 700 }}>{source}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--t4)" }}>{fmtTime(row.updatedAt)}</span>
                  <button
                    className="btn-ghost"
                    style={{ padding: "5px 10px", fontSize: 11 }}
                    onClick={(event) => {
                      event.stopPropagation();
                      openAssetDetail(row);
                    }}
                  >
                    {t("market.chartButton")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {filteredRows.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--t3)" }}>
            <TrendingUp size={26} style={{ marginBottom: 8, opacity: 0.3 }} />
            <div>{t("market.noData")}</div>
          </div>
        )}
      </div>

      <AssetDetailModal asset={selected} onClose={() => setSelected(null)} />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .market-table td.right,
        .market-table th.right {
          text-align: right;
        }
        .market-table td.chg-up,
        .market-table td.chg-down {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 3px;
        }
        .market-mobile-list {
          display: none;
          padding: 10px;
          gap: 10px;
          flex-direction: column;
        }
        .market-mobile-card {
          border: 1px solid var(--b1);
          border-radius: 10px;
          background: var(--bg);
          padding: 10px;
        }
        @media (max-width: 767px) {
          .market-mobile-list {
            display: flex;
          }
        }
      `}</style>
    </div>
  );
}
