"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, TrendingDown, Activity, Award, Clock,
  ChevronUp, ChevronDown, Wallet, Zap, ArrowUpRight, ArrowDownRight,
  Minus, RefreshCw, X
} from "lucide-react";
import { usePrices } from "@/lib/prices/PriceContext";
import { useDemo, type DemoTrade, type ClosedDemoTrade } from "@/lib/demo/DemoContext";
import { isGuestDemo, getUser } from "@/lib/auth";

/* ”€”€”€ helpers ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€ */
const fmt = (v: number, d = 2) => {
  const abs = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (abs >= 1e6)  return `${s}$${(abs/1e6).toFixed(2)}M`;
  if (abs >= 1e3)  return `${s}$${(abs/1e3).toFixed(2)}K`;
  return `${s}$${abs.toFixed(d)}`;
};
const fmtPx = (v: number) =>
  v >= 1000 ? v.toLocaleString("en-US",{minimumFractionDigits:2, maximumFractionDigits:2}) :
  v >= 1    ? v.toFixed(3) :
  v >= 0.01 ? v.toFixed(4) :
  v.toFixed(6);

const dur = (ms: number) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)  return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}dk`;
  if (s < 86400) return `${Math.floor(s/3600)}sa`;
  return `${Math.floor(s/86400)}g`;
};

export default function TradesPage() {
  const { demo, openPnlUSD, totalValue, totalPnlUSD, totalPnlPct, closeTrade, reset } = useDemo();
  const prices = usePrices();
  const [tab, setTab] = useState<"open"|"closed">("open");
  const [confirmReset, setConfirmReset] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDemoUser, setIsDemoUser] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDemoUser(isGuestDemo() || !getUser());
  }, []);

  const lp = (sym: string) => {
    const e = prices[sym] ?? prices[sym + "USDT"] ?? prices[sym.replace("/","").toUpperCase()];
    return e?.price ?? 0;
  };

  const openTrades = demo.openTrades;
  const closedTrades = demo.closedTrades;

  const totalClosed    = closedTrades.length;
  const winCount       = closedTrades.filter(t => t.pnlUSD > 0).length;
  const winRate        = totalClosed > 0 ? ((winCount / totalClosed) * 100).toFixed(1) : "0.0";
  const totalClosedPnl = closedTrades.reduce((s, t) => s + t.pnlUSD, 0);

  /* stat cards */
  const stats = [
    { label:"Demo Bakiye",     value:mounted ? fmt(demo.balance)   : "-", sub:"Kullanılabilir", icon:Wallet,   up:true   },
    { label:"Toplam Deger",    value:mounted ? fmt(totalValue)     : "-", sub:mounted ? `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%` : "-", icon:BarChart3, up: totalPnlUSD >= 0 },
    { label:"Açık PnL",        value:mounted ? fmt(openPnlUSD)     : "-", sub:`${openTrades.length} açık işlem`,  icon:Activity, up: openPnlUSD >= 0 },
    { label:"Kapalı Getiri",   value:mounted ? fmt(totalClosedPnl) : "-", sub:`Kazanma: ${winRate}%`, icon:Award, up: totalClosedPnl >= 0 },
  ];

  if (!mounted) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200}}>
      <div style={{width:28,height:28,border:"2px solid var(--gold)",borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,color:"var(--t1)",fontFamily:"var(--font-head)",margin:0}}>
            İşlemlerim
          </h1>
          <p style={{fontSize:12,color:"var(--t3)",margin:"4px 0 0"}}>
            Demo portfoy   $10,000 sanal bakiye ile basladin
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={() => setConfirmReset(true)} style={{
            display:"flex",alignItems:"center",gap:5,padding:"6px 12px",
            background:"rgba(246,70,93,0.07)",border:"1px solid rgba(246,70,93,0.2)",
            borderRadius:"var(--r-sm)",fontSize:11,color:"var(--down)",cursor:"pointer",
            fontFamily:"var(--font-body)",fontWeight:600,
          }}>
            <RefreshCw size={12}/> Sıfırla
          </button>
          {isDemoUser && (
            <a href="/signup" style={{
              display:"flex",alignItems:"center",gap:5,padding:"6px 12px",
              background:"linear-gradient(135deg,var(--gold),#B88A30)",
              borderRadius:"var(--r-sm)",fontSize:11,color:"#0C0E16",fontWeight:800,
              textDecoration:"none",fontFamily:"var(--font-body)",
            }}>
              <Zap size={12}/> Gerçek Hesap Aç
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-scroll">
        {stats.map((s, i) => (
          <div key={i} style={{
            flex:"0 0 auto", minWidth:150,
            background:"var(--bg-card)", border:"1px solid var(--b1)",
            borderRadius:"var(--r-lg)", padding:"14px 16px",
          }}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,color:"var(--t3)",fontWeight:600}}>{s.label}</span>
              <s.icon size={14} color="var(--t4)"/>
            </div>
            <div style={{fontSize:20,fontWeight:800,color:i===0?"var(--gold)":s.up?"var(--up)":"var(--down)",fontFamily:"var(--font-mono)"}}>{s.value}</div>
            <div style={{fontSize:11,color:"var(--t4)",marginTop:4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,borderBottom:"1px solid var(--b1)",paddingBottom:0}}>
        {(["open","closed"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:"8px 16px",fontSize:12,fontWeight:tab===t?700:500,
            background:"none",border:"none",cursor:"pointer",fontFamily:"var(--font-body)",
            color:tab===t?"var(--gold)":"var(--t3)",
            borderBottom:tab===t?"2px solid var(--gold)":"2px solid transparent",
            transition:"all 0.15s",
          }}>
            {t === "open"
              ? `Açık (${openTrades.length})`
              : `Kapalı (${closedTrades.length})`
            }
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "open" && (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {openTrades.length === 0 ? (
            <div style={{
              textAlign:"center",padding:"48px 24px",
              background:"var(--bg-card)",border:"1px solid var(--b1)",
              borderRadius:"var(--r-xl)",
            }}>
              <Activity size={32} color="var(--t4)" style={{marginBottom:12}}/>
              <div style={{fontSize:14,fontWeight:700,color:"var(--t2)",marginBottom:6}}>Açık işlem yok</div>
              <div style={{fontSize:12,color:"var(--t3)",marginBottom:16}}>Piyasalar sayfasından veya herhangi bir varlık kartından demo işlem aç</div>
              <a href="/market" style={{
                display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",
                background:"var(--gold-dim)",border:"1px solid var(--gold-border)",
                borderRadius:"var(--r-sm)",color:"var(--gold)",fontWeight:700,
                textDecoration:"none",fontSize:12,
              }}>
                <TrendingUp size={13}/> Piyasalara Git
              </a>
            </div>
          ) : (
            openTrades.map(t => {
              const cur = lp(t.symbol);
              const pnl = cur > 0
                ? (t.direction === "LONG" ? (cur - t.entryPrice) * t.quantity : (t.entryPrice - cur) * t.quantity)
                : 0;
              const pnlPct = t.investedUSD > 0 ? (pnl / t.investedUSD) * 100 : 0;
              const up = pnl >= 0;
              return (
                <div key={t.id} style={{
                  background:"var(--bg-card)",border:"1px solid var(--b1)",
                  borderRadius:"var(--r-lg)",padding:"14px 16px",
                  display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",
                }}>
                  <div style={{
                    width:38,height:38,borderRadius:10,flexShrink:0,
                    background:t.direction==="LONG"?"rgba(38,215,130,0.12)":"rgba(246,70,93,0.12)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>
                    {t.direction === "LONG" ? <TrendingUp size={16} color="var(--up)"/> : <TrendingDown size={16} color="var(--down)"/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:800,color:"var(--t1)",fontSize:13,fontFamily:"var(--font-mono)"}}>
                        {t.symbol.replace("USDT","")}
                      </span>
                      <span style={{
                        fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:3,
                        background:t.direction==="LONG"?"rgba(38,215,130,0.15)":"rgba(246,70,93,0.15)",
                        color:t.direction==="LONG"?"var(--up)":"var(--down)",
                      }}>{t.direction}</span>
                      <span style={{fontSize:10,color:"var(--t4)"}}>  {dur(t.openedAt)} önce</span>
                    </div>
                    <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>
                      Giriş: ${fmtPx(t.entryPrice)}   Yatırım: {fmt(t.investedUSD)}
                      {cur > 0 && <>   Şimdi: ${fmtPx(cur)}</>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:15,fontWeight:800,color:up?"var(--up)":"var(--down)",fontFamily:"var(--font-mono)"}}>
                      {up?"+":""}{fmt(pnl)}
                    </div>
                    <div style={{fontSize:11,color:up?"var(--up)":"var(--down)"}}>
                      {up?"+":""}{pnlPct.toFixed(2)}%
                    </div>
                  </div>
                  {cur > 0 && (
                    <button onClick={() => closeTrade(t.id, cur)} style={{
                      padding:"6px 12px",background:"rgba(246,70,93,0.08)",
                      border:"1px solid rgba(246,70,93,0.2)",borderRadius:"var(--r-sm)",
                      fontSize:11,color:"var(--down)",cursor:"pointer",fontWeight:700,
                      fontFamily:"var(--font-body)",flexShrink:0,
                    }}>
                      Kapat
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "closed" && (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {closedTrades.length === 0 ? (
            <div style={{
              textAlign:"center",padding:"48px 24px",
              background:"var(--bg-card)",border:"1px solid var(--b1)",
              borderRadius:"var(--r-xl)",
            }}>
              <Clock size={32} color="var(--t4)" style={{marginBottom:12}}/>
              <div style={{fontSize:14,fontWeight:700,color:"var(--t2)",marginBottom:6}}>Henüz kapalı işlem yok</div>
              <div style={{fontSize:12,color:"var(--t3)"}}>İşlemlerini kapatınca burada görünür</div>
            </div>
          ) : (
            closedTrades.map(t => {
              const up = t.pnlUSD >= 0;
              return (
                <div key={t.id} style={{
                  background:"var(--bg-card)",border:"1px solid var(--b1)",
                  borderRadius:"var(--r-lg)",padding:"14px 16px",
                  display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",
                  opacity:0.85,
                }}>
                  <div style={{
                    width:38,height:38,borderRadius:10,flexShrink:0,
                    background:up?"rgba(38,215,130,0.08)":"rgba(246,70,93,0.08)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>
                    {up ? <ArrowUpRight size={16} color="var(--up)"/> : <ArrowDownRight size={16} color="var(--down)"/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:800,color:"var(--t1)",fontSize:13,fontFamily:"var(--font-mono)"}}>
                        {t.symbol.replace("USDT","")}
                      </span>
                      <span style={{
                        fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:3,
                        background:t.direction==="LONG"?"rgba(38,215,130,0.12)":"rgba(246,70,93,0.12)",
                        color:t.direction==="LONG"?"var(--up)":"var(--down)",
                      }}>{t.direction}</span>
                    </div>
                    <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>
                      Giriş: ${fmtPx(t.entryPrice)}  Çıkış: ${fmtPx(t.exitPrice)}   {dur(t.closedAt)} önce
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:15,fontWeight:800,color:up?"var(--up)":"var(--down)",fontFamily:"var(--font-mono)"}}>
                      {up?"+":""}{fmt(t.pnlUSD)}
                    </div>
                    <div style={{fontSize:11,color:up?"var(--up)":"var(--down)"}}>
                      {up?"+":""}{t.pnlPct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Reset confirmation */}
      {confirmReset && (
        <div style={{
          position:"fixed",inset:0,zIndex:500,
          background:"rgba(8,10,16,0.75)",backdropFilter:"blur(8px)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16,
        }}>
          <div style={{
            background:"var(--bg-card)",border:"1px solid var(--b1)",
            borderRadius:"var(--r-xl)",padding:"28px 24px",maxWidth:360,width:"100%",
          }}>
            <h3 style={{fontSize:16,fontWeight:800,color:"var(--t1)",margin:"0 0 10px",fontFamily:"var(--font-head)"}}>
              Demo Hesabı Sıfırla?
            </h3>
            <p style={{fontSize:13,color:"var(--t3)",margin:"0 0 20px",lineHeight:1.5}}>
              Tüm işlemler ve bakiye geçmişi silinecek. $10,000 sanal bakiyeyle yeniden başlayacaksın.
            </p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={() => { reset(); setConfirmReset(false); }} style={{
                flex:1,padding:"10px",background:"rgba(246,70,93,0.1)",
                border:"1px solid rgba(246,70,93,0.2)",borderRadius:"var(--r-sm)",
                color:"var(--down)",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"var(--font-body)",
              }}>Evet, Sıfırla</button>
              <button onClick={() => setConfirmReset(false)} style={{
                flex:1,padding:"10px",background:"var(--bg-hover)",
                border:"1px solid var(--b1)",borderRadius:"var(--r-sm)",
                color:"var(--t2)",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"var(--font-body)",
              }}>İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




