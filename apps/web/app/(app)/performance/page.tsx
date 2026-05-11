"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BarChart3, TrendingUp, TrendingDown, Target, Activity, CheckCircle, XCircle, Clock, Award } from "lucide-react";

type SignalRecord = {
  id:string; symbol:string; stage:string; direction:string;
  entry_price:number; target_price:number; stop_price:number;
  confidence:number; created_at:string; outcome:string;
  exit_price:number; pnl_pct:number; closed_at:string;
};

type PerfStats = {
  total:number; closed:number; pending:number; hits:number; stops:number;
  hit_rate:number; avg_pnl:number; avg_win:number; avg_loss:number;
  best_trade:number; worst_trade:number; expectancy:number;
  records:SignalRecord[];
};

const MOCK_STATS: PerfStats = {
  total:47, closed:38, pending:9, hits:24, stops:10,
  hit_rate:63.2, avg_pnl:1.24, avg_win:2.8, avg_loss:-1.4,
  best_trade:8.2, worst_trade:-3.1, expectancy:0.82,
  records:[
    {id:"BTC_001",symbol:"BTCUSDT",stage:"TRIGGER",direction:"LONG",entry_price:79100,target_price:82000,stop_price:77500,confidence:82,created_at:"2026-05-10T09:15:00Z",outcome:"HIT",exit_price:82050,pnl_pct:3.73,closed_at:"2026-05-10T14:22:00Z"},
    {id:"XAU_001",symbol:"XAUUSD", stage:"SETUP",  direction:"LONG",entry_price:3245, target_price:3310, stop_price:3210, confidence:76,created_at:"2026-05-10T11:30:00Z",outcome:"HIT",exit_price:3312, pnl_pct:2.06,closed_at:"2026-05-11T08:10:00Z"},
    {id:"NVDA_001",symbol:"NVDA",  stage:"WATCH",  direction:"LONG",entry_price:845,  target_price:880,  stop_price:825,  confidence:68,created_at:"2026-05-09T15:00:00Z",outcome:"STOP_HIT",exit_price:824, pnl_pct:-2.49,closed_at:"2026-05-09T18:45:00Z"},
    {id:"ETH_001",symbol:"ETHUSDT",stage:"TRIGGER",direction:"LONG",entry_price:2210, target_price:2350, stop_price:2140, confidence:79,created_at:"2026-05-09T08:00:00Z",outcome:"HIT",exit_price:2351, pnl_pct:6.38,closed_at:"2026-05-10T06:30:00Z"},
    {id:"TSLA_001",symbol:"TSLA",  stage:"SETUP",  direction:"SHORT",entry_price:178, target_price:162,  stop_price:185,  confidence:71,created_at:"2026-05-08T14:00:00Z",outcome:"HIT",exit_price:163, pnl_pct:8.43,closed_at:"2026-05-09T10:00:00Z"},
  ],
};

function MetricCard({icon:Icon,label,value,sub,color="var(--t1)"}:{icon:any;label:string;value:string|number;sub?:string;color?:string}) {
  return (
    <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:"16px 18px"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <Icon size={12} color="var(--t4)"/>
        <span style={{fontSize:10,color:"var(--t4)",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>
      </div>
      <div style={{fontFamily:"var(--font-mono)",fontSize:22,fontWeight:800,color,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:10,color:"var(--t3)",marginTop:5}}>{sub}</div>}
    </div>
  );
}

const OUTCOME_CFG: Record<string,{color:string;label:string;icon:any}> = {
  HIT:       {color:"var(--up)",   label:"HIT",     icon:CheckCircle},
  STOP_HIT:  {color:"var(--down)", label:"STOP",    icon:XCircle},
  TIMEOUT:   {color:"var(--t4)",   label:"ZAMAN",   icon:Clock},
  PENDING:   {color:"var(--gold)", label:"BEKLİYOR",icon:Clock},
};

export default function PerformancePage() {
  const [filter, setFilter] = useState<"all"|"HIT"|"STOP_HIT"|"PENDING">("all");

  const {data, isLoading} = useQuery({
    queryKey:["performance"],
    queryFn:()=>api.get("/intelligence/performance").then(r=>r.data).catch(()=>null),
    staleTime:30000,
  });

  const stats: PerfStats = data || MOCK_STATS;
  const filtered = filter==="all" ? stats.records : stats.records.filter(r=>r.outcome===filter);

  return (
    <div style={{maxWidth:1200,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <BarChart3 size={18} color="var(--info)"/>
        <div>
          <h1 style={{fontFamily:"var(--font-head)",fontSize:20,fontWeight:800,color:"var(--t1)",margin:0}}>
            Performans &amp; Audit
          </h1>
          <p style={{fontSize:12,color:"var(--t3)",margin:0}}>Sinyal hit rate · Backtest sonuçları · Audit log</p>
        </div>
      </div>

      {/* STATS GRID */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
        <MetricCard icon={Target}      label="Hit Rate"      value={`${stats.hit_rate}%`}  sub={`${stats.hits} başarılı / ${stats.closed} kapandı`} color={stats.hit_rate>=60?"var(--up)":"var(--gold)"}/>
        <MetricCard icon={TrendingUp}  label="Ort. Kazanç"   value={`+${stats.avg_win}%`}  sub="Kazanan işlem ort." color="var(--up)"/>
        <MetricCard icon={TrendingDown} label="Ort. Kayıp"   value={`${stats.avg_loss}%`}  sub="Kaybeden işlem ort." color="var(--down)"/>
        <MetricCard icon={Activity}    label="Beklenti"      value={`${stats.expectancy>0?"+":""}${stats.expectancy}%`} sub="İşlem başına beklenen" color={stats.expectancy>0?"var(--up)":"var(--down)"}/>
        <MetricCard icon={Award}       label="En İyi İşlem"  value={`+${stats.best_trade}%`}  color="var(--up)"/>
        <MetricCard icon={XCircle}     label="En Kötü İşlem" value={`${stats.worst_trade}%`} color="var(--down)"/>
        <MetricCard icon={BarChart3}   label="Toplam Sinyal" value={stats.total} sub={`${stats.pending} bekliyor`} color="var(--t1)"/>
        <MetricCard icon={TrendingUp}  label="Ort. PnL"      value={`${stats.avg_pnl>0?"+":""}${stats.avg_pnl}%`} sub="Tüm kapanan işlemler" color={stats.avg_pnl>0?"var(--up)":"var(--down)"}/>
      </div>

      {/* HIT RATE VISUAL */}
      <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <span style={{fontFamily:"var(--font-head)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>Sinyal Dağılımı</span>
          <span style={{fontFamily:"var(--font-mono)",fontSize:20,fontWeight:800,color:stats.hit_rate>=60?"var(--up)":"var(--gold)"}}>
            {stats.hit_rate}% Hit Rate
          </span>
        </div>
        <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",gap:2}}>
          <div style={{width:`${(stats.hits/Math.max(stats.closed,1))*100}%`,background:"var(--up)",borderRadius:"6px 0 0 6px",transition:"width 0.5s"}}/>
          <div style={{width:`${(stats.stops/Math.max(stats.closed,1))*100}%`,background:"var(--down)"}}/>
          <div style={{flex:1,background:"var(--gold)",borderRadius:"0 6px 6px 0"}}/>
        </div>
        <div style={{display:"flex",gap:16,marginTop:8}}>
          {[
            {label:`HIT (${stats.hits})`,color:"var(--up)"},
            {label:`STOP (${stats.stops})`,color:"var(--down)"},
            {label:`BEKLİYOR (${stats.pending})`,color:"var(--gold)"},
          ].map(({label,color})=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"var(--t3)"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* FILTER TABS */}
      <div style={{display:"flex",gap:8}}>
        {(["all","HIT","STOP_HIT","PENDING"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:"6px 14px",borderRadius:"var(--r-md)",fontFamily:"inherit",
            border:`1px solid ${filter===f?"var(--gold)":"var(--b1)"}`,
            background:filter===f?"rgba(245,158,11,0.1)":"transparent",
            color:filter===f?"var(--gold)":"var(--t3)",fontSize:11,fontWeight:700,cursor:"pointer",
          }}>
            {f==="all"?"Tümü":f==="HIT"?"\u2713 Başarılı":f==="STOP_HIT"?"\u2715 Stop":f==="PENDING"?"\u23f3 Bekliyor":f}
          </button>
        ))}
      </div>

      {/* RECORDS TABLE */}
      <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:"1px solid var(--b1)"}}>
                {["Sembol","Aşama","Yön","Güven","Giriş","Hedef","Stop","Sonuç","PnL","Tarih"].map(h=>(
                  <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,fontWeight:700,
                    color:"var(--t4)",letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r=>{
                const oc = OUTCOME_CFG[r.outcome]||OUTCOME_CFG.PENDING;
                const OcIcon = oc.icon;
                return (
                  <tr key={r.id} style={{borderBottom:"1px solid var(--b1)",transition:"background 0.1s"}}
                    onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <td style={{padding:"10px 14px",fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:"var(--t1)"}}>{r.symbol}</td>
                    <td style={{padding:"10px 14px"}}>
                      <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,
                        background:r.stage==="TRIGGER"?"rgba(16,185,129,0.1)":r.stage==="SETUP"?"rgba(245,158,11,0.1)":"var(--bg-hover)",
                        color:r.stage==="TRIGGER"?"var(--up)":r.stage==="SETUP"?"var(--gold)":"var(--t3)",
                        border:`1px solid ${r.stage==="TRIGGER"?"rgba(16,185,129,0.3)":r.stage==="SETUP"?"rgba(245,158,11,0.3)":"var(--b1)"}`,
                      }}>{r.stage}</span>
                    </td>
                    <td style={{padding:"10px 14px",fontSize:10,fontWeight:700,color:r.direction==="LONG"?"var(--up)":"var(--down)"}}>{r.direction}</td>
                    <td style={{padding:"10px 14px",fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t1)"}}>{r.confidence}%</td>
                    <td style={{padding:"10px 14px",fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t2)"}}>{r.entry_price.toLocaleString()}</td>
                    <td style={{padding:"10px 14px",fontFamily:"var(--font-mono)",fontSize:11,color:"var(--up)"}}>{r.target_price.toLocaleString()}</td>
                    <td style={{padding:"10px 14px",fontFamily:"var(--font-mono)",fontSize:11,color:"var(--down)"}}>{r.stop_price.toLocaleString()}</td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <OcIcon size={10} color={oc.color}/>
                        <span style={{fontSize:9,fontWeight:700,color:oc.color}}>{oc.label}</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px",fontFamily:"var(--font-mono)",fontSize:12,fontWeight:800,
                      color:r.pnl_pct>0?"var(--up)":r.pnl_pct<0?"var(--down)":"var(--t4)"}}>
                      {r.pnl_pct===0?"\u2014":`${r.pnl_pct>0?"+":""}${r.pnl_pct.toFixed(2)}%`}
                    </td>
                    <td style={{padding:"10px 14px",fontSize:10,color:"var(--t4)",whiteSpace:"nowrap"}}>
                      {new Date(r.created_at).toLocaleDateString("tr")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

