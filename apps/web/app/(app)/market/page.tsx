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
import { buildDataStatusMeta, type DataStatus } from "@/lib/markets/data-status";
import { useI18n } from "@/lib/i18n";
import { useBreakpoint } from "@/lib/responsive/useBreakpoint";

const API = "/api/v1";

type SortKey = "symbol" | "price" | "chg" | "chg7d" | "name";

type NormalizedMarketAsset = {
  symbol: string;
  name: string;
  categoryLabel: string;
  price: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  volume24h: number | null;
  volumeLabel: string;
  dataStatus: DataStatus;
  dataStatusLabel: string;
  sourceLabel: string;
  updatedAtLabel: string;
  displaySymbol: string;
  name_tr: string;
  name_en: string;
  category: AssetCategory;
  exchange: string;
  precision: number;
  chg: number | null;
  chg7d: number | null;
  volume: number | null;
  source: string;
  delayMinutes: number | null;
  hasVolume: boolean;
  volumeStatus: DataStatus;
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

function toInitialRows(locale: "tr" | "en"): NormalizedMarketAsset[] {
  return ASSET_UNIVERSE.map((asset) => ({
    symbol: asset.symbol,
    name: locale === "en" ? asset.name_en : asset.name_tr,
    categoryLabel: getCategoryLabel(asset.category, locale),
    change24hPct: null,
    change7dPct: null,
    volume24h: null,
    volumeLabel: locale === "en" ? "No volume" : "Hacim yok",
    updatedAtLabel: "—",
    displaySymbol: asset.displaySymbol,
    name_tr: asset.name_tr,
    name_en: asset.name_en,
    category: asset.category,
    exchange: asset.exchange,
    precision: asset.precision,
    price: null,
    chg: null,
    chg7d: null,
    volume: null,
    source: "unavailable",
    sourceLabel: locale === "en" ? "No data" : "Veri yok",
    dataStatus: "no_data",
    dataStatusLabel: locale === "en" ? "No data" : "Veri yok",
    delayMinutes: null,
    hasVolume: false,
    volumeStatus: "no_volume",
    volumeStatusLabel: locale === "en" ? "No volume" : "Hacim yok",
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

function fmtUpdatedAt(ts: string | null, locale: "tr" | "en"): string {
  if (!ts) return "—";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale === "en" ? "en-US" : "tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function parseNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmtChange(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function noDataLabel(locale: "tr" | "en"): string {
  return locale === "en" ? "No data" : "Veri yok";
}

function no7dLabel(locale: "tr" | "en"): string {
  return locale === "en" ? "No 7d data" : "7g veri yok";
}

function noVolumeLabel(locale: "tr" | "en"): string {
  return locale === "en" ? "No volume" : "Hacim yok";
}

function formatVolume24h(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function volumeLabelFromRow(row: NormalizedMarketAsset, locale: "tr" | "en"): string {
  if (row.volume24h != null && row.volume24h > 0) return formatVolume24h(row.volume24h);
  if (row.volumeStatusLabel) return row.volumeStatusLabel;
  if (row.dataStatus === "no_data") return noDataLabel(locale);
  return noVolumeLabel(locale);
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
  const lang = locale === "en" ? "en" : "tr";
  const { isMobile } = useBreakpoint();
  const livePrices = usePrices();
  const [rows, setRows] = useState<NormalizedMarketAsset[]>(() => toInitialRows(lang));
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
            locale: lang,
            bistRealtimeLicensed: BIST_REALTIME_LICENSED,
          });
          const normalizedPrice = price && price > 0 ? price : null;
          const normalizedChg = Number.isFinite(chg) ? Number(chg) : null;
          const normalizedVolume = volumeValue != null && volumeValue > 0 ? volumeValue : null;
          const volumeLabel = normalizedVolume != null
            ? formatVolume24h(normalizedVolume)
            : (statusMeta.volumeStatusLabel || noVolumeLabel(lang));
          // When asset has no price, do not surface a stale/global timestamp for that row.
          const effectiveUpdatedAt = normalizedPrice != null ? updatedAt : null;

          return {
            ...row,
            name: getAssetDisplayName(row, lang),
            categoryLabel: getCategoryLabel(row.category, lang),
            price: normalizedPrice,
            chg: normalizedChg,
            chg7d,
            volume: normalizedVolume,
            change24hPct: normalizedChg,
            change7dPct: chg7d,
            volume24h: normalizedVolume,
            volumeLabel: volumeLabel || noVolumeLabel(lang),
            source: statusMeta.source,
            sourceLabel: statusMeta.sourceLabel,
            dataStatus: statusMeta.dataStatus,
            dataStatusLabel: statusMeta.dataStatusLabel,
            delayMinutes: statusMeta.delayMinutes,
            hasVolume: statusMeta.hasVolume,
            volumeStatus: statusMeta.volumeStatus,
            volumeStatusLabel: statusMeta.volumeStatusLabel,
            provider: statusMeta.provider,
            updatedAt: effectiveUpdatedAt,
            updatedAtLabel: fmtUpdatedAt(effectiveUpdatedAt, lang),
          };
        }),
      );

      setApiOk(true);
    } catch {
      setApiOk(false);
    } finally {
      setLoading(false);
    }
  }, [lang]);

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
          locale: lang,
          bistRealtimeLicensed: BIST_REALTIME_LICENSED,
        });
        const normalizedPrice = Number(liveEntry.price) > 0 ? Number(liveEntry.price) : null;
        const normalizedChg = Number.isFinite(liveEntry.chg) ? liveEntry.chg : row.chg;
        return {
          ...row,
          name: getAssetDisplayName(row, lang),
          categoryLabel: getCategoryLabel(row.category, lang),
          price: normalizedPrice,
          chg: normalizedChg,
          change24hPct: normalizedChg,
          source: statusMeta.source,
          sourceLabel: statusMeta.sourceLabel,
          dataStatus: statusMeta.dataStatus,
          dataStatusLabel: statusMeta.dataStatusLabel,
          delayMinutes: statusMeta.delayMinutes,
          volumeStatus: statusMeta.volumeStatus,
          volumeStatusLabel: statusMeta.volumeStatusLabel,
          provider: statusMeta.provider,
          updatedAt,
          updatedAtLabel: fmtUpdatedAt(updatedAt, lang),
        };
      }),
    );
  }, [lang, livePrices]);

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

  const openAssetDetail = (row: NormalizedMarketAsset) => {
    setSelected({
      symbol: row.symbol,
      display: row.displaySymbol,
      name: row.name,
      price: row.price || 0,
      chg: row.chg ?? 0,
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
                <th className="right">{t("market.col.dataStatus")}</th>
                <th className="right">{t("market.col.source")}</th>
                <th className="right">{t("market.col.updated")}</th>
                <th className="right">{t("market.col.chart")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const up24 = (row.change24hPct ?? 0) >= 0;
                const up7d = (row.change7dPct ?? 0) >= 0;
                const hasPrice = row.price != null && row.price > 0;
                const has7d = row.change7dPct != null && Number.isFinite(row.change7dPct);
                const statusStyle = statusVisual(row.dataStatus);
                const change24Label = hasPrice ? fmtChange(row.change24hPct) : noDataLabel(lang);
                const change7dLabel = has7d ? fmtChange(row.change7dPct) : no7dLabel(lang);
                const volumeLabel = volumeLabelFromRow(row, lang);
                return (
                  <tr
                    key={row.symbol}
                    className="fade-in"
                    onClick={() => openAssetDetail(row)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{row.displaySymbol}</td>
                    <td>{row.name}</td>
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
                        {row.categoryLabel}
                      </span>
                    </td>
                    <td className="right" style={{ fontFamily: "var(--font-mono)", color: "var(--t1)", fontWeight: 700 }}>
                      {fmtPrice(row.price, row.precision)}
                    </td>
                    <td className={`right ${up24 ? "chg-up" : "chg-down"}`}>
                      {hasPrice ? (up24 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />) : null}
                      {change24Label}
                    </td>
                    <td className={`right ${up7d ? "chg-up" : "chg-down"}`}>
                      {change7dLabel}
                    </td>
                    <td className="right" style={{ color: "var(--t3)" }}>
                      {volumeLabel}
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
                        {hasPrice ? row.dataStatusLabel : noDataLabel(lang)}
                      </span>
                    </td>
                    <td className="right" style={{ color: "var(--t3)" }}>{row.sourceLabel}</td>
                    <td className="right" style={{ color: "var(--t3)" }}>{row.updatedAtLabel}</td>
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
            const up24 = (row.change24hPct ?? 0) >= 0;
            const up7d = (row.change7dPct ?? 0) >= 0;
            const hasPrice = row.price != null && row.price > 0;
            const has7d = row.change7dPct != null && Number.isFinite(row.change7dPct);
            const source = row.sourceLabel;
            const quality = statusVisual(row.dataStatus);
            const change24Label = hasPrice ? fmtChange(row.change24hPct) : noDataLabel(lang);
            const change7dLabel = has7d ? fmtChange(row.change7dPct) : no7dLabel(lang);
            const volumeLabel = volumeLabelFromRow(row, lang);
            const analysisLabel = locale === "en" ? "Analysis" : "Analiz";

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
                      {row.name}
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
                    {row.categoryLabel}
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
                      {change24Label}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--t4)" }}>{t("market.col.change7d")}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: has7d ? (up7d ? "var(--up)" : "var(--down)") : "var(--t3)", fontWeight: 700 }}>
                      {change7dLabel}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--t4)" }}>{t("market.col.volume")}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--t2)", fontWeight: 700 }}>
                      {volumeLabel}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--t4)" }}>{t("market.col.dataStatus")}</div>
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
                  <span style={{ fontSize: 10, color: "var(--t4)" }}>{row.updatedAtLabel}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                    <button
                      className="btn-ghost"
                      style={{ padding: "5px 10px", fontSize: 11 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openAssetDetail(row);
                      }}
                    >
                      {analysisLabel}
                    </button>
                  </div>
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
