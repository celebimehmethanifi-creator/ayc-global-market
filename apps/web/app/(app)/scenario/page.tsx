"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Target, AlertTriangle, Zap, RefreshCw, Calculator } from "lucide-react";

type ScenarioOutcome = "WIN_HIGH"|"WIN_MED"|"NEUTRAL"|"LOSS_MED"|"LOSS_HIGH"|"LIQUIDATION";

type ScenarioResult = {
  name: string; description: string; outcome: ScenarioOutcome;
  expected_pnl_pct: number; max_loss_pct: number; probability: number;
  risk_reward: number; kelly_size: number; verdict: string; warning?: string;
};

type SimulationReport = {
  symbol: string; price: number; direction: string;
  recommended: string; key_insight: string;
  scenarios: ScenarioResult[];
};

const OUTCOME_META: Record<ScenarioOutcome, {color:string;bg:string;label:string}> = {
  WIN_HIGH:    {color:"var(--up)",   bg:"rgba(16,185,129,0.1)",  label:"Yuksek Kar"},
  WIN_MED:     {color:"var(--up)",   bg:"rgba(16,185,129,0.07)", label:"Orta Kar"},
  NEUTRAL:     {color:"var(--t3)",   bg:"var(--bg-hover)",       label:"Notr"},
  LOSS_MED:    {color:"var(--down)", bg:"rgba(239,68,68,0.07)",  label:"Orta Kayip"},
  LOSS_HIGH:   {color:"var(--down)", bg:"rgba(239,68,68,0.1)",   label:"Yuksek Kayip"},
  LIQUIDATION: {color:"var(--down)", bg:"rgba(239,68,68,0.15)",  label:"Likidatasyon"},
};

const MOCK: SimulationReport = {
  symbol:"BTCUSDT", price:81250, direction:"LONG",
  recommended:"Tetik Bekle",
  key_insight:"R/R 2.1 ve guven %72 - makul. Tetik onayiyla giriste sahte kirilim riski %40 azalir. Kelly onerir: %9 pozisyon.",
  scenarios:[
    {name:"Simdi Gir",     description:"Market price'dan hemen gir",     outcome:"WIN_MED",   expected_pnl_pct:1.8, max_loss_pct:2.4,  probability:62, risk_reward:1.8,  kelly_size:0.07, verdict:"Kabul edilebilir R/R 1.8. Slippage riski var."},
    {name:"Tetik Bekle",   description:"$81,319 kirilimini bekle",        outcome:"WIN_HIGH",  expected_pnl_pct:2.3, max_loss_pct:1.9,  probability:72, risk_reward:2.1,  kelly_size:0.09, verdict:"En verimli giris. R/R 2.1. Sahte kirilim riski %40 duser."},
    {name:"Stop Koymadan", description:"Stop-loss olmadan ac",            outcome:"LOSS_HIGH", expected_pnl_pct:0.4, max_loss_pct:6.2,  probability:57, risk_reward:0.6,  kelly_size:0.0,  verdict:"CVaR: %6.2. Stop olmadan acik pozisyon.", warning:"KALKAN: Stop koymadan pozisyon acmak risk kurallarini ihlal eder."},
    {name:"3x Kaldirac",   description:"3x kaldiracla ayni pozisyon",     outcome:"LIQUIDATION",expected_pnl_pct:3.8,max_loss_pct:30.0,  probability:47, risk_reward:1.2,  kelly_size:0.0,  verdict:"3x kaldirac - likideasyon %30 mesafede.", warning:"KALKAN AKTIF: Kripto icin 3x yuksek risk. Kelly = 0."},
    {name:"Bekle / Gec",   description:"Simdi hic islem yapma",           outcome:"NEUTRAL",   expected_pnl_pct:0.0, max_loss_pct:0.0,  probability:100,risk_reward:0.0,  kelly_size:0.0,  verdict:"Firsat maliyeti var ama sermaye korunur."},
    {name:"Yari Pozisyon", description:"%50 pozisyon, tetikle tamamla",   outcome:"WIN_MED",   expected_pnl_pct:1.1, max_loss_pct:1.0,  probability:68, risk_reward:2.0,  kelly_size:0.05, verdict:"Konservatif. Kayip %1 siniri, kar potansiyeli korunur."},
  ],
};

function ScenarioCard({s,recommended}:{s:ScenarioResult;recommended:string}) {
  const meta = OUTCOME_META[s.outcome] || OUTCOME_META.NEUTRAL;
  const isRec = s.name === recommended;
  return (
    <div style={{
      background:"var(--bg-card)",
      border:`1px solid ${isRec?"var(--gold)":"var(--b1)"}`,
      borderTop:`3px solid ${meta.color}`,
      borderRadius:"var(--r-xl)",padding:"16px 18px",
      position:"relative",
    }}>
      {isRec && <div style={{position:"absolute",top:10,right:12,fontSize:8,fontWeight:800,letterSpacing:"0.08em",color:"var(--gold)",background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.3)",padding:"2px 8px",borderRadius:4}}>ONERILEN</div>}
      <div style={{marginBottom:10}}>
        <div style={{fontFamily:"var(--font-head)",fontSize:14,fontWeight:800,color:"var(--t1)",marginBottom:3}}>{s.name}</div>
        <div style={{fontSize:11,color:"var(--t3)"}}>{s.description}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:12}}>
        {[
          {label:"Beklenen PnL", value:`${s.expected_pnl_pct>=0?"+":""}${s.expected_pnl_pct}%`, color:s.expected_pnl_pct>=0?"var(--up)":"var(--down)"},
          {label:"Max Kayip",    value:`-${s.max_loss_pct}%`,   color:"var(--down)"},
          {label:"Basari Iht.", value:`${s.probability}%`,     color:s.probability>=65?"var(--up)":s.probability>=45?"var(--gold)":"var(--down)"},
          {label:"Risk/Odul",   value:`${s.risk_reward}x`,     color:s.risk_reward>=2?"var(--up)":s.risk_reward>=1?"var(--gold)":"var(--down)"},
          {label:"Kelly",       value:s.kelly_size>0?`${(s.kelly_size*100).toFixed(0)}%`:"--",color:s.kelly_size>0?"var(--t1)":"var(--t4)"},
          {label:"Sonuc",       value:meta.label,              color:meta.color},
        ].map(({label,value,color})=>(
          <div key={label} style={{background:"var(--bg-hover)",borderRadius:"var(--r-sm)",padding:"8px 10px"}}>
            <div style={{fontSize:8,color:"var(--t4)",fontWeight:700,letterSpacing:"0.06em",marginBottom:3}}>{label.toUpperCase()}</div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:800,color}}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"var(--t2)",lineHeight:1.5,marginBottom:s.warning?10:0}}>{s.verdict}</div>
      {s.warning && (
        <div style={{display:"flex",gap:6,padding:"8px 10px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"var(--r-sm)"}}>
          <AlertTriangle size={10} color="var(--down)" style={{flexShrink:0,marginTop:2}}/>
          <span style={{fontSize:10,color:"var(--down)",lineHeight:1.4}}>{s.warning}</span>
        </div>
      )}
    </div>
  );
}

export default function ScenarioPage() {
  const [form, setForm] = useState({symbol:"BTCUSDT",price:"81250",direction:"LONG",confidence:"72",volatility:"3",leverage:"1"});
  const {data, isFetching, refetch} = useQuery({
    queryKey:["scenario",form.symbol],
    queryFn:()=>api.post("/intelligence/scenario",{
      symbol:form.symbol, price:parseFloat(form.price)||81250,
      direction:form.direction, confidence_score:parseFloat(form.confidence)||60,
      volatility_daily:parseFloat(form.volatility)||3,
      leverage:parseFloat(form.leverage)||1, market:"crypto",
    }).then(r=>r.data).catch(()=>null),
    enabled:false,
  });
  const report: SimulationReport = data || MOCK;

  return (
    <div style={{maxWidth:1200,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Calculator size={18} color="var(--info)"/>
          <div>
            <h1 style={{fontFamily:"var(--font-head)",fontSize:20,fontWeight:800,color:"var(--t1)",margin:0}}>Senaryo Simulatoru</h1>
            <p style={{fontSize:12,color:"var(--t3)",margin:0}}>Kelly Criterion · CVaR · 6 Senaryo Karsilastirmasi</p>
          </div>
        </div>
      </div>

      <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:20}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:16}}>
          {([["symbol","Sembol","BTCUSDT"],["price","Giris Fiyati","81250"],["confidence","Guven %","72"],["volatility","Volatilite %","3.0"],["leverage","Kaldirac","1"]] as const).map(([k,label,ph])=>(
            <div key={k}>
              <div style={{fontSize:10,fontWeight:700,color:"var(--t4)",letterSpacing:"0.06em",marginBottom:6}}>{label.toUpperCase()}</div>
              <input value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph}
                style={{width:"100%",background:"var(--bg-hover)",border:"1px solid var(--b1)",borderRadius:"var(--r-md)",padding:"8px 12px",color:"var(--t1)",fontFamily:"var(--font-mono)",fontSize:12,outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"var(--t4)",letterSpacing:"0.06em",marginBottom:6}}>YON</div>
            <select value={form.direction} onChange={e=>setForm(f=>({...f,direction:e.target.value}))}
              style={{width:"100%",background:"var(--bg-hover)",border:"1px solid var(--b1)",borderRadius:"var(--r-md)",padding:"8px 12px",color:"var(--t1)",fontSize:12,outline:"none",boxSizing:"border-box"}}>
              <option value="LONG">LONG</option><option value="SHORT">SHORT</option>
            </select>
          </div>
        </div>
        <button onClick={()=>refetch()} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",background:"var(--gold)",border:"none",borderRadius:"var(--r-md)",color:"var(--bg)",fontFamily:"inherit",fontSize:12,fontWeight:800,cursor:"pointer"}}>
          <RefreshCw size={12} style={{animation:isFetching?"spin 1s linear infinite":"none"}}/>
          Simulasyonu Calistir
        </button>
      </div>

      <div style={{background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:"var(--r-xl)",padding:"14px 18px",display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
        <Zap size={14} color="var(--info)" style={{flexShrink:0,marginTop:2}}/>
        <div style={{flex:1,minWidth:200}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--info)",letterSpacing:"0.08em",marginBottom:4}}>TEMEL ICGORU</div>
          <div style={{fontSize:12,color:"var(--t1)",lineHeight:1.6}}>{report.key_insight}</div>
        </div>
        <div style={{flexShrink:0,textAlign:"center"}}>
          <div style={{fontSize:9,color:"var(--t4)",marginBottom:2}}>ONERILEN</div>
          <div style={{fontFamily:"var(--font-head)",fontSize:12,fontWeight:800,color:"var(--gold)",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.2)",padding:"4px 10px",borderRadius:"var(--r-md)"}}>{report.recommended}</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
        {report.scenarios.map(s=><ScenarioCard key={s.name} s={s} recommended={report.recommended}/>)}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}