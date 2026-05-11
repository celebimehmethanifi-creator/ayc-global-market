"use client";

import { NewsWidget } from "@/components/ui/NewsWidget";

import { useState, useEffect } from "react";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

import { AssetDetailModal, type AssetInfo } from "@/components/ui/AssetDetailModal";

import { usePrices } from "@/lib/prices/PriceContext";
import { DemoBanner } from "@/components/ui/DemoBanner";

import {

  TrendingUp, TrendingDown, Zap, Brain, Bell, Shield,

  Activity, ArrowUpRight, ArrowDownRight, RefreshCw,

  ChevronRight, AlertTriangle, BarChart3, Globe, Eye,

  Crosshair, Target, BookOpen, Cpu

} from "lucide-react";







// Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬ Types Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬

type Dir = "LONG"|"SHORT"|"NEUTRAL";

type Signal = {

  id:string; symbol:string; name:string; direction:Dir; confidence:number;

  price:number; change_24h:number; market:string; reason:string; age:string;

  stage?:string; scores?:any; motor_votes?:any;

};

type Mover = { sym:string; name:string; price:number; chg:number; cat:string };

type CausalCard = { symbol:string; primary_cause:string; primary_conf:number; narrative:string; manipulation_risk:number };

type AlarmItem = { time:string; symbol:string; msg:string; type:"warn"|"info"|"danger" };



// Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬ Mock data Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬

const MOCK_SIGNALS: Signal[] = [

  {id:"s1",symbol:"BTCUSDT",name:"Bitcoin",   direction:"LONG",  confidence:88,price:88000, change_24h:1.82,market:"crypto",  reason:"Hacim patlamasÄ± + momentum kÄ±rÄ±lÄ±mÄ±. 5/6 motor LONG.",  age:"2dk"},

  {id:"s2",symbol:"XAUUSD", name:"AltÄ±n",     direction:"LONG",  confidence:79,price:3295,  change_24h:0.28,market:"precious",reason:"Fed belirsizliÄŸi + gÃ¼venli liman talebi. RSI 58.",        age:"8dk"},

  {id:"s3",symbol:"NVDA",   name:"NVIDIA",    direction:"LONG",  confidence:83,price:1085,  change_24h:3.15,market:"us",      reason:"Kurumsal birikim + AI chip dÃ¶ngÃ¼sÃ¼. Bollinger kÄ±rÄ±lÄ±m.", age:"15dk"},

  {id:"s4",symbol:"ETHUSDT",name:"Ethereum",  direction:"LONG",  confidence:72,price:2340,  change_24h:2.41,market:"crypto",  reason:"DeFi bÃ¼yÃ¼mesi + L2 aktivite artÄ±ÅŸÄ±.",                   age:"22dk"},

  {id:"s5",symbol:"TSLA",   name:"Tesla",     direction:"SHORT", confidence:76,price:285,  change_24h:-2.84,market:"us",     reason:"DirenÃ§ kÄ±rÄ±lamadÄ± + zayÄ±f momentum + hacim dÃ¼ÅŸÃ¼ÅŸÃ¼.",    age:"35dk"},

  {id:"s6",symbol:"THYAO",  name:"THY",       direction:"LONG",  confidence:71,price:286.5, change_24h:1.20,market:"turkey", reason:"Turizm sezonu + teknik destek bÃ¶lgesi.",                 age:"51dk"},

];



const MOCK_MOVERS: Mover[] = [

  {sym:"SOL", name:"Solana",  price:200,  chg:+4.81, cat:"Kripto"},

  {sym:"NVDA",name:"NVIDIA",  price:1085, chg:+3.15, cat:"ABD"},

  {sym:"BTC", name:"Bitcoin", price:88000, chg:+1.82, cat:"Kripto"},

  {sym:"ETH", name:"Ethereum",price:2340,  chg:+2.41, cat:"Kripto"},

  {sym:"TSLA",name:"Tesla",   price:285,   chg:-2.84, cat:"ABD"},

  {sym:"XAU", name:"AltÄ±n",   price:3295,  chg:+0.28, cat:"Emtia"},

];



const MOCK_CAUSAL: CausalCard = {

  symbol:"BTCUSDT",

  primary_cause:"VOLUME_ANOMALY",

  primary_conf:78,

  narrative:"Bitcoin'deki %1.82 gÃ¼nlÃ¼k yÃ¼kseliÅŸ hareketinin birincil nedeni **hacim anomalisi** (YÃœKSEK gÃ¼ven, %78). 5.2x ortalama hacim â†’ kurumsal alÄ±m iÅŸareti. Teknik kÄ±rÄ±lÄ±m (68/100) ikincil faktÃ¶r olarak destekliyor. ManipÃ¼lasyon riski dÃ¼ÅŸÃ¼k.",

  manipulation_risk:12,

};



const MOCK_ALARMS: AlarmItem[] = [

  {time:"02:14",symbol:"BTCUSDT",msg:"SETUP: Kurulum oluÅŸtu, tetik $81,319 bekleniyor",type:"info"},

  {time:"01:58",symbol:"XAUUSD", msg:"TRIGGER: 5/6 motor LONG. Tetik $3,308 onaylandÄ±",type:"warn"},

  {time:"01:32",symbol:"NVDA",   msg:"KALKAN: Sahte kÄ±rÄ±lÄ±m riski â†’ bloke edildi",      type:"danger"},

];



const CAUSE_LABELS: Record<string,string> = {

  TECHNICAL_BREAKOUT:"Teknik KÄ±rÄ±lÄ±m",

  VOLUME_ANOMALY:"Hacim Anomalisi",

  NEWS_CATALYST:"Haber KatalizÃ¶rÃ¼",

  MACRO_CATALYST:"Makro Olay",

  LIQUIDITY_EVENT:"Likidite DeÄŸiÅŸimi",

  MANIPULATION_SIGNAL:"ManipÃ¼lasyon",

  ORGANIC_TREND:"Organik Trend",

  UNKNOWN:"Belirsiz",

};



const STAGE_COLOR: Record<string,string> = {

  TRIGGER:"var(--up)", SETUP:"var(--gold)", WATCH:"var(--info)", KALKAN:"var(--down)", NONE:"var(--t4)"

};



// Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬ Mini components Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬

function StatBadge({icon:Icon,label,value,sub,color="var(--t1)"}:{icon:any;label:string;value:string;sub?:string;color?:string}) {

  return (

    <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:"14px 18px",flex:1,minWidth:0}}>

      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>

        <Icon size={12} color="var(--t4)"/>

        <span style={{fontSize:10,color:"var(--t4)",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>

      </div>

      <div style={{fontFamily:"var(--font-mono)",fontSize:18,fontWeight:800,color,lineHeight:1}}>{value}</div>

      {sub && <div style={{fontSize:10,color:"var(--t3)",marginTop:4}}>{sub}</div>}

    </div>

  );

}



function DirBadge({d}:{d:Dir}) {

  const cfg = d==="LONG"

    ? {bg:"rgba(16,185,129,0.12)",border:"rgba(16,185,129,0.3)",color:"var(--up)",text:"LONG \u25b2"}

    : d==="SHORT"

    ? {bg:"rgba(239,68,68,0.12)", border:"rgba(239,68,68,0.3)", color:"var(--down)",text:"SHORT \u25bc"}

    : {bg:"rgba(148,163,184,0.1)",border:"var(--b1)",color:"var(--t3)",text:"NÃ–TR"};

  return (

    <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.08em",padding:"2px 7px",

      borderRadius:4,background:cfg.bg,border:`1px solid ${cfg.border}`,color:cfg.color}}>

      {cfg.text}

    </span>

  );

}



function SignalCard({sig,onDetail}:{sig:Signal;onDetail:()=>void}) {

  const safeChg = (v: any) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const chg24 = safeChg(sig.change_24h);
  const up = chg24 >= 0;

  const stageColor = STAGE_COLOR[sig.stage||"NONE"] || "var(--t4)";

  return (

    <div onClick={onDetail} style={{

      background:"var(--bg-card)",border:"1px solid var(--b1)",

      borderTop:`2px solid ${stageColor}`,

      borderRadius:"var(--r-xl)",padding:"14px 16px",cursor:"pointer",

      transition:"all 0.15s",position:"relative",

    }}

    onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="var(--b1)";(e.currentTarget as HTMLDivElement).style.transform="translateY(-1px)"}}

    onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform="translateY(0)"}}>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>

        <div>

          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>

            <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:800,color:"var(--t1)"}}>{sig.symbol}</span>

            <DirBadge d={sig.direction}/>

          </div>

          <div style={{fontSize:10,color:"var(--t3)"}}>{sig.name}</div>

        </div>

        <div style={{textAlign:"right"}}>

          <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>

            ${sig.price.toLocaleString("en-US",{maximumFractionDigits:2})}

          </div>

          <div style={{fontSize:10,fontWeight:700,color:up?"var(--up)":"var(--down)",display:"flex",alignItems:"center",gap:2,justifyContent:"flex-end"}}>

            {up?<ArrowUpRight size={9}/>:<ArrowDownRight size={9}/>}

            {up?"+":""}{chg24.toFixed(2)}%

          </div>

        </div>

      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>

        <div style={{fontSize:10,color:"var(--t2)",flex:1,lineHeight:1.4,paddingRight:8}}>

          {sig.reason.substring(0,70)}{sig.reason.length>70?"\u2026":""}

        </div>

        <div style={{textAlign:"right",flexShrink:0}}>

          <div style={{fontFamily:"var(--font-mono)",fontSize:16,fontWeight:800,

            color:sig.confidence>=75?"var(--up)":sig.confidence>=55?"var(--gold)":"var(--down)"}}>

            {sig.confidence}

          </div>

          <div style={{fontSize:8,color:"var(--t4)",textAlign:"center"}}>GÃœVEN</div>

        </div>

      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>

        <span style={{fontSize:9,color:"var(--t4)"}}>{sig.age} Ã¶nce</span>

        <span style={{fontSize:9,color:"var(--t3)",display:"flex",alignItems:"center",gap:3}}>

          Derin Analiz <ChevronRight size={9}/>

        </span>

      </div>

      {/* Confidence bar */}

      <div style={{position:"absolute",bottom:0,left:0,height:2,borderRadius:"0 0 0 var(--r-xl)",

        width:`${sig.confidence}%`,

        background:sig.confidence>=75?"var(--up)":sig.confidence>=55?"var(--gold)":"var(--down)"}

      }/>

    </div>

  );

}



function CausalSection({data}:{data:CausalCard}) {

  const causeLabel = CAUSE_LABELS[data.primary_cause] || data.primary_cause;

  return (

    <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:20}}>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>

        <BookOpen size={14} color="var(--gold)"/>

        <span style={{fontFamily:"var(--font-head)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>

          Neden Bu Hareket? â€¢ {data.symbol}

        </span>

        <span style={{marginLeft:"auto",fontSize:9,fontWeight:800,letterSpacing:"0.06em",

          color:"var(--gold)",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)",

          padding:"2px 8px",borderRadius:4}}>

          {causeLabel.toUpperCase()}

        </span>

      </div>

      <p style={{fontSize:12,color:"var(--t2)",lineHeight:1.6,marginBottom:14}}>

        {data.narrative.replace(/\*\*/g,"")}

      </p>

      <div style={{display:"flex",alignItems:"center",gap:10}}>

        <span style={{fontSize:10,color:"var(--t4)",fontWeight:700}}>MANÄ°PÃœLASYON RÄ°SKÄ°</span>

        <div style={{flex:1,height:4,background:"var(--b1)",borderRadius:2,overflow:"hidden"}}>

          <div style={{width:`${data.manipulation_risk}%`,height:"100%",

            background:data.manipulation_risk>55?"var(--down)":data.manipulation_risk>30?"var(--gold)":"var(--up)",

            borderRadius:2}}/>

        </div>

        <span style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:700,

          color:data.manipulation_risk>55?"var(--down)":data.manipulation_risk>30?"var(--gold)":"var(--up)"}}>

          {data.manipulation_risk}%

        </span>

      </div>

    </div>

  );

}



// Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬ Main Component Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬Ã¢ï¿½?â‚¬

export default function DashboardPage() {

  const [selectedAsset, setSelectedAsset] = useState<AssetInfo|null>(null);

  const [tick, setTick] = useState(0);

  const [mounted, setMounted] = useState(false);

  const [currentTime, setCurrentTime] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);



  useEffect(()=>{

    setMounted(true);

    const update = () => setCurrentTime(new Date().toLocaleTimeString("tr"));

    update();

    const id = setInterval(update, 1000);

    return ()=>clearInterval(id);

  },[]);



  // Auto-refresh every 60s

  useEffect(()=>{

    const id = setInterval(()=>setTick(t=>t+1),60000);

    return ()=>clearInterval(id);

  },[]);

  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") === "1" || localStorage.getItem("ayc_show_welcome") === "1") {
      setShowWelcome(true);
      localStorage.removeItem("ayc_show_welcome");
    }
  },[]);



  const {data:signalData, isLoading:sigLoading, refetch, isFetching} = useQuery({

    queryKey:["dashboard-signals",tick],

    queryFn:()=>api.get("/signals/live?market=all&limit=12").then(r=>r.data).catch(()=>null),

    staleTime:55000,

  });



  // Live prices â€” from PriceContext (real-time, no polling needed)

  const livePrices = usePrices();



  const {data:causalData} = useQuery({

    queryKey:["causal-btc"],

    queryFn:()=>api.post("/intelligence/causal",{

      symbol:"BTCUSDT",price:livePrices["BTCUSDT"]?.price||80000,change_24h:(v=>isFinite(Number(v))?Number(v):0)(livePrices["BTCUSDT"]?.chg),volume_ratio:2.1,

      indicators:{rsi:62,macd_hist:0.0012},market:"crypto"

    }).then(r=>r.data).catch(()=>null),

    staleTime:120000,

  });



  // Apply real-time prices from PriceContext

  const signals: Signal[] = (signalData?.signals as Signal[] || MOCK_SIGNALS).map(s => {

    const candidates = [

      s.symbol,

      s.symbol + "USDT",

      s.symbol.replace("USDT",""),

    ];

    for (const key of candidates) {

      const lp = livePrices[key.toUpperCase()];

      if (lp && lp.price > 0) return { ...s, price: lp.price, change_24h: lp.chg };

    }

    return s;

  });

  const causal: CausalCard = causalData || MOCK_CAUSAL;

  // Apply live prices to movers  
  const movers: Mover[] = MOCK_MOVERS.map(m => {
    const keys = [m.sym, m.sym + "USDT", m.sym.replace("USDT",""), "XAU" === m.sym ? "XAUUSD" : m.sym];
    for (const k of keys) {
      const lp = livePrices[k.toUpperCase()];
      if (lp && lp.price > 0) return { ...m, price: lp.price, chg: lp.chg };
    }
    return m;
  });



  // Stats

  const btcSig  = { price: livePrices["BTCUSDT"]?.price  || signals.find(s=>s.symbol==="BTCUSDT")?.price  || 0, change_24h: livePrices["BTCUSDT"]?.chg  || 0 };

  const goldSig = { price: livePrices["XAUUSD"]?.price   || signals.find(s=>s.symbol==="XAUUSD")?.price   || 0, change_24h: livePrices["XAUUSD"]?.chg   || 0 };

  const longCount = signals.filter(s=>s.direction==="LONG").length;



  return (

    <div style={{maxWidth:1400,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>



      {/* HEADER */}

      <div className="dash-header">

        <div style={{display:"flex",alignItems:"center",gap:10}}>

          <Brain size={18} color="var(--gold)"/>

          <div>

            <h1 style={{fontFamily:"var(--font-head)",fontSize:20,fontWeight:800,color:"var(--t1)",margin:0}}>

              AI Market Command Center

            </h1>

            <p style={{fontSize:11,color:"var(--t3)",margin:0}}>

              GerÃ§ek zamanlÄ± piyasa istihbarat merkezi

            </p>

          </div>

        </div>

        <div style={{display:"flex",alignItems:"center",gap:10}}>

          <div style={{display:"flex",alignItems:"center",gap:6,

            background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",

            borderRadius:"var(--r-md)",padding:"5px 12px"}}>

            <div style={{width:6,height:6,borderRadius:"50%",background:"var(--up)",

              boxShadow:"0 0 6px var(--up)",animation:"pulse 2s ease-in-out infinite"}}/>

            <span style={{fontSize:10,fontWeight:700,color:"var(--up)"}}>3 AI MOTOR AKTÄ°F</span>

          </div>

          <button onClick={()=>refetch()} style={{

            display:"flex",alignItems:"center",gap:5,padding:"6px 12px",

            background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-md)",

            color:"var(--t3)",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,

          }}>

            <RefreshCw size={11} style={{animation:isFetching?"spin 1s linear infinite":"none"}}/>

            GÃ¼ncelle

          </button>

        </div>

      </div>



      {/* DEMO BANNER */}
<DemoBanner />

{/* STATS BAR */}

      <div className="stat-scroll">

        <StatBadge icon={Activity} label="BTC/USD" value={`${ (btcSig.price||0).toLocaleString("en-US",{maximumFractionDigits:0}) }`}

          sub={`${(isFinite(Number(btcSig?.change_24h)) ? Number(btcSig.change_24h) : 0)>=0?"+":""}${(isFinite(Number(btcSig?.change_24h)) ? Number(btcSig.change_24h) : 0).toFixed(2)}% 24s`}

          color={(isFinite(Number(btcSig?.change_24h)) ? Number(btcSig.change_24h) : 0)>=0?"var(--up)":"var(--down)"}/>

        <StatBadge icon={BarChart3} label="XAU/USD" value={`${ (goldSig.price||0).toLocaleString("en-US",{maximumFractionDigits:0}) }`}

          sub={`${(goldSig.change_24h??0)>=0?"+":""}${(goldSig.change_24h??0).toFixed(2)}% 24s`}

          color="var(--gold)"/>

        <StatBadge icon={Zap}      label="Aktif Sinyaller" value={`${signals.length}`}

          sub={`${longCount} LONG \u00b7 ${signals.length-longCount} SHORT/NÃ–TR`}

          color="var(--info)"/>

        <StatBadge icon={Shield}   label="KALKAN" value="AKTÄ°F"

          sub="4 risk filtresi Ã§alÄ±ÅŸÄ±yor" color="var(--up)"/>

        <StatBadge icon={Globe}    label="Piyasa KapsamÄ±" value="8 Kategori"

          sub="Kripto Â· Hisse Â· Emtia Â· Forex" color="var(--t1)"/>

      </div>



      {/* MAIN GRID */}

      <div className="dash-two-col">



        {/* LEFT: SIGNALS */}

        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          <div style={{display:"flex",alignItems:"center",gap:8}}>

            <Zap size={14} color="var(--gold)"/>

            <span style={{fontFamily:"var(--font-head)",fontSize:14,fontWeight:700,color:"var(--t1)"}}>

              Aktif Sinyaller

            </span>

            <span style={{marginLeft:"auto",fontSize:10,color:"var(--t3)"}} suppressHydrationWarning>{mounted ? currentTime : ""}</span>

          </div>



          {sigLoading ? (

            <div className="signal-grid">

              {[...Array(6)].map((_,i)=><div key={i} className="skeleton" style={{height:160,borderRadius:"var(--r-xl)"}}/>)}

            </div>

          ) : (

            <div className="signal-grid">

              {signals.slice(0,9).map(sig=>(

                <SignalCard key={sig.id||sig.symbol} sig={sig} onDetail={()=>setSelectedAsset({

                  symbol:sig.symbol, name:sig.name, display:sig.symbol,

                  price:sig.price||0, chg:sig.change_24h||0, market:sig.market||"",

                })}/>

              ))}

            </div>

          )}



          {/* CAUSAL SECTION */}

          <CausalSection data={causal}/>

        </div>



        {/* RIGHT SIDEBAR */}

        <div style={{display:"flex",flexDirection:"column",gap:12}}>



          {/* Market Pulse */}

          <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:16}}>

            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>

              <Activity size={12} color="var(--info)"/>

              <span style={{fontFamily:"var(--font-head)",fontSize:12,fontWeight:700,color:"var(--t1)"}}>Market NabzÄ±</span>

            </div>

            <div style={{textAlign:"center",marginBottom:10}}>

              <div style={{fontFamily:"var(--font-mono)",fontSize:32,fontWeight:800,color:"var(--gold)"}}>62</div>

              <div style={{fontSize:10,fontWeight:700,color:"var(--gold)",letterSpacing:"0.1em"}}>AÃ‡GÃ–ZLÃœLÃœK</div>

            </div>

            <div style={{height:6,background:"linear-gradient(to right,var(--down),var(--gold),var(--up))",borderRadius:3,position:"relative",marginBottom:8}}>

              <div style={{position:"absolute",top:-2,left:"60%",transform:"translateX(-50%)",

                width:10,height:10,borderRadius:"50%",background:"white",border:"2px solid var(--gold)"}}/>

            </div>

            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--t4)"}}>

              <span>Korku</span><span>NÃ¶tr</span><span>AÃ§gÃ¶zlÃ¼lÃ¼k</span>

            </div>

          </div>



          {/* Kalkan Guard */}

          <div style={{background:"var(--bg-card)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:"var(--r-xl)",padding:16}}>

            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>

              <Shield size={12} color="var(--up)"/>

              <span style={{fontFamily:"var(--font-head)",fontSize:12,fontWeight:700,color:"var(--t1)"}}>KALKAN Guard</span>

              <span style={{marginLeft:"auto",fontSize:9,fontWeight:800,color:"var(--up)",

                background:"rgba(16,185,129,0.1)",padding:"2px 6px",borderRadius:4}}>AKTÄ°F</span>

            </div>

            {[

              {label:"Sahte KÄ±rÄ±lÄ±m Filtresi",  active:true},

              {label:"GeÃ§ GiriÅŸ Filtresi",       active:true},

              {label:"Risk/Ã–dÃ¼l Filtresi",        active:true},

              {label:"FOMO Kilidi",               active:true},

              {label:"Ä°ntikam Ä°ÅŸlemi Kilidi",     active:true},

            ].map(({label,active})=>(

              <div key={label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",

                padding:"5px 0",borderBottom:"1px solid var(--b1)"}}>

                <span style={{fontSize:10,color:"var(--t2)"}}>{label}</span>

                <div style={{width:6,height:6,borderRadius:"50%",background:active?"var(--up)":"var(--t4)"}}/>

              </div>

            ))}

          </div>



          {/* Top Movers */}

          <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:16}}>

            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>

              <TrendingUp size={12} color="var(--gold)"/>

              <span style={{fontFamily:"var(--font-head)",fontSize:12,fontWeight:700,color:"var(--t1)"}}>En Ã‡ok Hareket</span>

            </div>

            {movers.map(m=>(

              <div key={m.sym} onClick={()=>setSelectedAsset({symbol:m.sym,name:m.name,display:m.sym,price:m.price,chg:m.chg,market:""})}

                style={{display:"flex",alignItems:"center",justifyContent:"space-between",

                padding:"6px 0",borderBottom:"1px solid var(--b1)",cursor:"pointer"}}>

                <div>

                  <div style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:"var(--t1)"}}>{m.sym}</div>

                  <div style={{fontSize:9,color:"var(--t4)"}}>{m.cat}</div>

                </div>

                <div style={{textAlign:"right"}}>

                  <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t1)"}}>

                    ${m.price.toLocaleString()}

                  </div>

                  <div style={{fontSize:10,fontWeight:700,color:m.chg>=0?"var(--up)":"var(--down)",

                    display:"flex",alignItems:"center",gap:2,justifyContent:"flex-end"}}>

                    {m.chg>=0?<ArrowUpRight size={9}/>:<ArrowDownRight size={9}/>}

                    {m.chg>=0?"+":""}{m.chg.toFixed(2)}%

                  </div>

                </div>

              </div>

            ))}

          </div>



          {/* Alarm Center */}

          <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:16}}>

            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>

              <Bell size={12} color="var(--gold)"/>

              <span style={{fontFamily:"var(--font-head)",fontSize:12,fontWeight:700,color:"var(--t1)"}}>Son Alarmlar</span>

            </div>

            {MOCK_ALARMS.map((a,i)=>(

              <div key={i} style={{padding:"6px 0",borderBottom:"1px solid var(--b1)"}}>

                <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>

                  <AlertTriangle size={9} color={a.type==="danger"?"var(--down)":a.type==="warn"?"var(--gold)":"var(--info)"} style={{marginTop:2,flexShrink:0}}/>

                  <div>

                    <div style={{fontSize:9,color:"var(--t3)",marginBottom:1}}>{a.time} Â· {a.symbol}</div>

                    <div style={{fontSize:10,color:"var(--t2)",lineHeight:1.4}}>{a.msg}</div>

                  </div>

                </div>

              </div>

            ))}

          </div>



        </div>

      </div>



            {/* â”€â”€â”€ Haber AkÄ±ÅŸÄ± â”€â”€â”€ */}

      <div style={{marginTop:16}}>

        <div className="news-grid-responsive"><NewsWidget category="crypto" limit={6} compact={true} />

          <NewsWidget category="bist" limit={6} compact={true} />

          <NewsWidget category="global" limit={6} compact={true} />

        </div>

      </div>



      {selectedAsset && <AssetDetailModal asset={selectedAsset} onClose={()=>setSelectedAsset(null)}/>}

      {showWelcome && (
        <div
          onClick={() => setShowWelcome(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--b2)",
              borderRadius: "20px 20px 0 0",
              padding: "28px 24px",
              width: "100%",
              maxWidth: 480,
              textAlign: "center",
              animation: "slideUp 0.3s ease-out",
              paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 16px)",
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--b2)", margin: "0 auto 20px" }} />
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.3)",
              margin: "0 auto 16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28,
            }}>ğŸ‰</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--t1)", marginBottom: 8 }}>
              AYC Global Market&apos;e HoÅŸ Geldiniz!
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 20px", borderRadius: 10,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.3)",
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 13, color: "var(--t3)" }}>Demo Bakiye</span>
              <span style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--font-mono)", color: "#f59e0b" }}>$10,000</span>
            </div>
            <div style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, marginBottom: 24 }}>
              Demo hesabÄ±nÄ±z hazÄ±r. Ä°stediÄŸiniz varlÄ±ÄŸÄ± seÃ§in, yapay zeka size analiz
              sunacak ve sanal para ile hemen iÅŸlem yapabilirsiniz.
            </div>
            <div className="dash-stats-grid" style={{ marginBottom: 24 }}>
              {[
                { step: "1", label: "Sinyaller", sub: "AI sinyal seÃ§" },
                { step: "2", label: "Demo Ä°ÅŸlem", sub: "GÃ¼venle dene" },
                { step: "3", label: "PortfÃ¶y", sub: "Takip et" },
              ].map(({ step, label, sub }) => (
                <div key={step} style={{
                  background: "var(--bg-hover)", borderRadius: 10, padding: "10px 8px",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--gold)", marginBottom: 4 }}>{step}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)" }}>{label}</div>
                  <div style={{ fontSize: 10, color: "var(--t4)", marginTop: 2 }}>{sub}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowWelcome(false)}
              style={{
                width: "100%", padding: "14px 0",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                border: "none", borderRadius: 12, cursor: "pointer",
                fontWeight: 800, fontSize: 15, color: "#fff",
                boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
              }}
            >
              Hemen Ä°ÅŸlem Yapmaya BaÅŸla
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

    </div>

  );

}












