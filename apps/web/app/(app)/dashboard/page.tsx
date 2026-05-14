"use client";



import { NewsWidget } from "@/components/ui/NewsWidget";



import { useState, useEffect, useMemo } from "react";



import { useQuery } from "@tanstack/react-query";



import { api } from "@/lib/api";



import { AssetDetailModal, type AssetInfo } from "@/components/ui/AssetDetailModal";



import { usePrices } from "@/lib/prices/PriceContext";

import { DemoBanner } from "@/components/ui/DemoBanner";



import {



  TrendingUp, TrendingDown, Zap, Brain, Bell, Shield,



  Activity, ArrowUpRight, ArrowDownRight, RefreshCw,



  ChevronRight, AlertTriangle, Globe, Eye,



  Crosshair, Target, BookOpen, Cpu



} from "lucide-react";















// ---



type Dir = "LONG"|"SHORT"|"NEUTRAL";



type Signal = {



  id:string; symbol:string; name:string; direction:Dir; confidence:number;



  price:number; change_24h:number; market:string; reason:string; age:string;



  stage?:string; scores?:any; motor_votes?:any;



};



type Mover = { sym:string; name:string; price:number; chg:number; cat:string };



type CausalCard = { symbol:string; primary_cause:string; primary_conf:number; narrative:string; manipulation_risk:number; has_meaningful_move?: boolean };



type AlarmItem = {
  id?: string;
  time:string;
  symbol:string;
  msg:string;
  type:"warn"|"info"|"danger";
  createdAt?: string;
  source?: string;
  isLive?: boolean;
  isDemo?: boolean;
};







// ---



const MOCK_SIGNALS: Signal[] = [



  {id:"s1",symbol:"BTCUSDT",name:"Bitcoin",   direction:"LONG",  confidence:88,price:81000, change_24h:1.82,market:"crypto",  reason:"Hacim patlaması + momentum kırılımı. 5/6 motor LONG.",  age:"2dk"},



  {id:"s2",symbol:"XAUUSD", name:"Altın",     direction:"LONG",  confidence:79,price:4700,  change_24h:0.28,market:"precious",reason:"Fed belirsizliği + güvenli liman talebi. RSI 58.",        age:"8dk"},



  {id:"s3",symbol:"NVDA",   name:"NVIDIA",    direction:"LONG",  confidence:83,price:220,  change_24h:3.15,market:"us",      reason:"Kurumsal birikim + AI chip döngüsü. Bollinger kırılımı.", age:"15dk"},



  {id:"s4",symbol:"ETHUSDT",name:"Ethereum",  direction:"LONG",  confidence:72,price:2500,  change_24h:2.41,market:"crypto",  reason:"DeFi büyümesi + L2 aktivite artışı.",                   age:"22dk"},



  {id:"s5",symbol:"TSLA",   name:"Tesla",     direction:"SHORT", confidence:76,price:445,  change_24h:-2.84,market:"us",     reason:"Direnç kırılamadı + zayıf momentum + hacim düşüşü.",    age:"35dk"},



  {id:"s6",symbol:"THYAO",  name:"THY",       direction:"LONG",  confidence:71,price:290, change_24h:1.20,market:"turkey", reason:"Turizm sezonu + teknik destek bölgesi.",                 age:"51dk"},



];







const MOVER_SEEDS: Array<Pick<Mover, "sym" | "name" | "cat">> = [
  { sym:"BTC",   name:"Bitcoin",  cat:"Kripto" },
  { sym:"ETH",   name:"Ethereum", cat:"Kripto" },
  { sym:"SOL",   name:"Solana",   cat:"Kripto" },
  { sym:"XAUUSD",name:"Altın",    cat:"Emtia"  },
  { sym:"USDTRY",name:"Dolar/TL", cat:"Forex"  },
  { sym:"AAPL",  name:"Apple",    cat:"ABD"    },
  { sym:"NVDA",  name:"NVIDIA",   cat:"ABD"    },
  { sym:"TSLA",  name:"Tesla",    cat:"ABD"    },
  { sym:"THYAO", name:"THYAO",    cat:"BIST"   },
  { sym:"XU100", name:"BIST 100", cat:"Endeks" },
];







const MOCK_CAUSAL: CausalCard = {



  symbol:"BTCUSDT",



  primary_cause:"VOLUME_ANOMALY",



  primary_conf:78,



  narrative:"Bitcoin'deki %1.82 günlük yükseliş hareketinin birincil nedeni **hacim anomalisi** (YÜKSEK güven, %78). 5.2x ortalama hacim -> kurumsal alım isareti. Teknik kirilim (68/100) ikincil faktör olarak destekliyor. Manipülasyon riski düşük.",



  manipulation_risk:12,



};







const EMPTY_ALARM_HINT: AlarmItem = {
  id: "empty",
  time: "şimdi",
  symbol: "SİSTEM",
  msg: "Henüz alarm bulunmuyor. Alarm kurduğunuzda burada canlı olarak görünecek.",
  type: "info",
  isLive: false,
  isDemo: true,
};







const CAUSE_LABELS: Record<string,string> = {
  TECHNICAL_BREAKOUT:"Teknik kırılım",
  VOLUME_SPIKE:"Hacim artışı",
  VOLUME_ANOMALY:"Hacim artışı",
  MOMENTUM_SURGE:"Momentum artışı",
  NEWS_IMPACT:"Haber etkisi",
  NEWS_CATALYST:"Haber etkisi",
  MACRO_CATALYST:"Makro etki",
  LIQUIDITY_EVENT:"Düşük likidite",
  LOW_LIQUIDITY:"Düşük likidite",
  MANIPULATION_SIGNAL:"Manipülasyon riski",
  MANIPULATION_RISK:"Manipülasyon riski",
  ORGANIC_TREND:"Organik trend",
  UNKNOWN:"Belirsiz",



};







const STAGE_COLOR: Record<string,string> = {



  TRIGGER:"var(--up)", SETUP:"var(--gold)", WATCH:"var(--info)", KALKAN:"var(--down)", NONE:"var(--t4)"



};

function relativeTimeFromIso(iso?: string): string {
  if (!iso) return "şimdi";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "şimdi";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s önce`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}sa önce`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}g önce`;
}

function pulseLabel(score: number): string {
  if (score <= 24) return "Aşırı Korku";
  if (score <= 44) return "Korku";
  if (score <= 55) return "Nötr";
  if (score <= 74) return "Açgözlülük";
  return "Aşırı Açgözlülük";
}

function computeMarketPulse(signals: Signal[], movers: Mover[]) {
  const validMovers = movers.filter((m) => Number.isFinite(m.chg));
  const avgChange = validMovers.length
    ? validMovers.reduce((sum, m) => sum + m.chg, 0) / validMovers.length
    : 0;
  const volatility = validMovers.length
    ? validMovers.reduce((sum, m) => sum + Math.abs(m.chg), 0) / validMovers.length
    : 0;
  const longRatio = signals.length
    ? signals.filter((s) => s.direction === "LONG").length / signals.length
    : 0.5;
  const advanceCount = validMovers.filter((m) => m.chg > 0).length;
  const declineCount = validMovers.filter((m) => m.chg < 0).length;
  const breadth = validMovers.length
    ? (advanceCount - declineCount) / validMovers.length
    : 0;

  let score = 50 + avgChange * 3.8 + (longRatio - 0.5) * 30 + breadth * 12 - Math.max(0, volatility - 4) * 2.2;
  score = Math.round(Math.max(0, Math.min(100, score)));

  return {
    score,
    label: pulseLabel(score),
    advanceCount,
    declineCount,
    volatility,
    avgChange,
  };
}







// ---



function StatBadge({icon:Icon,label,value,sub,color="var(--t1)"}:{icon:any;label:string;value:string;sub?:string;color?:string}) {



  return (



    <div
      style={{
        background:"var(--bg-card)",
        border:"1px solid var(--b1)",
        borderRadius:"var(--r-xl)",
        padding:"14px 18px",
        flex:"1 1 180px",
        minWidth:180,
      }}
    >



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



    : {bg:"rgba(148,163,184,0.1)",border:"var(--b1)",color:"var(--t3)",text:"NÖTR"};



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



          <div style={{fontSize:10,color:"var(--t3)",textAlign:"center"}}>GÜVEN</div>



        </div>



      </div>



      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>



        <span style={{fontSize:10,color:"var(--t3)"}}>{sig.age} önce</span>



        <span style={{fontSize:10,color:"var(--t2)",display:"flex",alignItems:"center",gap:3}}>



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
  const mappedCause = CAUSE_LABELS[data.primary_cause] || "Belirsiz";
  const hasMeaningfulMove = data.has_meaningful_move ?? !/%0\.00/.test(data.narrative || "");
  const causeLabel = hasMeaningfulMove ? mappedCause : "Veri yetersiz";
  const normalizedNarrative = (data.narrative || "")
    .replace(/\*\*/g, "")
    .replace(/ORGANIC_TREND|VOLUME_ANOMALY|VOLUME_SPIKE|MANIPULATION_SIGNAL|MANIPULATION_RISK|NEWS_IMPACT|TECHNICAL_BREAKOUT|LOW_LIQUIDITY/g, (token) => CAUSE_LABELS[token] || token);
  const narrative = hasMeaningfulMove
    ? normalizedNarrative
    : "Bu varlık için anlamlı hareket verisi henüz oluşmadı.";

  const showRisk = hasMeaningfulMove && data.manipulation_risk > 0;
  const riskLabel = showRisk ? `${data.manipulation_risk}%` : "Veri yetersiz";

  return (
    <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <BookOpen size={14} color="var(--gold)"/>
        <span style={{fontFamily:"var(--font-head)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>
          Neden Bu Hareket? {data.symbol}
        </span>
        <span style={{marginLeft:"auto",fontSize:9,fontWeight:800,letterSpacing:"0.06em",
          color:"var(--gold)",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)",
          padding:"2px 8px",borderRadius:4}}>
          {causeLabel}
        </span>
      </div>

      <p style={{fontSize:12,color:"var(--t2)",lineHeight:1.6,marginBottom:14}}>
        {narrative}
      </p>

      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:10,color:"var(--t4)",fontWeight:700}}>MANİPÜLASYON RİSKİ</span>
        <div style={{flex:1,height:4,background:"var(--b1)",borderRadius:2,overflow:"hidden"}}>
          <div style={{width: showRisk ? `${data.manipulation_risk}%` : "0%",height:"100%",
            background:data.manipulation_risk>55?"var(--down)":data.manipulation_risk>30?"var(--gold)":"var(--up)",
            borderRadius:2}}/>
        </div>
        <span style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:700,
          color:showRisk ? (data.manipulation_risk>55?"var(--down)":data.manipulation_risk>30?"var(--gold)":"var(--up)") : "var(--t4)"}}>
          {riskLabel}
        </span>
      </div>
    </div>
  );
}







// ---



export default function DashboardPage() {



  const [selectedAsset, setSelectedAsset] = useState<AssetInfo|null>(null);



  const [tick, setTick] = useState(0);



  const [mounted, setMounted] = useState(false);



  const [currentTime, setCurrentTime] = useState("");
  const [nowTs, setNowTs] = useState(0);
  const [marketPulseUpdatedAt, setMarketPulseUpdatedAt] = useState("—");

  const [showWelcome, setShowWelcome] = useState(false);







  useEffect(()=>{



    setMounted(true);



    const update = () => setCurrentTime(new Date().toLocaleTimeString("tr"));



    update();



    const id = setInterval(update, 1000);



    return ()=>clearInterval(id);



  },[]);

  useEffect(() => {
    const refreshNow = () => setNowTs(Date.now());
    refreshNow();
    const id = setInterval(refreshNow, 15000);
    return () => clearInterval(id);
  }, []);







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

  const { data: alarmData } = useQuery({
    queryKey: ["dashboard-alarms", tick],
    queryFn: () => api.get("/alarms").then((r) => r.data).catch(() => null),
    staleTime: 25000,
  });







// ----------------------------------------



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

  const movers: Mover[] = useMemo(() => {
    const fromSeeds = MOVER_SEEDS.map((m) => {
      const keys = [
        m.sym,
        m.sym.replace("/", ""),
        m.sym + "USDT",
        m.sym.replace("USDT", ""),
      ].map((k) => k.toUpperCase());
      for (const key of keys) {
        const lp = livePrices[key];
        if (lp && lp.price > 0) return { ...m, price: lp.price, chg: lp.chg };
      }
      return { ...m, price: 0, chg: 0 };
    }).filter((m) => m.price > 0);

    const fromSignals = signals
      .filter((s) => Number.isFinite(s.price) && s.price > 0)
      .map((s) => ({
        sym: s.symbol.toUpperCase(),
        name: s.name,
        price: s.price,
        chg: Number.isFinite(s.change_24h) ? s.change_24h : 0,
        cat: s.market || "Piyasa",
      }));

    const merged = [...fromSeeds, ...fromSignals];
    const unique = new Map<string, Mover>();
    for (const item of merged) {
      const key = item.sym.toUpperCase();
      if (!unique.has(key) || Math.abs(item.chg) > Math.abs(unique.get(key)!.chg)) {
        unique.set(key, item);
      }
    }
    return Array.from(unique.values())
      .sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg))
      .slice(0, 8);
  }, [livePrices, signals]);

  const alarms: AlarmItem[] = useMemo(() => {
    const raw = Array.isArray(alarmData?.alarms) ? alarmData.alarms : [];
    const normalized = raw
      .map((item: any, index: number) => {
        const createdAt = typeof item?.created_at === "string" ? item.created_at : undefined;
        const symbol = String(item?.condition?.symbol || item?.symbol || "—").toUpperCase();
        const alarmType = String(item?.alarm_type || "alarm").toLowerCase();
        const conditionMsg =
          item?.condition?.operator && item?.condition?.value
            ? `${symbol} ${item.condition.operator} ${item.condition.value}`
            : "";
        const message = String(item?.message || item?.condition?.message || conditionMsg || "Yeni alarm bildirimi");
        const type: AlarmItem["type"] =
          alarmType.includes("risk") || alarmType.includes("danger")
            ? "danger"
            : alarmType.includes("warn")
              ? "warn"
              : "info";
        return {
          id: String(item?.id || `${symbol}-${createdAt || index}`),
          time: relativeTimeFromIso(createdAt),
          symbol,
          msg: message,
          type,
          createdAt,
          source: "api",
          isLive: true,
          isDemo: false,
        } as AlarmItem;
      })
      .sort((a: AlarmItem, b: AlarmItem) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    return normalized.length ? normalized.slice(0, 5) : [EMPTY_ALARM_HINT];
  }, [alarmData]);

  const marketPulse = useMemo(() => computeMarketPulse(signals, movers), [signals, movers]);

  useEffect(() => {
    if (!mounted) return;
    setMarketPulseUpdatedAt(
      new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    );
  }, [marketPulse.score, marketPulse.advanceCount, marketPulse.declineCount, mounted]);







  // Stats



  const longCount = signals.filter(s=>s.direction==="LONG").length;
  const priceEntries = Object.values(livePrices);
  const freshPriceCount = priceEntries.filter((entry) => nowTs > 0 && nowTs - entry.ts < 45000).length;
  const dataStatus = freshPriceCount >= 8
    ? "Canlı"
    : freshPriceCount > 0
      ? "Canlı/Gecikmeli karışık"
      : "Veri sınırlı";







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



              Gerçek zamanlı piyasa istihbarat merkezi



            </p>



          </div>



        </div>



        <div style={{display:"flex",alignItems:"center",gap:10}}>



          <div style={{display:"flex",alignItems:"center",gap:6,



            background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",



            borderRadius:"var(--r-md)",padding:"5px 12px"}}>



            <div style={{width:6,height:6,borderRadius:"50%",background:"var(--up)",



              boxShadow:"0 0 6px var(--up)",animation:"pulse 2s ease-in-out infinite"}}/>



            <span style={{fontSize:10,fontWeight:700,color:"var(--up)"}}>3 AI MOTOR AKTİF</span>



          </div>



          <button onClick={()=>refetch()} style={{



            display:"flex",alignItems:"center",gap:5,padding:"6px 12px",



            background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-md)",



            color:"var(--t3)",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,



          }}>



            <RefreshCw size={11} style={{animation:isFetching?"spin 1s linear infinite":"none"}}/>



            Güncelle



          </button>



        </div>



      </div>







      {/* DEMO BANNER */}

<DemoBanner />



{/* STATS BAR */}



      <div className="stat-scroll dashboard-top-stats">



        <StatBadge icon={Zap}      label="Aktif Sinyaller" value={`${signals.length}`}



          sub={`${longCount} LONG \u00b7 ${signals.length-longCount} SHORT/NÖTR`}



          color="var(--info)"/>



        <StatBadge icon={Shield}   label="KALKAN" value="AKTİF"



          sub="4 risk filtresi çalışıyor" color="var(--up)"/>



        <StatBadge icon={Globe}    label="Piyasa Kapsamı" value="8 Kategori"



          sub="Kripto   Hisse   Emtia   Forex" color="var(--t1)"/>



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



                  price:livePrices[sig.symbol]?.price||livePrices[sig.symbol+"USDT"]?.price||sig.price||0, chg:livePrices[sig.symbol]?.chg||livePrices[sig.symbol+"USDT"]?.chg||sig.change_24h||0, market:sig.market||"",



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
              <span style={{fontFamily:"var(--font-head)",fontSize:12,fontWeight:700,color:"var(--t1)"}}>Market Nabzı</span>
            </div>

            <div style={{textAlign:"center",marginBottom:10}}>
              <div style={{fontFamily:"var(--font-mono)",fontSize:32,fontWeight:800,color:"var(--gold)"}}>{marketPulse.score}</div>
              <div style={{fontSize:10,fontWeight:700,color:"var(--gold)",letterSpacing:"0.04em"}}>{marketPulse.label.toUpperCase()}</div>
            </div>

            <div style={{height:6,background:"linear-gradient(to right,var(--down),var(--gold),var(--up))",borderRadius:3,position:"relative",marginBottom:8}}>
              <div style={{position:"absolute",top:-2,left:`${marketPulse.score}%`,transform:"translateX(-50%)",
                width:10,height:10,borderRadius:"50%",background:"white",border:"2px solid var(--gold)"}}/>
            </div>

            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t3)"}}>
              <span>Korku</span><span>Nötr</span><span>Açgözlülük</span>
            </div>
            <div style={{marginTop:8,fontSize:10,color:"var(--t3)",display:"flex",justifyContent:"space-between"}}>
              <span>Yükselen: {marketPulse.advanceCount}</span>
              <span>Düşen: {marketPulse.declineCount}</span>
            </div>
            <div style={{marginTop:6,fontSize:10,color:"var(--t3)",display:"flex",justifyContent:"space-between"}}>
              <span>Veri: {dataStatus}</span>
              <span>Güncellendi: {marketPulseUpdatedAt}</span>
            </div>
          </div>







          {/* Kalkan Guard */}



          <div style={{background:"var(--bg-card)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:"var(--r-xl)",padding:16}}>



            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>



              <Shield size={12} color="var(--up)"/>



              <span style={{fontFamily:"var(--font-head)",fontSize:12,fontWeight:700,color:"var(--t1)"}}>KALKAN Guard</span>



              <span style={{marginLeft:"auto",fontSize:9,fontWeight:800,color:"var(--up)",



                background:"rgba(16,185,129,0.1)",padding:"2px 6px",borderRadius:4}}>AKTİF</span>



            </div>



            {[



              {label:"Sahte Kırılım Filtresi",  active:true},



              {label:"Geç Giriş Filtresi",       active:true},



              {label:"Risk/Ödül Filtresi",        active:true},



              {label:"FOMO Kilidi",               active:true},



              {label:"İntikam İşlemi Kilidi",     active:true},



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



              <span style={{fontFamily:"var(--font-head)",fontSize:12,fontWeight:700,color:"var(--t1)"}}>En Çok Hareket</span>



            </div>



            {movers.map(m=>(



              <div key={m.sym} onClick={()=>setSelectedAsset({symbol:m.sym,name:m.name,display:m.sym,price:livePrices[m.sym]?.price||livePrices[m.sym+"USDT"]?.price||m.price,chg:livePrices[m.sym]?.chg||livePrices[m.sym+"USDT"]?.chg||m.chg,market:""})}



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



            {alarms.map((a)=>(



              <div key={a.id || `${a.symbol}-${a.time}`} style={{padding:"6px 0",borderBottom:"1px solid var(--b1)"}}>



                <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>



                  <AlertTriangle size={9} color={a.type==="danger"?"var(--down)":a.type==="warn"?"var(--gold)":"var(--info)"} style={{marginTop:2,flexShrink:0}}/>



                  <div>



                    <div style={{fontSize:9,color:"var(--t3)",marginBottom:1,display:"flex",gap:6,alignItems:"center"}}>
                      <span>{a.time}</span>
                      <span>{a.symbol}</span>
                      <span style={{
                        fontSize:8,
                        padding:"1px 4px",
                        borderRadius:4,
                        border:"1px solid var(--b1)",
                        color:a.isLive ? "var(--up)" : "var(--t4)",
                      }}>
                        {a.isLive ? "Canlı" : "Demo"}
                      </span>
                    </div>



                    <div style={{fontSize:10,color:"var(--t2)",lineHeight:1.4}}>{a.msg}</div>



                  </div>



                </div>



              </div>



            ))}



          </div>







        </div>



      </div>







            {/* --- */}



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

	              maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 12px)",

	              overflowY: "auto",

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

            }}>AI</div>

            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--t1)", marginBottom: 8 }}>

              AYC Global Market&apos;e Hoş Geldiniz!

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

              Demo hesabınız hazır. İstediğiniz varlığı seçin, yapay zeka size analiz

              sunacak ve sanal para ile hemen işlem yapabilirsiniz.

            </div>

            <div className="dash-stats-grid" style={{ marginBottom: 24 }}>

              {[

                { step: "1", label: "Sinyaller", sub: "AI sinyal seç" },

	                { step: "2", label: "Demo İşlem", sub: "Güvenle dene" },

                { step: "3", label: "Portföy", sub: "Takip et" },

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

              Hemen İşlem Yapmaya Başla

            </button>

          </div>

        </div>

      )}



      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>



    </div>



  );



}


























