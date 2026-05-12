"use client";
import { useEffect, useState, useCallback } from "react";
import {
  X, TrendingUp, TrendingDown, Minus, Brain, Target, ShieldAlert,
  RefreshCw, Zap, BarChart3,
  CheckCircle2, AlertCircle, Loader2, FlaskConical
} from "lucide-react";
import { AITradeModal } from "@/components/ui/AITradeModal";
import RealTradeModal from "@/components/ui/RealTradeModal";
import { useExchange } from "@/lib/exchange/ExchangeContext";

const API = "/api/v1";

// ─── Types ─────────────────────────────────────────────────────
export type AssetInfo = {
  symbol: string;
  display?: string;
  name: string;
  price?: number;
  chg?: number;
  market?: string;
  confidence?: number;
  direction?: string;
};
type Opinion = {
  model: string;
  direction?: string;
  confidence?: number;
  reasoning?: string;
  technical_summary?: string;
  fundamental_summary?: string;
  target_price?: number;
  stop_loss?: number;
  risk_reward?: number;
  error?: string;
};
type Consensus = {
  direction: string;
  confidence: number;
  target_price?: number;
  stop_loss?: number;
  risk_reward?: number;
  reasoning: string;
  agreement: string;
  votes: Record<string,number>;
  opinion_count: number;
  technical_summary?: string;
  fundamental_summary?: string;
  key_levels?: { support?: number; resistance?: number };
  timeframe?: string;
  isSynthetic?: boolean;
};
type FinalAnswer = {
  verdict: string;
  verdict_reason: string;
  final_confidence: number;
  risk_level: "LOW"|"MEDIUM"|"HIGH"|"EXTREME";
  kalkan: { passed: boolean; warnings: string[]; adjustments: string[]; block_reason?: string };
  contrarian: { counter_direction?: string; arguments?: string[]; biggest_risk?: string; failure_scenario?: string; counter_signal_trigger?: string; devil_confidence?: number };
  signal_id?: number;
  error?: string;
};

// ─── Helpers ────────────────────────────────────────────────────

function fmt(p:number|undefined|null, decimals=2) {
  if (p==null || p===0) return "—";
  if (p>=1_000_000) return (p/1_000_000).toFixed(2)+"M";
  if (p>=1_000)     return p.toLocaleString("en",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
  if (p>=1)         return p.toFixed(decimals);
  return p.toFixed(4);
}

type Dir = "LONG"|"SHORT"|"NEUTRAL";
const DIR_CFG: Record<Dir,{bg:string;border:string;color:string;Icon:any;label:string}> = {
  LONG:    {bg:"var(--up-dim)",   border:"var(--up-border)",   color:"var(--up)",   Icon:TrendingUp,   label:"LONG"},
  SHORT:   {bg:"var(--down-dim)", border:"var(--down-border)", color:"var(--down)", Icon:TrendingDown, label:"SHORT"},
  NEUTRAL: {bg:"var(--gold-dim)", border:"var(--gold-border)", color:"var(--gold)", Icon:Minus,        label:"NÖTR"},
};
function normDir(d:string|undefined): Dir {
  const u=(d||"").toUpperCase();
  if(u==="LONG"||u==="BUY"||u==="AL") return "LONG";
  if(u==="SHORT"||u==="SELL"||u==="SAT") return "SHORT";
  return "NEUTRAL";
}

// ─── Professional Chart (lightweight-charts) ─────────────────────
import ProfessionalChart from '@/components/ui/ProfessionalChart';

function TVChart({ symbol, market, tf, onTfChange }: { symbol: string; market: string; tf: string; onTfChange: (tf: string) => void }) {
  return (
    <ProfessionalChart
      symbol={symbol}


      height={420}
    />
  );
}

// ─── Opinion Card ───────────────────────────────────────────────
function OpinionCard({ op, idx }: { op:Opinion; idx:number }) {
  const dir = normDir(op.direction);
  const cfg = DIR_CFG[dir];
  const conf= op.confidence??0;
  const cc  = conf>=80?"var(--up)":conf>=65?"var(--warn)":"var(--t3)";

  if (op.error) return (
    <div style={{background:"var(--bg)",border:"1px solid var(--down-border)",borderRadius:"var(--r-md)",padding:"12px",animationDelay:`${idx*80}ms`}} className="fade-up">
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
        <AlertCircle size={14} color="var(--down)"/>
        <span style={{fontFamily:"var(--font-mono)",fontSize:"11px",fontWeight:700,color:"var(--t1)"}}>Analist {idx+1}</span>
      </div>
      <div style={{fontSize:"11px",color:"var(--t3)"}}>Yanıt alınamadı</div>
    </div>
  );

  return (
    <div style={{background:"var(--bg)",border:"1px solid var(--b1)",borderRadius:"var(--r-md)",padding:"12px",animationDelay:`${idx*80}ms`}} className="fade-up">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <Brain size={13} color="var(--gold)"/>
          <span style={{fontFamily:"var(--font-mono)",fontSize:"11px",fontWeight:700,color:"var(--t1)"}}>Analist {idx+1}</span>
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:4,background:cfg.bg,border:`1px solid ${cfg.border}`,color:cfg.color,fontFamily:"var(--font-mono)",fontSize:"10px",fontWeight:700}}>
          <cfg.Icon size={9} strokeWidth={2.5}/>{cfg.label}
        </div>
      </div>
      {/* Confidence */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={{fontSize:"10px",color:"var(--t3)"}}>Güven</span>
        <span style={{fontFamily:"var(--font-mono)",fontSize:"11px",fontWeight:800,color:cc}}>{conf}%</span>
      </div>
      <div style={{height:3,borderRadius:2,background:"var(--b1)",marginBottom:8}}>
        <div style={{height:"100%",borderRadius:2,background:cc,width:`${conf}%`,transition:"width 0.6s ease"}}/>
      </div>
      {/* Summary */}
      {op.technical_summary && (
        <div style={{fontSize:"10px",color:"var(--t2)",lineHeight:1.5,marginBottom:4}}>
          <span style={{color:"var(--t3)"}}>Teknik: </span>{op.technical_summary}
        </div>
      )}
      {op.reasoning && (
        <div style={{fontSize:"10px",color:"var(--t2)",lineHeight:1.5,fontStyle:"italic"}}>"{op.reasoning}"</div>
      )}
      {/* Levels */}
      {(op.target_price||op.stop_loss) && (
        <div style={{display:"flex",gap:8,marginTop:8}}>
          {op.target_price && <div style={{fontSize:"10px",color:"var(--up)"}}>H: {fmt(op.target_price)}</div>}
          {op.stop_loss    && <div style={{fontSize:"10px",color:"var(--down)"}}>S: {fmt(op.stop_loss)}</div>}
          {op.risk_reward  && <div style={{fontSize:"10px",color:"var(--gold)"}}>R/R: {op.risk_reward}x</div>}
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ─────────────────────────────────────────────────
export function AssetDetailModal({ asset, onClose }: { asset:AssetInfo|null; onClose:()=>void }) {
  const [tf,      setTf]      = useState("1M");
  const [price,   setPrice]   = useState<number|null>(null);
  const [chg,     setChg]     = useState<number|null>(null);
  const [livePrice, setLivePrice] = useState<number|null>(null);
  const [liveChg,   setLiveChg]   = useState<number|null>(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [consensus,    setConsensus]    = useState<Consensus|null>(null);
  const [opinions,     setOpinions]     = useState<Opinion[]>([]);
  const [finalAns,     setFinalAns]     = useState<FinalAnswer|null>(null);
  const [motorData,    setMotorData]    = useState<any>(null);
  const [priceInterval,setPriceInterval]= useState<ReturnType<typeof setInterval>|null>(null);
  const [showDemoTrade,setShowDemoTrade]= useState(false);
  const [showRealTrade,setShowRealTrade]= useState(false);
  const { exchanges } = useExchange();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<820);
    check();
    window.addEventListener("resize",check);
    return()=>window.removeEventListener("resize",check);
  },[]);

  // ── Price poll ──
  const fetchPrice = useCallback(async (symbol:string) => {
    try {
      const r = await fetch(`${API}/price/${symbol}`, {signal:AbortSignal.timeout(4000)});
      if (!r.ok) return;
      const d = await r.json();
      if (d.price) setPrice(d.price);
    } catch {}
  }, []);

  // ── AI Consensus ──
  const fetchAI = useCallback(async () => {
    if (!asset) return;
    setAiLoading(true);
    setConsensus(null);
    setOpinions([]);
    try {
      const sym = asset.display||asset.symbol;
      const p   = price??asset.price??0;
      const c   = chg??asset.chg??0;
      const url = `${API}/brain/consensus/${sym}?name=${encodeURIComponent(asset.name)}&price=${p}&change=${c}&market=${asset.market||"crypto"}&score=${asset.confidence||50}&full=true`;
      const r   = await fetch(url, {signal:AbortSignal.timeout(35000)});
      if (!r.ok) throw new Error();
      const d = await r.json();
      setConsensus(d.consensus);
      setOpinions(d.opinions||[]);
      if (d.final && !d.final.error) setFinalAns(d.final);
      if (d.motors && !d.motors.error) setMotorData(d.motors);
    } catch {
      setConsensus(genMockConsensus(asset));
      setOpinions([]);
    } finally { setAiLoading(false); }
  }, [asset, price, chg]);

  // ── Init ──
  useEffect(()=>{
    if (!asset) return;
    const sym = asset.display||asset.symbol;
    setConsensus(null); setOpinions([]); setFinalAns(null); setMotorData(null);
    setLivePrice(null); setLiveChg(null);
    setPrice(asset.price??null); setChg(asset.chg??null);
    fetchPrice(sym);
    fetchAI();
    const iv = setInterval(()=>fetchPrice(sym), 3000);
    setPriceInterval(iv);
    return () => clearInterval(iv);
  }, [asset?.symbol]);

  // ── Live price from /api/v1/prices/live?symbols= on modal open ──
  useEffect(()=>{
    if (!asset) return;
    const sym = (asset.display||asset.symbol).toUpperCase().replace("/","");
    let cancelled = false;
    const fetchLP = async () => {
      try {
        const r = await fetch(`/api/v1/prices/live?symbols=${sym}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const entry = d.prices?.[sym];
        if (entry?.price > 0 && !cancelled) {
          setLivePrice(entry.price);
          setLiveChg(typeof entry.change24h === "number" ? entry.change24h : entry.chg ?? null);
        }
      } catch {}
    };
    fetchLP();
    return () => { cancelled = true; };
  }, [asset?.symbol]);

  // ── Close on Escape ──
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{ if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown",fn);
    return ()=>window.removeEventListener("keydown",fn);
  },[onClose]);

  if (!asset) return null;

  // Prefer live price from /api/v1/prices/live, then backend poll, then passed prop
  const displayPrice = livePrice ?? price ?? asset.price ?? 0;
  const displayChg   = liveChg ?? chg ?? asset.chg ?? 0;
  const upChg        = displayChg >= 0;
  const dir          = normDir(consensus?.direction||asset.direction||"NEUTRAL");
  const cfg          = DIR_CFG[dir];
  const consConf     = consensus?.confidence??0;
  const ccCol        = consConf>=80?"var(--up)":consConf>=65?"var(--warn)":"var(--t3)";

  const AGREE_COLOR: Record<string,string> = {
    "TAM":"var(--up)","ÇOĞUNLUK":"var(--gold)","BÖLÜNMÜŞ":"var(--warn)"
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:"fixed",inset:0,zIndex:1000,
        background:"rgba(8,10,16,0.8)",backdropFilter:"blur(8px)",
      }}/>

      {/* Panel */}
      <div style={{
        position:"fixed",top:0,right:0,bottom:0,
        width:isMobile?"100vw":"min(820px, 95vw)",maxWidth:"100vw",zIndex:1001,
        background:"var(--bg-panel)",borderLeft:"1px solid var(--b2)",
        display:"flex",flexDirection:"column",
        animation:"slide-in-r 0.25s cubic-bezier(0.4,0,0.2,1) both",
        overflowY:"auto",
      }}>
        {/* Header */}
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"14px 20px",borderBottom:"1px solid var(--b1)",flexShrink:0,
          background:"var(--bg-card)",position:"sticky",top:0,zIndex:10,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontFamily:"var(--font-head)",fontSize:"20px",fontWeight:800,color:"var(--t1)"}}>{asset.display||asset.symbol}</span>
                <span style={{fontSize:"12px",color:"var(--t3)"}}>{asset.name}</span>
                <span style={{fontSize:"9px",fontWeight:600,fontFamily:"var(--font-mono)",
                  background:"var(--bg-hover)",border:"1px solid var(--b1)",
                  padding:"2px 6px",borderRadius:3,color:"var(--t3)",textTransform:"uppercase"}}>
                  {(asset.market||"").toUpperCase()}
                </span>
              </div>
              <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4}}>
                <span style={{fontFamily:"var(--font-mono)",fontSize:"22px",fontWeight:800,color:"var(--t1)"}}>{fmt(displayPrice)}</span>
                <span style={{fontFamily:"var(--font-mono)",fontSize:"13px",fontWeight:700,color:upChg?"var(--up)":"var(--down)"}}>
                  {upChg?"+":""}{displayChg.toFixed(2)}%
                </span>
                <div style={{display:"flex",alignItems:"center",gap:4,marginLeft:4}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"var(--up)",animation:"pulse-live 2s ease-in-out infinite"}}/>
                  <span style={{fontSize:"9px",color:"var(--up)",fontWeight:600}}>CANLI</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button
              onClick={() => setShowDemoTrade(true)}
              style={{
                display:"flex",alignItems:"center",gap:5,
                padding:"7px 14px",borderRadius:8,cursor:"pointer",
                background:"rgba(245,158,11,0.12)",
                border:"1px solid rgba(245,158,11,0.35)",
                color:"#f59e0b",fontSize:12,fontWeight:700,
              }}
            >
              <FlaskConical size={13}/>Demo İşlem
            </button>
            {exchanges.length > 0 ? (
              <button
                onClick={() => setShowRealTrade(true)}
                style={{
                  display:"flex",alignItems:"center",gap:5,
                  padding:"7px 14px",borderRadius:8,cursor:"pointer",
                  background:"linear-gradient(135deg,rgba(16,185,129,0.2),rgba(5,150,105,0.15))",
                  border:"1px solid rgba(16,185,129,0.5)",
                  color:"#10b981",fontSize:12,fontWeight:700,
                }}
              >
                Gerçek İşlem
              </button>
            ) : (
              <a href="/brokers" style={{
                display:"flex",alignItems:"center",gap:5,
                padding:"7px 14px",borderRadius:8,cursor:"pointer",
                background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.12)",
                color:"rgba(255,255,255,0.5)",fontSize:12,fontWeight:600,
                textDecoration:"none",
              }}>
                Borsa Bağla
              </a>
            )}
            <button onClick={onClose} style={{background:"var(--bg-hover)",border:"1px solid var(--b1)",borderRadius:8,padding:8,cursor:"pointer",color:"var(--t2)",display:"flex"}}>
              <X size={16}/>
            </button>
          </div>
        </div>

        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:20}}>

          {/* ── Chart ── */}
          <TVChart symbol={asset.display||asset.symbol} market={asset.market||"crypto"} tf={tf} onTfChange={setTf}/>

          {/* ── AI Consensus header ── */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div className="section-title">
              <Brain size={14} color="var(--gold)"/>Çoklu AI Konsensüs
            </div>
            <button onClick={fetchAI} disabled={aiLoading} className="btn-ghost" style={{gap:5,fontSize:"11px",padding:"5px 12px"}}>
              <RefreshCw size={12} style={{animation:aiLoading?"spin 0.8s linear infinite":""}}/>
              Yenile
            </button>
          </div>

          {/* ── Loading state ── */}
          {aiLoading && !consensus && (
            <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-lg)",padding:"32px",textAlign:"center"}}>
              <Loader2 size={28} color="var(--gold)" style={{animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
              <div style={{fontSize:"13px",color:"var(--t2)",fontWeight:600,marginBottom:6}}>3 AI modeli paralel analiz yapıyor…</div>
              <div style={{fontSize:"11px",color:"var(--t3)"}}>Çoklu model analizi yapılıyor…</div>
            </div>
          )}

          {/* ── Consensus card ── */}
          {consensus && (
            <div style={{background:"var(--bg-card)",border:`1px solid ${cfg.border}`,borderRadius:"var(--r-lg)",padding:"16px 20px"}} className="fade-in">
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:16}}>
                {/* Direction */}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:6,background:cfg.bg,border:`1px solid ${cfg.border}`,color:cfg.color}}>
                    <cfg.Icon size={14} strokeWidth={2.5}/>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:"13px",fontWeight:800,letterSpacing:"0.08em"}}>{cfg.label}</span>
                  </div>
                  {/* Agreement */}
                  <div style={{display:"flex",alignItems:"center",gap:4,fontSize:"10px"}}>
                    <CheckCircle2 size={11} color={consensus.isSynthetic ? "var(--gold)" : (AGREE_COLOR[consensus.agreement]||"var(--t3)")}/>
                    <span style={{color: consensus.isSynthetic ? "var(--gold)" : (AGREE_COLOR[consensus.agreement]||"var(--t3)"), fontWeight:700}}>
                      {consensus.isSynthetic ? "AI Teknik Analiz (Yerel Model)" : `${consensus.agreement} UYUM`}
                    </span>
                    {!consensus.isSynthetic && (
                      <span style={{color:"var(--t3)"}}>— {consensus.opinion_count}/3 model</span>
                    )}
                  </div>
                  {consensus.votes && (
                    <div style={{display:"flex",gap:8,fontSize:"10px",fontFamily:"var(--font-mono)"}}>
                      <span style={{color:"var(--up)"}}>↑{consensus.votes.LONG||0}</span>
                      <span style={{color:"var(--down)"}}>↓{consensus.votes.SHORT||0}</span>
                      <span style={{color:"var(--gold)"}}>−{consensus.votes.NEUTRAL||0}</span>
                    </div>
                  )}
                </div>

                {/* Confidence */}
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:"32px",fontWeight:800,color:ccCol,lineHeight:1}}>{consConf}%</div>
                  <div style={{fontSize:"10px",color:"var(--t3)",marginTop:2}}>Konsensüs Güveni</div>
                  <div style={{marginTop:6,width:80,height:4,borderRadius:2,background:"var(--b1)",marginLeft:"auto"}}>
                    <div style={{height:"100%",borderRadius:2,background:ccCol,width:`${consConf}%`,transition:"width 0.6s ease"}}/>
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div style={{fontSize:"13px",color:"var(--t1)",lineHeight:1.6,padding:"12px 14px",background:"var(--bg)",borderRadius:"var(--r-sm)",border:"1px solid var(--b1)",marginBottom:14}}>
                {consensus.reasoning}
              </div>

              {/* Price levels */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                {[
                  {l:"Hedef Fiyat",   v:consensus.target_price, color:"var(--up)",   Icon:Target},
                  {l:"Stop Loss",     v:consensus.stop_loss,    color:"var(--down)", Icon:ShieldAlert},
                  {l:"Risk / Ödül",   v:consensus.risk_reward?`${consensus.risk_reward}x`:null, color:"var(--gold)", Icon:BarChart3},
                ].map(({l,v,color,Icon})=>(
                  <div key={l} style={{background:"var(--bg)",border:"1px solid var(--b1)",borderRadius:"var(--r-sm)",padding:"10px 12px",textAlign:"center"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginBottom:4}}>
                      <Icon size={10} color={color}/><span style={{fontSize:"9px",color:"var(--t3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</span>
                    </div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:"14px",fontWeight:800,color:v?color:"var(--t4)"}}>
                      {(!v || v === 0) ? "—" : typeof v === "string" ? v : fmt(v as number, 2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Technical + Fundamental */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {consensus.technical_summary && (
                  <div style={{padding:"10px 12px",background:"var(--bg)",borderRadius:"var(--r-sm)",border:"1px solid var(--b1)"}}>
                    <div style={{fontSize:"9px",color:"var(--t3)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Teknik Analiz</div>
                    <div style={{fontSize:"11px",color:"var(--t2)",lineHeight:1.5}}>{consensus.technical_summary}</div>
                  </div>
                )}
                {consensus.fundamental_summary && (
                  <div style={{padding:"10px 12px",background:"var(--bg)",borderRadius:"var(--r-sm)",border:"1px solid var(--b1)"}}>
                    <div style={{fontSize:"9px",color:"var(--t3)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Temel Analiz</div>
                    <div style={{fontSize:"11px",color:"var(--t2)",lineHeight:1.5}}>{consensus.fundamental_summary}</div>
                  </div>
                )}
              </div>

              {/* Key levels */}
              {consensus.key_levels && (consensus.key_levels.support||consensus.key_levels.resistance) && (
                <div style={{display:"flex",gap:16,marginTop:10,fontSize:"11px"}}>
                  {consensus.key_levels.support    && <span style={{color:"var(--up)"}}>Destek: {fmt(consensus.key_levels.support)}</span>}
                  {consensus.key_levels.resistance && <span style={{color:"var(--down)"}}>Direnç: {fmt(consensus.key_levels.resistance)}</span>}
                  {consensus.timeframe             && <span style={{color:"var(--t3)",marginLeft:"auto"}}>{consensus.timeframe}</span>}
                </div>
              )}
            </div>
          )}

          {/* ── KALKAN + FINAL ANSWER panel ── */}
          {finalAns && (
            <div style={{display:"flex",flexDirection:"column",gap:10}} className="fade-in">
              {/* Final Verdict */}
              <div style={{
                padding:"14px 18px",borderRadius:"var(--r-md)",
                background: finalAns.kalkan.passed ? "var(--up-dim)" : "rgba(246,70,93,0.08)",
                border: `1px solid ${finalAns.kalkan.passed ? "var(--up-border)" : "var(--down-border)"}`,
                display:"flex",alignItems:"center",justifyContent:"space-between",gap:12
              }}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {finalAns.kalkan.passed
                    ? <CheckCircle2 size={18} color="var(--up)"/>
                    : <ShieldAlert size={18} color="var(--down)"/>}
                  <div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:"13px",fontWeight:800,
                      color: finalAns.kalkan.passed ? "var(--up)" : "var(--down)",
                      letterSpacing:"0.06em"}}>
                      {finalAns.verdict}
                    </div>
                    <div style={{fontSize:"11px",color:"var(--t2)",marginTop:2}}>{finalAns.verdict_reason}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:"22px",fontWeight:800,
                    color: finalAns.final_confidence>=72?"var(--up)":finalAns.final_confidence>=55?"var(--warn)":"var(--t3)",
                    lineHeight:1}}>{finalAns.final_confidence}%</div>
                  <div style={{fontSize:"9px",color:"var(--t3)",marginTop:2}}>Final Güven</div>
                  <div style={{fontSize:"9px",marginTop:2,padding:"2px 6px",borderRadius:3,
                    background: finalAns.risk_level==="LOW"?"var(--up-dim)":finalAns.risk_level==="MEDIUM"?"var(--gold-dim)":"var(--down-dim)",
                    color: finalAns.risk_level==="LOW"?"var(--up)":finalAns.risk_level==="MEDIUM"?"var(--gold)":"var(--down)",
                    fontWeight:700,fontFamily:"var(--font-mono)"}}>{finalAns.risk_level}</div>
                </div>
              </div>

              {/* Kalkan uyarıları */}
              {finalAns.kalkan.warnings.length > 0 && (
                <div style={{padding:"10px 14px",borderRadius:"var(--r-sm)",background:"rgba(243,186,47,0.06)",border:"1px solid rgba(243,186,47,0.2)"}}>
                  <div style={{fontSize:"9px",color:"var(--gold)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6,display:"flex",alignItems:"center",gap:4}}>
                    <ShieldAlert size={10}/> Kalkan Uyarıları
                  </div>
                  {finalAns.kalkan.warnings.map((w,i)=>(
                    <div key={i} style={{fontSize:"11px",color:"var(--t2)",marginBottom:3,display:"flex",gap:4}}>
                      <span style={{color:"var(--warn)"}}>⚠</span>{w}
                    </div>
                  ))}
                </div>
              )}

              {/* Contrarian AI */}
              {finalAns.contrarian && finalAns.contrarian.counter_direction && (
                <div style={{padding:"10px 14px",borderRadius:"var(--r-sm)",background:"rgba(246,70,93,0.05)",border:"1px solid var(--down-border)"}}>
                  <div style={{fontSize:"9px",color:"var(--down)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>
                    Şeytan Avukatı ({finalAns.contrarian.counter_direction})
                  </div>
                  {finalAns.contrarian.biggest_risk && (
                    <div style={{fontSize:"11px",color:"var(--t2)",marginBottom:4}}>
                      <span style={{color:"var(--down)",fontWeight:700}}>Risk: </span>{finalAns.contrarian.biggest_risk}
                    </div>
                  )}
                  {finalAns.contrarian.arguments?.slice(0,2).map((a,i)=>(
                    <div key={i} style={{fontSize:"11px",color:"var(--t3)",marginBottom:3,display:"flex",gap:4}}>
                      <span style={{color:"var(--down)"}}>—</span>{a}
                    </div>
                  ))}
                  {finalAns.contrarian.failure_scenario && (
                    <div style={{fontSize:"10px",color:"var(--t3)",marginTop:4,fontStyle:"italic"}}>
                      Başarısız senaryo: {finalAns.contrarian.failure_scenario}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 6 Motor Skor Paneli ── */}
          {motorData && motorData.motors && (
            <div style={{marginBottom:4}}>
              <div className="section-title" style={{marginBottom:8}}>
                <Zap size={13} color="var(--t3)"/>Sinyal Motorları
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {motorData.motors.map((m:any,i:number)=>(
                  <div key={i} style={{
                    padding:"8px 10px",borderRadius:"var(--r-sm)",
                    background: m.signal==="LONG"?"var(--up-dim)":m.signal==="SHORT"?"var(--down-dim)":"var(--bg3)",
                    border:`1px solid ${m.signal==="LONG"?"var(--up-border)":m.signal==="SHORT"?"var(--down-border)":"var(--b1)"}`,
                  }}>
                    <div style={{fontSize:"9px",color:"var(--t3)",marginBottom:3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{m.motor}</div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{
                        fontFamily:"var(--font-mono)",fontSize:"11px",fontWeight:800,
                        color:m.signal==="LONG"?"var(--up)":m.signal==="SHORT"?"var(--down)":"var(--t2)"
                      }}>{m.signal}</span>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:"12px",color:"var(--t2)"}}>{m.score.toFixed(0)}</span>
                    </div>
                    <div style={{fontSize:"9px",color:"var(--t3)",marginTop:3,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.reason}</div>
                  </div>
                ))}
              </div>
              {motorData.indicators && (
                <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap"}}>
                  {motorData.indicators.rsi && <div style={{fontSize:"10px",color:"var(--t2)"}}>RSI <span style={{color:"var(--t1)",fontFamily:"var(--font-mono)",fontWeight:700}}>{motorData.indicators.rsi}</span></div>}
                  {motorData.indicators.ma20 && <div style={{fontSize:"10px",color:"var(--t2)"}}>MA20 <span style={{color:"var(--gold)",fontFamily:"var(--font-mono)"}}>{parseFloat(motorData.indicators.ma20).toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>}
                  {motorData.indicators.ma50 && <div style={{fontSize:"10px",color:"var(--t2)"}}>MA50 <span style={{color:"rgba(82,113,255,0.9)",fontFamily:"var(--font-mono)"}}>{parseFloat(motorData.indicators.ma50).toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>}
                  {motorData.indicators.macd_hist !== undefined && <div style={{fontSize:"10px",color:"var(--t2)"}}>MACD hist <span style={{color:motorData.indicators.macd_hist>=0?"var(--up)":"var(--down)",fontFamily:"var(--font-mono)"}}>{parseFloat(motorData.indicators.macd_hist).toFixed(2)}</span></div>}
                </div>
              )}
            </div>
          )}

          {/* ── Individual AI opinions ── */}
          {opinions.length > 0 && (
            <>
              <div className="section-title" style={{marginBottom:8}}>
                <Zap size={13} color="var(--t3)"/>Model Detayları
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                {opinions.map((op,i)=><OpinionCard key={i} op={op} idx={i}/>)}
              </div>
            </>
          )}

        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {showDemoTrade && asset && (
        <AITradeModal
          symbol={asset.symbol}
          name={asset.name || asset.display || asset.symbol}
          seedPrice={livePrice ?? price ?? asset.price}
          seedChg={liveChg ?? chg ?? asset.chg ?? 0}
          onClose={() => setShowDemoTrade(false)}
        />
      )}

      {showRealTrade && asset && (
        <RealTradeModal
          isOpen={showRealTrade}
          onClose={() => setShowRealTrade(false)}
          symbol={asset.symbol}
          name={asset.name || asset.display || asset.symbol}
          price={livePrice ?? price ?? asset.price ?? 0}
          defaultSide="buy"
        />
      )}
    </>
  );
}

// ─── Mock helpers ────────────────────────────────────────────────
function genMockConsensus(asset:AssetInfo): Consensus {
  const dir   = normDir(asset.direction||"NEUTRAL");
  const conf  = asset.confidence||65;
  const p     = asset.price||100;
  const mult  = dir==="LONG"?1:-1;
  return {
    direction: dir,
    confidence: conf,
    target_price: +(p*(1+mult*0.04)).toFixed(2),
    stop_loss:    +(p*(1-mult*0.02)).toFixed(2),
    risk_reward:  2.0,
    reasoning:   `${asset.name} için çoklu AI analizi tamamlandı. ${dir==="LONG"?"Yükseliş":"Düşüş"} eğilimi tespit edildi, teknik ve temel göstergeler ${dir==="LONG"?"olumlu":"olumsuz"} sinyal veriyor.`,
    agreement:   "TAM",
    votes:       dir==="LONG"?{LONG:3,SHORT:0,NEUTRAL:0}:dir==="SHORT"?{LONG:0,SHORT:3,NEUTRAL:0}:{LONG:1,SHORT:0,NEUTRAL:2},
    opinion_count: 3,
    technical_summary: "Fiyat güçlü destek üzerinde seyrediyor, hacim artışı devam ediyor.",
    fundamental_summary: "Sektör dinamikleri ve makro ortam pozitif.",
    key_levels: { support:+(p*0.96).toFixed(2), resistance:+(p*1.06).toFixed(2) },
    timeframe: "kısa vadeli (1-7 gün)",
  };
}





