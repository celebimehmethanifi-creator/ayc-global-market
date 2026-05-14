"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AssetDetailModal, type AssetInfo } from "@/components/ui/AssetDetailModal";
import { Zap, Eye, Crosshair, Shield, Activity, TrendingUp, TrendingDown, RefreshCw, Filter, ChevronRight, FlaskConical } from "lucide-react";
import { usePrices } from "@/lib/prices/PriceContext";
import { AITradeModal } from "@/components/ui/AITradeModal";
import { useI18n } from "@/lib/i18n";
import { hasMeaningfulSignal, normalizeSignalsPayload, type NormalizedSignal, type SignalStage } from "@/lib/signals/normalize";

type Stage = SignalStage;

const STAGE_META: Record<Stage,{label:string;color:string;dim:string;border:string;Icon:any;desc:string}> = {
  TRIGGER:{ label:"Tetik Alarmı",    color:"var(--up)",    dim:"var(--up-dim)",    border:"var(--up-border)",   Icon:Crosshair, desc:"Hacim destekli kırılım — giris bölgesinde" },
  SETUP:  { label:"Kurulum Oluşuyor",color:"var(--gold)",  dim:"var(--gold-dim)",  border:"var(--gold-border)", Icon:Zap,       desc:"Islem ihtimali dogdu — tetik bekleniyor" },
  WATCH:  { label:"İzleme Alarmi",   color:"var(--info)",  dim:"rgba(96,165,250,0.08)",border:"rgba(96,165,250,0.25)",Icon:Eye,desc:"Bir sey oluyor — yakin takip modu" },
  KALKAN: { label:"Kalkan Bloke",    color:"var(--down)",  dim:"var(--down-dim)",  border:"var(--down-border)", Icon:Shield,    desc:"Sinyal var ama risk filtresi bloke etti" },
  NONE:   { label:"Sinyal Yok",      color:"var(--t4)",    dim:"var(--bg-hover)",  border:"var(--b1)",          Icon:Activity,  desc:"Sinyal sartlari olusmuyor" },
};

const SCORE_LABELS: Record<string,{label:string;color:(v:number)=>string}> = {
  opportunity:{ label:"Fırsat",  color:v=>v>=65?"var(--up)":v>=45?"var(--gold)":"var(--down)" },
  risk:       { label:"Risk",    color:v=>v<=35?"var(--up)":v<=60?"var(--gold)":"var(--down)" },
  confidence: { label:"Güven",   color:v=>v>=65?"var(--up)":v>=45?"var(--gold)":"var(--down)" },
  trend:      { label:"Trend",   color:v=>v>=60?"var(--up)":v>=45?"var(--gold)":"var(--down)" },
  liquidity:  { label:"Likidite",color:v=>v>=60?"var(--up)":v>=40?"var(--gold)":"var(--down)" },
  volatility: { label:"Volatilite",color:v=>v<=40?"var(--up)":v<=65?"var(--gold)":"var(--down)" },
};

function ScoreBar({label,value,color}:{label:string;value:number;color:string}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
      <span style={{fontSize:9,color:"var(--t4)",width:52,flexShrink:0,fontWeight:600}}>{label}</span>
      <div style={{flex:1,height:4,background:"var(--b1)",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${value}%`,height:"100%",background:color,borderRadius:2,transition:"width 0.5s ease"}}/>
      </div>
      <span style={{fontSize:9,fontFamily:"var(--font-mono)",fontWeight:700,color,width:24,textAlign:"right"}}>{value}</span>
    </div>
  );
}

function safeNum(v: any, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function SignalCard({sig, livePrice, onDetail, onDemo}:{sig:NormalizedSignal; livePrice?:number; onDetail:()=>void; onDemo:()=>void}) {
  const displayPrice = livePrice ?? safeNum(sig.price, 0);
  const chg24 = safeNum(sig.change_24h, 0);
  const m = STAGE_META[sig.stage as Stage] || STAGE_META.NONE;
  const isNoSignal = !hasMeaningfulSignal(sig);
  const up = chg24 >= 0;
  return (
    <div onClick={onDetail} style={{
      background:"var(--bg-card)",
      border:`1px solid ${m.border}`,
      borderRadius:"var(--r-xl)",
      padding:"16px 18px",
      cursor:"pointer",
      transition:"all 0.15s",
      position:"relative",
      overflow:"hidden",
    }}
    onMouseEnter={e=>(e.currentTarget.style.transform="translateY(-1px)")}
    onMouseLeave={e=>(e.currentTarget.style.transform="translateY(0)")}>
      {/* Stage glow line */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:m.color,opacity:0.8}}/>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{
            width:36,height:36,borderRadius:9,flexShrink:0,
            background:m.dim,border:`1px solid ${m.border}`,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <m.Icon size={16} color={m.color}/>
          </div>
          <div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:14,fontWeight:800,color:"var(--t1)"}}>{sig.symbol}</div>
            <div style={{fontSize:10,color:"var(--t3)",marginTop:1}}>{sig.name}</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{
            fontSize:9,fontWeight:800,letterSpacing:"0.08em",
            color:m.color,background:m.dim,border:`1px solid ${m.border}`,
            padding:"2px 8px",borderRadius:4,marginBottom:4,display:"inline-block"
          }}>{m.label.toUpperCase()}</div>
          {isNoSignal ? (
            <div style={{fontSize:10,color:"var(--t4)",fontWeight:600}}>Sinyal yok</div>
          ) : (
            <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,
              color:up?"var(--up)":"var(--down)",display:"flex",alignItems:"center",gap:3,justifyContent:"flex-end"}}>
              {up?<TrendingUp size={10}/>:<TrendingDown size={10}/>}
              {up?"+":""}{(sig.change_24h||0).toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Price */}
      <div style={{fontFamily:"var(--font-mono)",fontSize:18,fontWeight:800,color:"var(--t1)",marginBottom:10}}>
        ${displayPrice.toLocaleString("en-US",{maximumFractionDigits:2})}
      </div>

      {/* Stage reason */}
      <div style={{fontSize:11,color:"var(--t2)",lineHeight:1.5,marginBottom:12,minHeight:32}}>
        {isNoSignal
          ? "Bu varlık için aktif sinyal yok. Son fiyat hareketi izleniyor."
          : `${sig.reason?.substring(0,100) || ""}${sig.reason?.length>100?"...":""}`}
      </div>

      {/* 6 score bars */}
      {!isNoSignal && (
        <div style={{borderTop:"1px solid var(--b1)",paddingTop:10}}>
          {Object.entries(SCORE_LABELS).map(([key, meta]) => {
            const scoreKey = key as keyof typeof sig.scores;
            const scoreValue = sig.scores?.[scoreKey] || 0;
            return (
              <ScoreBar
                key={key}
                label={meta.label}
                value={scoreValue}
                color={meta.color(scoreValue)}
              />
            );
          })}
        </div>
      )}

      {/* Trigger / Invalidation */}
      {!isNoSignal && (sig.trigger_level || sig.invalidation) && (
        <div style={{
          display:"flex",gap:8,marginTop:10,
          padding:"8px 10px",background:"var(--bg-hover)",borderRadius:"var(--r-sm)"
        }}>
          {sig.trigger_level && (
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:"var(--t4)",fontWeight:700,letterSpacing:"0.06em"}}>TETIK</div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:"var(--up)"}}>${sig.trigger_level?.toLocaleString()}</div>
            </div>
          )}
          {sig.invalidation && (
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:"var(--t4)",fontWeight:700,letterSpacing:"0.06em"}}>IPTAL</div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:"var(--down)"}}>${sig.invalidation?.toLocaleString()}</div>
            </div>
          )}
          {sig.take_profit && (
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:"var(--t4)",fontWeight:700,letterSpacing:"0.06em"}}>HEDEF</div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:"var(--up)"}}>${sig.take_profit?.toLocaleString()}</div>
            </div>
          )}
        </div>
      )}

      {/* KALKAN warning */}
      {!isNoSignal && sig.kalkan_reason && (
        <div style={{
          marginTop:8,padding:"6px 10px",
          background:"var(--down-dim)",border:"1px solid var(--down-border)",borderRadius:"var(--r-sm)",
          fontSize:10,color:"var(--down)",lineHeight:1.4,display:"flex",gap:6,alignItems:"flex-start"
        }}>
          <Shield size={10} style={{flexShrink:0,marginTop:1}}/>{sig.kalkan_reason.substring(0,80)}
        </div>
      )}

      {/* Bottom */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10}}>
        <div style={{display:"flex",gap:3}}>
          {Object.entries(sig.motor_votes || {}).map(([motor,vote])=>(
            <div key={motor} title={motor} style={{
              width:6,height:6,borderRadius:"50%",
              background:vote==="LONG"?"var(--up)":vote==="SHORT"?"var(--down)":"var(--t4)",
            }}/>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={e=>{e.stopPropagation();onDemo();}} style={{
            padding:"4px 10px",borderRadius:6,border:"1px solid rgba(245,158,11,0.4)",
            background:"rgba(245,158,11,0.1)",color:"#f59e0b",fontSize:10,fontWeight:700,
            cursor:"pointer",display:"flex",alignItems:"center",gap:4,
          }}>
            <FlaskConical size={9}/>Demo
          </button>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"var(--t3)"}}>
            Derin Analiz <ChevronRight size={10}/>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCK_SIGNALS = [
  {symbol:"BTCUSDT",name:"Bitcoin",   market:"crypto",stage:"SETUP",  direction:"LONG", price:81250, change_24h:1.82,
   ai_hint:"Kurulum olusus. Fırsat 91/100. Kirilinirsa tetik: $81,319.",
   trigger_level:81319,invalidation:79060,take_profit:84300,
   scores:{opportunity:91,risk:30,confidence:60,trend:61,liquidity:59,volatility:47,composite:58},
   motor_votes:{TrendTakip:"LONG",Momentum:"LONG",Hacim:"LONG",Reversal:"IZLE",Breakout:"NEUTRAL",Contrarian:"NEUTRAL"},
   warnings:[],kalkan_reason:null},
  {symbol:"ETHUSDT",name:"Ethereum",  market:"crypto",stage:"WATCH",  direction:"LONG", price:2357,  change_24h:2.41,
   ai_hint:"Hareket baslangici. 3/6 motor pozitif. Hacim anomalisi tespit edildi.",
   trigger_level:2380,invalidation:2290,take_profit:null,
   scores:{opportunity:68,risk:38,confidence:52,trend:55,liquidity:63,volatility:52,composite:44},
   motor_votes:{TrendTakip:"LONG",Momentum:"LONG",Hacim:"NEUTRAL",Reversal:"NEUTRAL",Breakout:"IZLE",Contrarian:"LONG"},
   warnings:[],kalkan_reason:null},
  {symbol:"XAUUSD",name:"Altin",      market:"precious",stage:"TRIGGER",direction:"LONG",price:3295,  change_24h:0.28,
   ai_hint:"5/6 motor LONG. Fırsat 88 | Risk 22 | Güven 79. Tetik $3,308, iptal $3,265.",
   trigger_level:3308,invalidation:3265,take_profit:3380,
   scores:{opportunity:88,risk:22,confidence:79,trend:82,liquidity:71,volatility:28,composite:72},
   motor_votes:{TrendTakip:"LONG",Momentum:"LONG",Hacim:"LONG",Reversal:"NEUTRAL",Breakout:"LONG",Contrarian:"LONG"},
   warnings:[],kalkan_reason:null},
  {symbol:"NVDA",   name:"NVIDIA",    market:"us",    stage:"KALKAN", direction:"LONG", price:215.2, change_24h:3.15,
   ai_hint:"Sinyal var ama KALKAN bloke etti. Hacim dogrulamasi zayif, sahte kirilim riski.",
   trigger_level:null,invalidation:null,take_profit:null,
   scores:{opportunity:72,risk:68,confidence:38,trend:74,liquidity:42,volatility:78,composite:32},
   motor_votes:{TrendTakip:"LONG",Momentum:"LONG",Hacim:"SHORT",Reversal:"NEUTRAL",Breakout:"IZLE",Contrarian:"NEUTRAL"},
   warnings:["Hacim dogrulamasi zayif","Spread yuksek"],
   kalkan_reason:"Risk/ödül oranı kabul edilemez — sahte kırılım riski yüksek."},
];

export default function SignalsPage() {
  const [filter, setFilter] = useState<"all"|"TRIGGER"|"SETUP"|"WATCH"|"KALKAN">("all");
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo|null>(null);
  const prices = usePrices();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "tr";
  const [demoTrade, setDemoTrade] = useState<{symbol:string;name:string}|null>(null);
  const getLive = (sym:string): number|undefined => {
    const p = prices[sym] ?? prices[sym+"USDT"] ?? prices[sym.replace("/","").toUpperCase()];
    return p?.price;
  };

  const {data, isLoading, refetch, isFetching} = useQuery({
    queryKey:["signals-live", filter],
    queryFn:()=>api.get(`/signals/live?market=all&limit=15`).then(r=>r.data).catch(()=>({signals:MOCK_SIGNALS,stage_counts:{TRIGGER:1,SETUP:1,WATCH:1,KALKAN:1,NONE:0}})),
    refetchInterval:60000,
  });

  const normalized = useMemo(() => normalizeSignalsPayload(data, MOCK_SIGNALS), [data]);
  const allSigs = normalized.signals;
  const activeSignals = useMemo(() => allSigs.filter((signal) => signal.stage !== "NONE"), [allSigs]);
  const counts = normalized.stageCounts;
  const filtered = filter==="all" ? activeSignals : allSigs.filter((s)=>s.stage===filter);
  const isLiveFeed = normalized.isLiveFeed;
  const updatedAtLabel = new Date(normalized.updatedAt).toLocaleString(lang === "en" ? "en-US" : "tr-TR");

  return (
    <div style={{maxWidth:1200,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Zap size={18} color="var(--gold)"/>
            <h1 style={{fontFamily:"var(--font-head)",fontSize:20,fontWeight:800,color:"var(--t1)",margin:0}}>
              {lang === "en" ? "Signal Intelligence" : "Sinyal İstihbaratı"}
            </h1>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                borderRadius: 4,
                padding: "3px 8px",
                background: isLiveFeed ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                color: isLiveFeed ? "var(--up)" : "var(--gold)",
                border: `1px solid ${isLiveFeed ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.35)"}`,
              }}
            >
              {isLiveFeed ? (lang === "en" ? "LIVE FEED" : "CANLI AKIŞ") : (lang === "en" ? "DEMO FEED" : "DEMO AKIŞ")}
            </span>
          </div>
          <p style={{fontSize:12,color:"var(--t3)",margin:"4px 0 0",paddingLeft:28}}>
            {lang === "en"
              ? "4-stage early warning + 7 scores + KALKAN risk filter"
              : "4 aşamalı erken uyarı + 7 skor + KALKAN risk filtreleme"}
          </p>
          <p style={{fontSize:11,color:"var(--t4)",margin:"3px 0 0",paddingLeft:28}}>
            {lang === "en" ? "Updated:" : "Güncellendi:"} {updatedAtLabel} · {normalized.source}
          </p>
        </div>
        <button onClick={()=>refetch()} className="btn-ghost" style={{gap:6,display:"flex",alignItems:"center"}}>
          <RefreshCw size={12} style={{animation:isFetching?"spin 1s linear infinite":"none"}}/> {lang === "en" ? "Refresh" : "Güncelle"}
        </button>
      </div>

      {/* STAGE FILTER */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>setFilter("all")} style={{
          padding:"6px 14px",borderRadius:"var(--r-md)",border:"1px solid var(--b1)",
          background:filter==="all"?"var(--bg-hover)":"transparent",
          color:filter==="all"?"var(--t1)":"var(--t3)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"
        }}>{lang === "en" ? "All" : "Tümü"} ({activeSignals.length})</button>
        {(["TRIGGER","SETUP","WATCH","KALKAN"] as const).map(s=>{
          const m = STAGE_META[s];
          const cnt = counts[s]||0;
          return (
            <button key={s} onClick={()=>setFilter(s)} style={{
              padding:"6px 14px",borderRadius:"var(--r-md)",
              border:`1px solid ${filter===s?m.border:"var(--b1)"}`,
              background:filter===s?m.dim:"transparent",
              color:filter===s?m.color:"var(--t3)",
              fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",gap:5,transition:"all 0.15s"
            }}>
                <m.Icon size={11}/>{lang === "en" ? m.label.replace("Alarmi", "Alert").replace("Kurulum Oluşuyor", "Setup").replace("İzleme Alarmi", "Watch").replace("Kalkan Bloke", "Kalkan Blocked").replace("Tetik Alarmı", "Trigger Alert") : m.label} {cnt>0 && <span style={{
                background:m.color,color:"var(--bg)",borderRadius:"50%",
                width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:8,fontWeight:800
              }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* CARDS GRID */}
      {isLoading ? (
        <div className="signal-grid">
          {[...Array(6)].map((_,i)=><div key={i} className="skeleton" style={{height:320,borderRadius:"var(--r-xl)"}}/>)}
        </div>
      ) : (
        <div className="signal-grid">
          {filtered.map((sig:any)=>(
            <SignalCard key={sig.symbol} sig={sig} livePrice={getLive(sig.symbol)} onDemo={()=>setDemoTrade({symbol:sig.symbol.replace("USDT",""),name:sig.name||sig.symbol})} onDetail={()=>setSelectedAsset({
              symbol:sig.symbol,name:sig.name,display:sig.symbol,
              price:getLive(sig.symbol)??sig.price??0,chg:sig.change_24h??0,market:sig.market,
            })}/>
          ))}
        </div>
      )}

      {selectedAsset && <AssetDetailModal asset={selectedAsset} onClose={()=>setSelectedAsset(null)}/>}
      {demoTrade && (
        <AITradeModal
          symbol={demoTrade.symbol}
          name={demoTrade.name}
          onClose={() => setDemoTrade(null)}
        />
      )}

      {/* ARCHITECTURE LEGEND */}
      <div style={{
        background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:20,
        display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,
      }}>
        <div style={{gridColumn:"1/-1",fontFamily:"var(--font-head)",fontSize:12,fontWeight:700,color:"var(--t2)",marginBottom:4}}>
          {lang === "en" ? "Signal Intelligence Architecture" : "Sinyal İstihbaratı Mimarisi"}
        </div>
        {[
          {stage:"TRIGGER",desc:"4+ motor LONG, hacim destekli kapanisteyidi, KALKAN onayi"},
          {stage:"SETUP",  desc:"3+ motor pozitif, tetik bekleniyor, kurulum olusuyor"},
          {stage:"WATCH",  desc:"2+ motor anomali, hareket baslangici, izleme modu"},
          {stage:"KALKAN", desc:"Sahte kirilim, dusuk likidite veya risk/odül bozulmus"},
        ].map(({stage,desc})=>{
          const m = STAGE_META[stage as Stage];
          return (
            <div key={stage} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <m.Icon size={12} color={m.color} style={{flexShrink:0,marginTop:2}}/>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:m.color,marginBottom:2}}>{m.label}</div>
                <div style={{fontSize:10,color:"var(--t4)",lineHeight:1.4}}>{desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
