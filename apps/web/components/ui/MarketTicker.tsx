"use client";
import { useMemo } from "react";
import { usePrices } from "@/lib/prices/PriceContext";

const ALL_SYMBOLS = [
  { sym:"BTC",     label:"Bitcoin",     cat:"crypto", key:"BTCUSDT"  },
  { sym:"ETH",     label:"Ethereum",    cat:"crypto", key:"ETHUSDT"  },
  { sym:"SOL",     label:"Solana",      cat:"crypto", key:"SOLUSDT"  },
  { sym:"BNB",     label:"BNB",         cat:"crypto", key:"BNBUSDT"  },
  { sym:"XRP",     label:"Ripple",      cat:"crypto", key:"XRPUSDT"  },
  { sym:"DOGE",    label:"Dogecoin",    cat:"crypto", key:"DOGEUSDT" },
  { sym:"ADA",     label:"Cardano",     cat:"crypto", key:"ADAUSDT"  },
  { sym:"AVAX",    label:"Avalanche",   cat:"crypto", key:"AVAXUSDT" },
  { sym:"LINK",    label:"Chainlink",   cat:"crypto", key:"LINKUSDT" },
  { sym:"DOT",     label:"Polkadot",    cat:"crypto", key:"DOTUSDT"  },
  { sym:"LTC",     label:"Litecoin",    cat:"crypto", key:"LTCUSDT"  },
  { sym:"ONDO",    label:"Ondo",        cat:"crypto", key:"ONDOUSDT" },
  { sym:"SUI",     label:"Sui",         cat:"crypto", key:"SUIUSDT"  },
  { sym:"AAPL",    label:"Apple",       cat:"stock",  key:"AAPL"     },
  { sym:"TSLA",    label:"Tesla",       cat:"stock",  key:"TSLA"     },
  { sym:"NVDA",    label:"NVIDIA",      cat:"stock",  key:"NVDA"     },
  { sym:"MSFT",    label:"Microsoft",   cat:"stock",  key:"MSFT"     },
  { sym:"AMZN",    label:"Amazon",      cat:"stock",  key:"AMZN"     },
  { sym:"META",    label:"Meta",        cat:"stock",  key:"META"     },
  { sym:"GOOGL",   label:"Google",      cat:"stock",  key:"GOOGL"    },
  { sym:"THYAO",   label:"THY",         cat:"bist",   key:"THYAO"    },
  { sym:"GARAN",   label:"Garanti",     cat:"bist",   key:"GARAN"    },
  { sym:"ASELS",   label:"Aselsan",     cat:"bist",   key:"ASELS"    },
  { sym:"AKBNK",   label:"Akbank",      cat:"bist",   key:"AKBNK"    },
  { sym:"XAU",     label:"Altin",       cat:"metal",  key:"XAUUSD"   },
  { sym:"XAG",     label:"Gumus",       cat:"metal",  key:"XAGUSD"   },
  { sym:"WTI",     label:"Ham Petrol",  cat:"energy", key:"WTIUSD"   },
  { sym:"BRENT",   label:"Brent",       cat:"energy", key:"BRENT"    },
  { sym:"EUR/USD", label:"Euro",        cat:"forex",  key:"EURUSD"   },
  { sym:"USD/TRY", label:"Dolar/TL",    cat:"forex",  key:"USDTRY"   },
  { sym:"GBP/USD", label:"Sterlin",     cat:"forex",  key:"GBPUSD"   },
  { sym:"USD/JPY", label:"Yen",         cat:"forex",  key:"USDJPY"   },
  { sym:"S&P500",  label:"S&P 500",     cat:"index",  key:"SPX"      },
  { sym:"NASDAQ",  label:"Nasdaq",      cat:"index",  key:"NDX"      },
  { sym:"DJI",     label:"Dow Jones",   cat:"index",  key:"DJI"      },
  { sym:"BIST100", label:"BIST 100",    cat:"index",  key:"BIST100"  },
  { sym:"DAX",     label:"DAX 40",      cat:"index",  key:"DAX"      },
  { sym:"VIX",     label:"VIX",         cat:"index",  key:"VIX"      },
];

const CAT_COLOR: Record<string, string> = {
  crypto: "#F7931A",
  stock:  "#60a5fa",
  bist:   "#34d399",
  index:  "#a78bfa",
  metal:  "#fcd34d",
  energy: "#fb923c",
  forex:  "#94a3b8",
};

function fmtPx(p: number): string {
  if (p <= 0)    return "-";
  if (p < 0.0001) return p.toFixed(8);
  if (p < 0.001)  return p.toFixed(6);
  if (p < 1)      return p.toFixed(4);
  if (p < 10)     return p.toFixed(3);
  if (p >= 10000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1000)  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return p.toFixed(2);
}

const sc = (v: unknown): number => { const n = Number(v); return isFinite(n) ? n : 0; };

export function MarketTicker() {
  const prices = usePrices();

  const items = useMemo(() => {
    const list = ALL_SYMBOLS
      .map(s => ({
        ...s,
        price: sc(prices[s.key]?.price),
        chg:   sc(prices[s.key]?.chg),
        ts:    prices[s.key]?.ts ?? 0,
      }))
      .filter(s => s.price > 0);

    // Sort: biggest gainers first, then losers by magnitude
    const gainers = list.filter(s => s.chg >= 0).sort((a, b) => b.chg - a.chg);
    const losers  = list.filter(s => s.chg  < 0).sort((a, b) => a.chg - b.chg);
    return [...gainers, ...losers];
  }, [prices]);

  const liveCount = items.filter(i => i.ts > 0 && Date.now() - i.ts < 90000).length;
  const durationSec = Math.max(40, items.length * 3.8);

  if (items.length === 0) {
    return (
      <div style={{ height: 32, background: "var(--bg-panel)", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", padding: "0 12px" }}>
        <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "var(--font-mono)" }}>Piyasa verileri yukleniyor...</span>
      </div>
    );
  }

  return (
    <div style={{
      height: 32, overflow: "hidden", position: "relative",
      background: "var(--bg-panel)", borderBottom: "1px solid var(--b1)",
      display: "flex", alignItems: "center", userSelect: "none",
    }}>
      {/* CANLI badge */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
        padding: "0 10px", borderRight: "1px solid var(--b1)", height: "100%",
        background: "var(--bg-panel)", zIndex: 2,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: liveCount >= 3 ? "var(--up)" : "#555",
          boxShadow: liveCount >= 3 ? "0 0 6px var(--up)" : "none",
          animation: liveCount >= 3 ? "pulse-live 2s ease-in-out infinite" : "none",
        }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--t3)", letterSpacing: "0.05em" }}>
          CANLI
        </span>
      </div>

      {/* Fade edges */}
      <div style={{ position: "absolute", left: 52, top: 0, bottom: 0, width: 20, zIndex: 1, background: "linear-gradient(to right, var(--bg-panel), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 20, zIndex: 1, background: "linear-gradient(to left, var(--bg-panel), transparent)", pointerEvents: "none" }} />

      {/* Scrolling track */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div
          className="ticker-track"
          style={{
            display: "inline-flex", alignItems: "center",
            animation: `ticker-scroll ${durationSec}s linear infinite`,
            willChange: "transform",
            whiteSpace: "nowrap",
          }}
        >
          {[0, 1].map(pass => (
            <span key={pass} style={{ display: "inline-flex", alignItems: "center" }}>
              {items.map((item) => {
                const up = item.chg >= 0;
                const bigMover = Math.abs(item.chg) > 3;
                return (
                  <span
                    key={item.sym + pass}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "0 14px", height: 32,
                      borderRight: "1px solid var(--b1)",
                      background: bigMover
                        ? up ? "rgba(38,215,130,0.06)" : "rgba(246,70,93,0.06)"
                        : "transparent",
                    }}
                  >
                    <span style={{ width: 4, height: 4, borderRadius: "50%", flexShrink: 0, background: CAT_COLOR[item.cat] ?? "var(--t4)" }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, color: CAT_COLOR[item.cat] ?? "var(--t2)" }}>
                      {item.sym}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--t1)", fontWeight: 600 }}>
                      {fmtPx(item.price)}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: up ? "var(--up)" : "var(--down)" }}>
                      {up ? "+" : ""}{item.chg.toFixed(2)}%
                    </span>
                  </span>
                );
              })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}


