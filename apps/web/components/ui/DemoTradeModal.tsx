"use client";
import { useState } from "react";
import { useDemo } from "@/lib/demo/DemoContext";
import { usePrice } from "@/lib/prices/PriceContext";
import { X, TrendingUp, TrendingDown, FlaskConical, CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  symbol: string;
  name: string;
  onClose: () => void;
}

export function DemoTradeModal({ symbol, name, onClose }: Props) {
  const { demo, openTrade } = useDemo();
  const priceEntry = usePrice(symbol);
  const livePrice = priceEntry?.price ?? 0;

  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [amountRaw, setAmountRaw] = useState<string>("500");
  const [result, setResult] = useState<"ok" | "fail" | null>(null);

  const amountUSD = Math.max(10, Math.min(parseFloat(amountRaw)||10, demo.balance));
  const PRESETS = [100, 250, 500, 1000, 2500];
  const qty = livePrice > 0 ? amountUSD / livePrice : 0;
  const tp  = direction === "LONG" ? livePrice * 1.03 : livePrice * 0.97;
  const sl  = direction === "LONG" ? livePrice * 0.98 : livePrice * 1.02;

  function handleTrade() {
    if (!livePrice) return;
    const ok = openTrade(symbol, name, direction, livePrice, amountUSD);
    setResult(ok ? "ok" : "fail");
    if (ok) setTimeout(onClose, 1500);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} style={{
        background: "var(--bg-card)", border: "1px solid var(--b2)",
        borderRadius: 16, width: "100%", maxWidth: 420,
        padding: 24, position: "relative",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FlaskConical size={16} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--t1)" }}>{symbol.replace("USDT","")}</div>
              <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>DEMO İŞLEM</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Live Price */}
        <div style={{
          background: "var(--bg-hover)", borderRadius: 10, padding: "12px 16px",
          marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>Anlık Fiyat</span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--t1)" }}>
            {livePrice > 0 ? `$${livePrice.toLocaleString("en-US",{maximumFractionDigits:4})}` : "—"}
          </span>
        </div>

        {/* Direction */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["LONG","SHORT"] as const).map(d => (
            <button key={d} onClick={() => setDirection(d)} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", border: "none",
              fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: direction === d
                ? d === "LONG" ? "var(--up)" : "var(--down)"
                : "var(--bg-hover)",
              color: direction === d ? "#fff" : "var(--t3)",
              transition: "all .15s",
            }}>
              {d === "LONG" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {d === "LONG" ? "AL (Long)" : "SAT (Short)"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>Yatırım Miktarı (USD)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {PRESETS.map(p => (
              <button key={p} onClick={() => setAmountRaw(String(p))} style={{
                padding: "5px 10px", borderRadius: 6, cursor: "pointer", border: "none", fontSize: 11, fontWeight: 700,
                background: amountUSD === p && amountRaw === String(p) ? "var(--purple)" : "var(--bg-hover)",
                color: amountUSD === p ? "#fff" : "var(--t3)",
              }}>${p}</button>
            ))}
          </div>
          <input
            type="text" inputMode="decimal" value={amountRaw}
            onChange={e => { const v=e.target.value; if(/^\d*\.?\d*$/.test(v)||v==="") setAmountRaw(v); }}
            onBlur={e => { const n=parseFloat(e.target.value)||10; setAmountRaw(String(Math.min(Math.max(10,n),demo.balance))); }}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              background: "var(--bg-hover)", border: "1px solid var(--b2)",
              color: "var(--t1)", fontSize: 14, fontFamily: "var(--font-mono)", boxSizing: "border-box",
              outline: "none",
            }}
          />
          <div style={{ fontSize: 10, color: "var(--t4)", marginTop: 4 }}>
            Kullanılabilir bakiye: ${demo.balance.toLocaleString("en-US",{maximumFractionDigits:2})}
          </div>
        </div>

        {/* Summary */}
        {livePrice > 0 && (
          <div style={{
            background: "var(--bg-hover)", borderRadius: 10, padding: "12px 14px",
            marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
          }}>
            {[
              { label:"Miktar", val: qty < 1 ? qty.toFixed(4) : qty.toFixed(2) },
              { label:"TP +3%", val: `$${tp.toLocaleString("en-US",{maximumFractionDigits:2})}` },
              { label:"SL -2%", val: `$${sl.toLocaleString("en-US",{maximumFractionDigits:2})}` },
            ].map(({label,val}) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--t4)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", fontFamily: "var(--font-mono)" }}>{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Result or Action */}
        {result === "ok" ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"14px 0", color:"var(--up)" }}>
            <CheckCircle size={20} />
            <span style={{ fontWeight:700 }}>Demo işlem açıldı!</span>
          </div>
        ) : result === "fail" ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"14px 0", color:"var(--down)" }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight:700 }}>Yetersiz bakiye!</span>
          </div>
        ) : (
          <button onClick={handleTrade} disabled={!livePrice || amountUSD > demo.balance} style={{
            width: "100%", padding: "14px 0", borderRadius: 10, cursor: "pointer", border: "none",
            fontWeight: 800, fontSize: 14,
            background: direction === "LONG"
              ? "linear-gradient(135deg, var(--up), #059669)"
              : "linear-gradient(135deg, var(--down), #b91c1c)",
            color: "#fff", opacity: (!livePrice || amountUSD > demo.balance) ? 0.5 : 1,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}>
            Demo {direction === "LONG" ? "AL" : "SAT"} — ${amountUSD.toLocaleString()}
          </button>
        )}

        <div style={{ textAlign:"center", marginTop:10, fontSize:10, color:"var(--t4)" }}>
          Bu işlem gerçek para içermez. Sanal bakiye ile test amaçlıdır.
        </div>
      </div>
    </div>
  );
}


