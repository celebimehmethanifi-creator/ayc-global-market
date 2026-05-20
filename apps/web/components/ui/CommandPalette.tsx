"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  Zap,
  BriefcaseBusiness,
  Bell,
  Bot,
  LineChart,
  UserCircle2,
  Users2,
  X,
  DollarSign,
  BarChart3,
  Fuel,
  Globe,
  Gem,
  Activity,
} from "lucide-react";
import { useAssetModal } from "@/lib/AssetModalContext";
import { usePrices } from "@/lib/prices/PriceContext";
import {
  getAssetDisplayName,
  getCategoryLabel,
  searchAssets,
  type AssetCategory,
} from "@/lib/markets/asset-universe";
import { useI18n } from "@/lib/i18n";

const PAGES = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard", sub: "Ana panel", href: "/dashboard" },
  { icon: TrendingUp, labelKey: "nav.market", sub: "Tüm piyasa verileri", href: "/market" },
  { icon: Zap, labelKey: "nav.signals", sub: "AI sinyal akışı", href: "/signals" },
  { icon: BriefcaseBusiness, labelKey: "nav.portfolio", sub: "Varlık takibi", href: "/portfolio" },
  { icon: Bell, labelKey: "nav.alarms", sub: "Fiyat uyarıları", href: "/alarms" },
  { icon: Bot, labelKey: "nav.copilot", sub: "Piyasa analizi sor", href: "/copilot" },
  { icon: Users2, labelKey: "nav.social", sub: "Topluluk fikirleri", href: "/social" },
  { icon: LineChart, labelKey: "nav.trades", sub: "Geçmiş emirler", href: "/trades" },
  { icon: UserCircle2, labelKey: "nav.profile", sub: "Hesap ayarları", href: "/profile" },
] as const;

const CAT_ICON: Record<AssetCategory, any> = {
  crypto: DollarSign,
  us: BarChart3,
  bist: BarChart3,
  etf: Activity,
  precious: Gem,
  commodity: Gem,
  energy: Fuel,
  forex: Globe,
  index: TrendingUp,
};

interface Props {
  open: boolean;
  onClose: () => void;
}

function mapToPriceKeys(symbol: string): string[] {
  const normalized = symbol.toUpperCase().replace(/\s+/g, "");
  const compact = normalized.replace(/[/.]/g, "");
  const keys = [normalized, compact];

  if (normalized.endsWith(".IS")) {
    keys.push(normalized.replace(".IS", ""));
  }

  if (normalized === "USDTRY") keys.push("USD/TRY");
  if (normalized === "EURTRY") keys.push("EUR/TRY");
  if (normalized === "EURUSD") keys.push("EUR/USD");
  if (normalized === "GBPUSD") keys.push("GBP/USD");

  if (!normalized.endsWith("USDT") && normalized.length <= 6) {
    keys.push(`${normalized}USDT`);
  }

  return Array.from(new Set(keys));
}

function formatLivePrice(price: number, precision: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: Math.min(2, precision) })}`;
  }
  return `$${price.toFixed(Math.min(Math.max(precision, 2), 8))}`;
}

export function CommandPalette({ open, onClose }: Props) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { openAsset } = useAssetModal();
  const prices = usePrices();
  const { locale, t } = useI18n();

  const getLive = (symbol: string) => {
    const keys = mapToPriceKeys(symbol);
    for (const key of keys) {
      const entry = prices[key];
      if (entry && Number(entry.price) > 0) {
        return {
          price: Number(entry.price),
          chg: Number.isFinite(Number(entry.chg)) ? Number(entry.chg) : 0,
        };
      }
    }
    return null;
  };

  const pageQuery = q.trim().toLowerCase();
  const filteredPages =
    q.trim().length < 1
      ? PAGES
      : PAGES.filter(
          (page) =>
            t(page.labelKey).toLowerCase().includes(pageQuery) ||
            page.href.toLowerCase().includes(pageQuery),
        ).slice(0, 6);

  const filteredAssets = searchAssets(q, locale, q.trim().length < 1 ? 10 : 16);

  const allFiltered = [...filteredPages, ...filteredAssets];

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const handleSelect = useCallback(
    (item: any) => {
      if (item.symbol) {
        const lp = getLive(item.symbol);
        openAsset({
          symbol: item.symbol,
          name: getAssetDisplayName(item, locale),
          display: item.displaySymbol,
          price: lp?.price ?? 0,
          chg: lp?.chg ?? 0,
          market: item.category,
        });
      } else {
        router.push(item.href);
      }
      onClose();
    },
    [locale, onClose, openAsset, router],
  );

  useEffect(() => {
    if (!open) return;
    const fn = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSel((s) => Math.min(s + 1, allFiltered.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      }
      if (event.key === "Enter" && allFiltered[sel]) {
        handleSelect(allFiltered[sel]);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [allFiltered, handleSelect, onClose, open, sel]);

  if (!open) return null;

  return (
    <div className="cmd-overlay fade-in" onClick={onClose}>
      <div className="cmd-box" onClick={(event) => event.stopPropagation()}>
        <div className="cmd-input-wrap">
          <Search size={15} style={{ color: "var(--t3)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder={t("search.commandPlaceholder")}
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setSel(0);
            }}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              style={{
                color: "var(--t3)",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={14} />
            </button>
          )}
          <kbd
            style={{
              padding: "2px 7px",
              borderRadius: 5,
              fontSize: 10,
              fontWeight: 600,
              background: "var(--bg-hover)",
              border: "1px solid var(--b2)",
              color: "var(--t3)",
              flexShrink: 0,
            }}
          >
            ESC
          </kbd>
        </div>

        <div className="cmd-results">
          {filteredPages.length > 0 && (
            <div>
              <div className="cmd-section-label">{t("search.pages")}</div>
              {filteredPages.map((item, i) => {
                const Icon = item.icon;
                const idx = i;
                return (
                  <div
                    key={item.href}
                    className={`cmd-item${sel === idx ? " selected" : ""}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSel(idx)}
                  >
                    <div className="cmd-item-icon page">
                      <Icon size={14} />
                    </div>
                    <div className="cmd-item-text">
                      <span className="cmd-item-label">{t(item.labelKey)}</span>
                      <span className="cmd-item-sub">{item.sub}</span>
                    </div>
                    <kbd className="cmd-enter">↵</kbd>
                  </div>
                );
              })}
            </div>
          )}

          {filteredAssets.length > 0 && (
            <div>
              <div className="cmd-section-label">
                {q.trim() ? `${t("search.assets")} — "${q}"` : t("search.popularAssets")}
              </div>
              {filteredAssets.map((item, i) => {
                const idx = filteredPages.length + i;
                const lp = getLive(item.symbol);
                const up = (lp?.chg ?? 0) >= 0;
                const Icon = CAT_ICON[item.category] ?? DollarSign;
                return (
                  <div
                    key={item.symbol}
                    className={`cmd-item${sel === idx ? " selected" : ""}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSel(idx)}
                  >
                    <div className="cmd-item-icon asset">
                      <Icon size={13} />
                    </div>
                    <div className="cmd-item-text">
                      <span className="cmd-item-label">
                        <span style={{ fontWeight: 800, fontFamily: "var(--font-mono)" }}>{item.displaySymbol}</span>
                        <span style={{ fontWeight: 400, color: "var(--t3)", marginLeft: 6, fontSize: 11 }}>
                          {getAssetDisplayName(item, locale)}
                        </span>
                      </span>
                      <span className="cmd-item-sub">{getCategoryLabel(item.category, locale)}</span>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {lp ? (
                        <>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 13,
                              fontWeight: 700,
                              color: "var(--t1)",
                            }}
                          >
                            {formatLivePrice(lp.price, item.precision)}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: up ? "var(--up)" : "var(--down)" }}>
                            {up ? "+" : ""}
                            {lp.chg.toFixed(2)}%
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: "var(--t4)" }}>—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {allFiltered.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--t4)", fontSize: 13 }}>
              "{q}" {t("search.noResults")}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--b1)",
            display: "flex",
            gap: 12,
            alignItems: "center",
            fontSize: 10,
            color: "var(--t4)",
          }}
        >
          <span>
            <kbd style={{ padding: "1px 5px", borderRadius: 3, background: "var(--bg-hover)", border: "1px solid var(--b2)" }}>
              ↑↓
            </kbd>{" "}
            {t("search.navigate")}
          </span>
          <span>
            <kbd style={{ padding: "1px 5px", borderRadius: 3, background: "var(--bg-hover)", border: "1px solid var(--b2)" }}>
              ↵
            </kbd>{" "}
            {t("search.open")}
          </span>
          <span>
            <kbd style={{ padding: "1px 5px", borderRadius: 3, background: "var(--bg-hover)", border: "1px solid var(--b2)" }}>
              Esc
            </kbd>{" "}
            {t("search.close")}
          </span>
        </div>
      </div>
    </div>
  );
}
