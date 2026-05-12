"use client";
/**
 * AITradeModal - AI analiz + demo iSlem birleSik modal
 * Mobil: full-screen slide-up  |  Desktop: centered overlay
 */
import { useState, useEffect } from "react";
import { X, Brain, TrendingUp, TrendingDown, Zap, Shield, FlaskConical,
         CheckCircle, AlertCircle, Target, ArrowUpRight, ChevronLeft,
         ChevronRight, Activity, BarChart2, AlertTriangle } from "lucide-react";
import { useDemo } from "@/lib/demo/DemoContext";
import { usePrice } from "@/lib/prices/PriceContext";

interface Props {
  symbol: string;
  name: string;
  seedChg?: number;
  seedPrice?: number;
  onClose: () => void;
}

/* â”€â”€â”€ Client-side AI analysis generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function genAI(symbol: string, price: number, chg24: number, chg7d = 0) {
  const sym = symbol.replace("USDT","").replace(".IS","").replace("=F","").replace("=X","");

  let ls = 50; // long score
  if (chg24 > 4) ls += 28; else if (chg24 > 2) ls += 18; else if (chg24 > 0.5) ls += 10;
  else if (chg24 < -4) ls -= 28; else if (chg24 < -2) ls -= 18; else if (chg24 < -0.5) ls -= 10;
  if (chg7d > 6) ls += 10; else if (chg7d < -6) ls -= 10;
  ls = Math.max(12, Math.min(88, ls));

  const dir: "LONG"|"SHORT"|"NEUTRAL" = ls >= 60 ? "LONG" : ls <= 40 ? "SHORT" : "NEUTRAL";
  const conf = Math.round(dir === "NEUTRAL" ? 40 + Math.abs(ls-50) : Math.abs(ls-50) + 47);
  const rsi  = Math.round(Math.max(22, Math.min(78, 50 + chg24*3.8 + chg7d*1.2)));
  const risk = Math.abs(chg24) > 5 ? 78 : Math.abs(chg24) > 3 ? 62 : Math.abs(chg24) > 1.5 ? 46 : 32;
  const tp   = price * (dir === "LONG" ? 1.025 : dir === "SHORT" ? 0.975 : 1.018);
  const sl   = price * (dir === "LONG" ? 0.984 : dir === "SHORT" ? 1.016 : 0.988);

  const reasons: string[] = [];
  if (dir === "LONG") {
    if (chg24 > 0.5) reasons.push(`24s +${chg24.toFixed(2)}% pozitif momentum`);
    if (chg7d > 2)   reasons.push(`Haftalik trend yukari (+${chg7d.toFixed(1)}%)`);
    if (rsi < 67)    reasons.push(`RSI ${rsi} - aSiri alim bolgesinde degil`);
    if (reasons.length < 3) reasons.push("Destek seviyesine yakin, aliS firsati");
    if (reasons.length < 3) reasons.push("Hacim ortalamasi uzerinde iSlem goruyor");
  } else if (dir === "SHORT") {
    if (chg24 < -0.5) reasons.push(`24s ${chg24.toFixed(2)}% negatif momentum`);
    if (chg7d < -2)   reasons.push(`Haftalik trend aSagi (${chg7d.toFixed(1)}%)`);
    if (rsi > 54)     reasons.push(`RSI ${rsi} - aSiri alim bolgesine yakin`);
    if (reasons.length < 3) reasons.push("Direnc seviyesini kiramadi");
    if (reasons.length < 3) reasons.push("SatiS baskisi belirginleSiyor");
  } else {
    reasons.push("Trend henuz netleSmedi");
    reasons.push(`RSI ${rsi} - notr bolge, yon bekleniyor`);
    reasons.push("Tetik seviyesi oluSmayi bekliyor");
  }

  let kalkan: string | null = null;
  if (Math.abs(chg24) > 7) kalkan = "ASiri volatilite - pozisyon boyutunu kucuk tut";
  else if (Math.abs(chg24) > 4.5) kalkan = "Yuksek volatilite - stop-loss mesafesi geniS olabilir";

  const motors = [
    { name:"Trend",     vote: ls >= 55 ? "LONG" : ls <= 45 ? "SHORT" : "NOTR" },
    { name:"Momentum",  vote: chg24 > 1 ? "LONG" : chg24 < -1 ? "SHORT" : "NOTR" },
    { name:"Hacim",     vote: Math.abs(chg24) > 2 ? (chg24>0?"LONG":"SHORT") : "NOTR" },
    { name:"Breakout",  vote: chg7d > 5 ? "LONG" : chg7d < -5 ? "SHORT" : "NOTR" },
    { name:"Kalkan",    vote: risk < 50 ? "ONAY" : "UYARI" },
    { name:"Contrarian",vote: ls > 75 ? "UYARI" : ls < 25 ? "UYARI" : "NOTR" },
  ];

  return { dir, conf, rsi, risk, tp, sl, rr: 2.5, reasons, kalkan, ls, motors, sym };
}

function fmt(v: number, d = 2) {
  if (!isFinite(v)) return "-";
  if (v >= 10000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1000)  return v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return v.toFixed(d);
}

export function AITradeModal({ symbol, name, seedChg = 0, seedPrice, onClose }: Props) {
  const [step, setStep] = useState<"analysis" | "trade">("analysis");
  const [dir, setDir]   = useState<"LONG" | "SHORT">("LONG");
  const [amtRaw, setAmtRaw] = useState("500");
  const [result, setResult] = useState<"ok" | "fail" | null>(null);
  const [mounted, setMounted] = useState(false);

  const { demo, openTrade } = useDemo();
  const pe = usePrice(symbol.includes("USDT") || symbol.length <= 6 ? symbol : symbol + "USDT");
  const livePrice = pe?.price ?? seedPrice ?? 0;
  const liveChg   = pe?.chg  ?? seedChg;

  const ai = genAI(symbol, livePrice, liveChg);

  useEffect(() => {
    setMounted(true);
    if (ai.dir !== "NEUTRAL") setDir(ai.dir);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amt = Math.max(10, Math.min(parseFloat(amtRaw)||10, demo.balance));
  const qty = livePrice > 0 ? amt / livePrice : 0;
  const PRESETS = [100, 250, 500, 1000, 2500];
  const dirColor = dir === "LONG" ? "var(--up)" : "var(--down)";
  const aiDirColor = ai.dir === "LONG" ? "var(--up)" : ai.dir === "SHORT" ? "var(--down)" : "var(--gold)";
  const aiDirLabel = ai.dir === "LONG" ? "AL (LONG)" : ai.dir === "SHORT" ? "SAT (SHORT)" : "NOTR - Bekle";

  function handleTrade() {
    if (!livePrice) return;
    const ok = openTrade(symbol, name, dir, livePrice, amt);
    setResult(ok ? "ok" : "fail");
    if (ok) setTimeout(onClose, 2200);
  }

  if (!mounted) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-end",
        justifyContent: "center",
        padding: "0",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--b2)",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "92dvh",
          overflowY: "auto",
          animation: "slideUp 0.28s ease-out",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
        }}
      >
        {/* â”€â”€ Drag handle â”€â”€ */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--b2)" }} />
        </div>

        {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px 16px",
          borderBottom: "1px solid var(--b1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FlaskConical size={18} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--t1)" }}>
                {ai.sym}   {name}
              </div>
              <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 1 }}>
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>DEMO</span>
                {" "}  Egitim hesabi   Gercek fiyat verileri
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--t3)", padding: 6,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* â”€â”€ Live price bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px",
          background: "var(--bg-hover)",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--t4)", fontWeight: 600, letterSpacing: "0.04em" }}>ANLIK FIYAT</div>
            <div style={{
              fontSize: 22, fontWeight: 900, fontFamily: "var(--font-mono)",
              color: "var(--t1)", lineHeight: 1.2,
            }}>
              ${livePrice > 0 ? fmt(livePrice) : "-"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--t4)", fontWeight: 600, letterSpacing: "0.04em" }}>24S DEÄISIM</div>
            <div style={{
              fontSize: 16, fontWeight: 800,
              color: liveChg >= 0 ? "var(--up)" : "var(--down)",
              display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end",
            }}>
              {liveChg >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {liveChg >= 0 ? "+" : ""}{liveChg.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* â”€â”€ Tab switcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{
          display: "flex", borderBottom: "1px solid var(--b1)",
        }}>
          {([["analysis","Piyasa Analizi"],["trade","ISlem Yap"]] as const).map(([k,l]) => (
            <button key={k} onClick={() => setStep(k)} style={{
              flex: 1, padding: "12px 0", border: "none",
              background: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, fontWeight: step === k ? 800 : 500,
              color: step === k ? "var(--gold)" : "var(--t3)",
              borderBottom: `2px solid ${step === k ? "var(--gold)" : "transparent"}`,
              transition: "all 0.15s",
            }}>{l}</button>
          ))}
        </div>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* â”€â”€ TAB: AI Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {step === "analysis" && (
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* AI Consensus Verdict */}
            <div style={{
              background: `${aiDirColor}11`,
              border: `1px solid ${aiDirColor}44`,
              borderRadius: 14, padding: "14px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Brain size={16} color={aiDirColor} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--t2)", letterSpacing: "0.06em" }}>AYC ANALYTICS</span>
                </div>
                <div style={{
                  padding: "3px 10px", borderRadius: 6,
                  background: `${aiDirColor}22`,
                  border: `1px solid ${aiDirColor}55`,
                  fontSize: 11, fontWeight: 800, color: aiDirColor,
                  letterSpacing: "0.05em",
                }}>{aiDirLabel}</div>
              </div>

              {/* Confidence bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--t4)" }}>Guven Duzeyi</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: aiDirColor }}>{ai.conf}%</span>
                </div>
                <div style={{ height: 6, background: "var(--b1)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    width: `${ai.conf}%`, height: "100%",
                    background: `linear-gradient(90deg, ${aiDirColor}88, ${aiDirColor})`,
                    borderRadius: 3, transition: "width 0.6s ease",
                  }} />
                </div>
              </div>

              {/* Reasons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ai.reasons.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: aiDirColor, flexShrink: 0, marginTop: 5,
                    }} />
                    <span style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.4 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical indicators */}
            <div style={{
              background: "var(--bg-hover)", borderRadius: 12,
              padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
            }}>
              {[
                { label: "RSI(14)", val: ai.rsi.toString(), color: ai.rsi > 65 ? "var(--down)" : ai.rsi < 35 ? "var(--up)" : "var(--gold)" },
                { label: "Risk",    val: ai.risk + "/100",  color: ai.risk > 65 ? "var(--down)" : ai.risk > 45 ? "var(--gold)" : "var(--up)" },
                { label: "R/R",     val: "1:" + ai.rr,      color: "var(--t1)" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "var(--t4)", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-mono)", color }}>{val}</div>
                </div>
              ))}
            </div>

            {/* TP / SL */}
            {livePrice > 0 && (
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
              }}>
                <div style={{
                  background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <Target size={12} color="var(--up)" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--t4)" }}>HEDEF FIYAT</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 800, color: "var(--up)" }}>
                    ${fmt(ai.tp)}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--up)", marginTop: 1 }}>
                    +{((Math.abs(ai.tp - livePrice) / livePrice) * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{
                  background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <Shield size={12} color="var(--down)" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--t4)" }}>STOP LOSS</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 800, color: "var(--down)" }}>
                    ${fmt(ai.sl)}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--down)", marginTop: 1 }}>
                    -{((Math.abs(ai.sl - livePrice) / livePrice) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            {/* Motor votes */}
            <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 12 }}>
              <div style={{ fontSize: 10, color: "var(--t4)", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 8 }}>
                MOTOR OYLARI
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {ai.motors.map(m => {
                  const c = m.vote === "LONG" || m.vote === "ONAY" ? "var(--up)"
                    : m.vote === "SHORT" || m.vote === "UYARI" ? "var(--down)"
                    : "var(--t4)";
                  return (
                    <div key={m.name} style={{
                      background: "var(--bg-hover)", borderRadius: 8,
                      padding: "6px 8px", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 9, color: "var(--t4)", marginBottom: 2 }}>{m.name}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: c }}>{m.vote}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kalkan warning */}
            {ai.kalkan && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 12px",
                background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)",
                borderRadius: 10,
              }}>
                <AlertTriangle size={14} color="var(--down)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--down)", marginBottom: 2 }}>KALKAN UYARISI</div>
                  <div style={{ fontSize: 11, color: "var(--t2)" }}>{ai.kalkan}</div>
                </div>
              </div>
            )}

            {/* Direction toggle on analysis tab */}
            <div style={{
              display:"flex", gap:0, borderRadius:"var(--r-md)",
              overflow:"hidden", border:"1px solid var(--b1)", marginBottom:8,
            }}>
              {(["LONG","SHORT"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDir(d)}
                  style={{
                    flex:1, padding:"8px 0", fontSize:12, fontWeight:700,
                    cursor:"pointer", border:"none", transition:"all 0.15s",
                    background: dir===d
                      ? d==="LONG" ? "var(--up)" : "var(--down)"
                      : "var(--bg-hover)",
                    color: dir===d ? "var(--bg)" : "var(--t3)",
                  }}
                >
                  {d==="LONG" ? "AL (Long)" : "SAT (Short)"}
                </button>
              ))}
            </div>

            {/* CTA  trade tab */}
            <button
              onClick={() => setStep("trade")}
              style={{
                width: "100%", padding: "14px 0",
                background: `linear-gradient(135deg, ${dirColor}, ${dir === "LONG" ? "#059669" : "#b91c1c"})`,
                border: "none", borderRadius: 12, cursor: "pointer",
                fontWeight: 800, fontSize: 14, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: `0 4px 16px ${dirColor}33`,
              }}
            >
              <Zap size={16} />
              {dir === "LONG" ? "Demo ISlem Ac - AL" : "Demo ISlem Ac - SAT"}
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* â”€â”€ TAB: Trade Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {step === "trade" && (
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Back to analysis */}
            <button
              onClick={() => setStep("analysis")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--t3)", fontSize: 12, display: "flex", alignItems: "center", gap: 4,
                padding: "0 0 4px", alignSelf: "flex-start",
              }}
            >
              <ChevronLeft size={14} /> AI Analizini Gor
            </button>

            {/* Demo balance */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "var(--bg-hover)", borderRadius: 10,
            }}>
              <span style={{ fontSize: 12, color: "var(--t3)" }}>Demo Bakiye</span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800,
                color: "var(--gold)",
              }}>${demo.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            </div>

            {/* Direction */}
            <div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, fontWeight: 600 }}>
                Yon Sec
                {ai.dir !== "NEUTRAL" && (
                  <span style={{ marginLeft: 8, fontSize: 10, color: aiDirColor }}>
                    â† Oneri: {ai.dir === "LONG" ? "AL" : "SAT"}
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["LONG","SHORT"] as const).map(d => (
                  <button key={d} onClick={() => setDir(d)} style={{
                    padding: "12px 0", borderRadius: 10, cursor: "pointer",
                    border: `2px solid ${dir === d ? (d === "LONG" ? "var(--up)" : "var(--down)") : "var(--b1)"}`,
                    background: dir === d
                      ? d === "LONG" ? "rgba(16,185,129,0.15)" : "rgba(246,70,93,0.15)"
                      : "var(--bg-hover)",
                    fontWeight: 800, fontSize: 14, color: dir === d
                      ? (d === "LONG" ? "var(--up)" : "var(--down)")
                      : "var(--t3)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "all 0.15s",
                  }}>
                    {d === "LONG" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {d === "LONG" ? "AL (Long)" : "SAT (Short)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, fontWeight: 600 }}>Yatirim Miktari (USD)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {PRESETS.map(p => (
                  <button key={p} onClick={() => setAmtRaw(String(p))} style={{
                    padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "none",
                    fontSize: 12, fontWeight: 700,
                    background: amt === p ? "var(--purple)" : "var(--bg-hover)",
                    color: amt === p ? "#fff" : "var(--t3)",
                    transition: "all 0.15s",
                  }}>${p}</button>
                ))}
              </div>
              <input
                type="text" inputMode="decimal"
                value={amtRaw}
                onChange={e => { const v=e.target.value; if(/^\d*\.?\d*$/.test(v)||v==="") setAmtRaw(v); }}
                onBlur={e => { const n=parseFloat(e.target.value)||10; setAmtRaw(String(Math.min(Math.max(10,n),demo.balance))); }}
                style={{
                  width: "100%", padding: "11px 14px",
                  background: "var(--bg-hover)", border: "1px solid var(--b2)",
                  borderRadius: 10, color: "var(--t1)",
                  fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700,
                  outline: "none", boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 10, color: "var(--t4)", marginTop: 5 }}>
                Kullanilabilir: ${demo.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                {amt > demo.balance && (
                  <span style={{ color: "var(--down)", marginLeft: 8 }}>âš  Yetersiz bakiye</span>
                )}
              </div>
            </div>

            {/* Order summary */}
            {livePrice > 0 && (
              <div style={{
                background: "var(--bg-hover)", borderRadius: 12,
                padding: "12px 14px", display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
              }}>
                {[
                  { label: "Miktar", val: qty < 0.001 ? qty.toExponential(2) : qty < 1 ? qty.toFixed(4) : qty.toFixed(3) },
                  { label: "TP ~2.5%", val: `$${fmt(livePrice * (dir==="LONG"?1.025:0.975))}` },
                  { label: "SL ~1.6%", val: `$${fmt(livePrice * (dir==="LONG"?0.984:1.016))}` },
                ].map(({ label, val }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "var(--t4)", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--t1)" }}>{val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Execute button */}
            {result === "ok" ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "16px 0", color: "var(--up)",
              }}>
                <CheckCircle size={22} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Demo iSlem acildi!</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>ISlemler  Trades sayfasinda takip edebilirsiniz</div>
                </div>
              </div>
            ) : result === "fail" ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "16px 0", color: "var(--down)",
              }}>
                <AlertCircle size={22} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Yetersiz bakiye!</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>Daha kucuk bir miktar girin</div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleTrade}
                disabled={!livePrice || amt > demo.balance || amt < 10}
                style={{
                  width: "100%", padding: "15px 0",
                  background: dir === "LONG"
                    ? "linear-gradient(135deg, var(--up), #059669)"
                    : "linear-gradient(135deg, var(--down), #b91c1c)",
                  border: "none", borderRadius: 12, cursor: "pointer",
                  fontWeight: 900, fontSize: 15, color: "#fff",
                  opacity: (!livePrice || amt > demo.balance || amt < 10) ? 0.5 : 1,
                  boxShadow: `0 5px 20px ${dirColor}33`,
                  letterSpacing: "0.03em",
                  transition: "opacity 0.2s",
                }}
              >
                {dir === "LONG" ? "DEMO AL" : "DEMO SAT"} - ${amt.toLocaleString()}
              </button>
            )}

            <div style={{ textAlign: "center", fontSize: 10, color: "var(--t4)" }}>
              Bu iSlem gercek para icermez   Sanal bakiye   Egitim amaclidir
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}


