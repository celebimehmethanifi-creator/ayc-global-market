"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Users, TrendingUp, TrendingDown, Minus, BarChart2, Zap, Activity, Award } from "lucide-react";

const ASSETS = [
  {id:"a1",symbol:"BTC",  name:"Bitcoin",        cat:"CRYPTO",   bull:72, bear:18, neutral:10, votes:1842, contrarian:false},
  {id:"a2",symbol:"ETH",  name:"Ethereum",       cat:"CRYPTO",   bull:65, bear:24, neutral:11, votes:1243, contrarian:false},
  {id:"a3",symbol:"SOL",  name:"Solana",         cat:"CRYPTO",   bull:69, bear:21, neutral:10, votes:876,  contrarian:false},
  {id:"a4",symbol:"NVDA", name:"NVIDIA",         cat:"US",       bull:58, bear:28, neutral:14, votes:654,  contrarian:false},
  {id:"a5",symbol:"AAPL", name:"Apple",          cat:"US",       bull:44, bear:38, neutral:18, votes:532,  contrarian:true},
  {id:"a6",symbol:"THYAO",name:"Turk Hava Yol.", cat:"BIST",     bull:61, bear:26, neutral:13, votes:421,  contrarian:false},
  {id:"a7",symbol:"XAU",  name:"Altin",          cat:"PRECIOUS", bull:78, bear:13, neutral:9,  votes:987,  contrarian:false},
  {id:"a8",symbol:"EUR",  name:"EUR/USD",        cat:"FOREX",    bull:51, bear:33, neutral:16, votes:378,  contrarian:true},
];

const CATS = ["Tumu","CRYPTO","US","BIST","PRECIOUS","FOREX"];
const CAT_COLORS: Record<string,string> = {
  CRYPTO:"#F0C060", US:"#818CF8", BIST:"#F59E0B", PRECIOUS:"#0ECB81", FOREX:"#60A5FA", "Tumu":"var(--t2)"
};

const TOP_WEEKLY = [
  {symbol:"XAU",  pct:78, dir:"bull", change:"+5.2%"},
  {symbol:"BTC",  pct:72, dir:"bull", change:"+1.8%"},
  {symbol:"SOL",  pct:69, dir:"bull", change:"+3.4%"},
  {symbol:"NVDA", pct:58, dir:"bull", change:"+2.1%"},
  {symbol:"AAPL", pct:38, dir:"bear", change:"-1.2%"},
];

const CONTRARIAN = [
  {symbol:"AAPL", note:"Kitle cok ayici — contrarian LONG sinyali", bull:44},
  {symbol:"EUR",  note:"Asiri oy dengesi — momentum tukenmis olabilir", bull:51},
];

function VoteBar({bull,bear,neutral}:{bull:number;bear:number;neutral:number}) {
  return (
    <div style={{display:"flex",height:4,borderRadius:2,overflow:"hidden",gap:1}}>
      <div style={{width:`${bull}%`,background:"var(--up)",borderRadius:"2px 0 0 2px"}}/>
      <div style={{width:`${neutral}%`,background:"var(--neutral)"}}/>
      <div style={{width:`${bear}%`,background:"var(--down)",borderRadius:"0 2px 2px 0"}}/>
    </div>
  );
}

export default function SocialPage() {
  const [cat, setCat] = useState("Tumu");
  const [voted, setVoted] = useState<Record<string,string>>({});

  const filtered = ASSETS.filter(a=>cat==="Tumu"||a.cat===cat);

  const vote = (id:string, dir:string) => {
    setVoted(p=>({...p,[id]:dir}));
    api.post(`/social/${id}/vote`,{direction:dir}).catch(()=>{});
  };

  return (
    <div style={{maxWidth:1100,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>

      {/* HEADER */}
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Users size={18} color="var(--gold)"/>
          <h1 style={{fontFamily:"var(--font-head)",fontSize:20,fontWeight:800,color:"var(--t1)",margin:0}}>Sosyal Radar</h1>
        </div>
        <p style={{fontSize:12,color:"var(--t3)",margin:"4px 0 0",paddingLeft:28}}>Topluluk senticmenti, kitle psikolojisi ve contrarian analiz</p>
      </div>

      {/* SENTIMENT OVERVIEW - 5 category bars */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
        {["CRYPTO","US","BIST","PRECIOUS","FOREX"].map(c=>{
          const items = ASSETS.filter(a=>a.cat===c);
          const avgBull = Math.round(items.reduce((s,a)=>s+a.bull,0)/items.length);
          const avgBear = Math.round(items.reduce((s,a)=>s+a.bear,0)/items.length);
          const color = CAT_COLORS[c]||"var(--t2)";
          return (
            <div key={c} className="card" style={{cursor:"pointer",borderColor:cat===c?`${color}40`:"var(--b1)"}}
                 onClick={()=>setCat(cat===c?"Tumu":c)}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:11,fontWeight:700,color,letterSpacing:"0.04em"}}>{c}</span>
                <span style={{fontFamily:"var(--font-mono)",fontSize:18,fontWeight:800,color:avgBull>50?"var(--up)":"var(--down)"}}>{avgBull}%</span>
              </div>
              <VoteBar bull={avgBull} bear={avgBear} neutral={100-avgBull-avgBear}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                <span style={{fontSize:10,color:"var(--up)",fontFamily:"var(--font-mono)"}}>BULL {avgBull}%</span>
                <span style={{fontSize:10,color:"var(--down)",fontFamily:"var(--font-mono)"}}>BEAR {avgBear}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CAT PILLS */}
      <div className="cat-pills">
        {CATS.map(c=>(
          <button key={c} className={`cat-pill${cat===c?" active":""}`} onClick={()=>setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      {/* MAIN GRID + SIDEBAR */}
      <div className="social-grid">

        {/* Asset Cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {filtered.map(a=>{
            const bullColor = a.bull>=65?"var(--up)":a.bull>=50?"var(--warn)":"var(--down)";
            const catColor = CAT_COLORS[a.cat]||"var(--t2)";
            const userVote = voted[a.id];
            return (
              <div key={a.id} className="card" style={{
                borderColor:a.contrarian?"var(--warn-dim)":"var(--b1)",
                background:a.contrarian?"linear-gradient(135deg,var(--warn-dim),var(--bg-card))":"var(--bg-card)",
                position:"relative",
              }}>
                {a.contrarian && (
                  <div style={{
                    position:"absolute",top:10,right:10,
                    display:"flex",alignItems:"center",gap:4,
                    padding:"2px 7px",borderRadius:4,
                    background:"var(--warn-dim)",border:"1px solid rgba(245,158,11,0.3)",
                  }}>
                    <Zap size={9} color="var(--warn)"/>
                    <span style={{fontSize:8,fontWeight:800,color:"var(--warn)",letterSpacing:"0.06em"}}>CONTRARIAN</span>
                  </div>
                )}

                {/* Symbol + votes */}
                <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:12}}>
                  <div style={{
                    width:40,height:40,borderRadius:"var(--r-md)",flexShrink:0,
                    background:`${catColor}18`,border:`1px solid ${catColor}30`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontFamily:"var(--font-mono)",fontSize:10,fontWeight:800,color:catColor,
                  }}>{a.symbol}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>{a.symbol}</div>
                    <div style={{fontSize:11,color:"var(--t3)",marginTop:1}}>{a.name}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:22,fontWeight:800,color:bullColor,lineHeight:1}}>{a.bull}%</div>
                    <div style={{fontSize:9,color:"var(--t3)",marginTop:1}}>BULL</div>
                  </div>
                </div>

                {/* Vote bar */}
                <VoteBar bull={a.bull} bear={a.bear} neutral={a.neutral}/>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:5,marginBottom:12}}>
                  <span style={{fontSize:10,color:"var(--up)",fontFamily:"var(--font-mono)"}}>↑ {a.bull}%</span>
                  <span style={{fontSize:10,color:"var(--neutral)",fontFamily:"var(--font-mono)"}}>{a.neutral}%</span>
                  <span style={{fontSize:10,color:"var(--down)",fontFamily:"var(--font-mono)"}}>↓ {a.bear}%</span>
                </div>

                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <Users size={10} color="var(--t4)"/>
                    <span style={{fontSize:10,color:"var(--t3)",fontFamily:"var(--font-mono)"}}>{a.votes.toLocaleString()} oy</span>
                  </div>
                </div>

                {/* Vote buttons */}
                <div style={{display:"flex",gap:5}}>
                  {["bull","neutral","bear"].map(d=>{
                    const isVoted = userVote===d;
                    const cfg = d==="bull"
                      ? {label:"YUKARI",color:"var(--up)",bg:"var(--up-dim)",border:"var(--up-border)"}
                      : d==="neutral"
                      ? {label:"NOTR",color:"var(--t3)",bg:"var(--bg-hover)",border:"var(--b2)"}
                      : {label:"ASAGI",color:"var(--down)",bg:"var(--down-dim)",border:"var(--down-border)"};
                    return (
                      <button key={d} onClick={()=>vote(a.id,d)} style={{
                        flex:1,padding:"6px 4px",borderRadius:"var(--r-sm)",border:`1px solid ${isVoted?cfg.border:"var(--b1)"}`,
                        background:isVoted?cfg.bg:"transparent",
                        color:isVoted?cfg.color:"var(--t3)",
                        fontSize:9,fontWeight:800,fontFamily:"var(--font-mono)",
                        cursor:"pointer",letterSpacing:"0.04em",transition:"all 0.12s",
                      }}
                      onMouseEnter={e=>{if(!isVoted){(e.currentTarget.style.background=cfg.bg);(e.currentTarget.style.color=cfg.color);(e.currentTarget.style.borderColor=cfg.border);}}}
                      onMouseLeave={e=>{if(!isVoted){(e.currentTarget.style.background="transparent");(e.currentTarget.style.color="var(--t3)");(e.currentTarget.style.borderColor="var(--b1)");}}}
                      >{cfg.label}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* SIDEBAR */}
        <div className="social-sidebar-panel" style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Top weekly */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-lg)",padding:16}}>
            <div className="section-hdr" style={{marginBottom:12}}>
              <span className="section-title">Haftanin Lider</span>
            </div>
            {TOP_WEEKLY.map((t,i)=>(
              <div key={t.symbol} style={{
                display:"flex",alignItems:"center",gap:10,
                padding:"8px 0",borderBottom:i<TOP_WEEKLY.length-1?"1px solid var(--b1)":"none"
              }}>
                <span style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:"var(--t4)",minWidth:14}}>{i+1}</span>
                <span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:"var(--t1)",flex:1}}>{t.symbol}</span>
                <span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:t.dir==="bull"?"var(--up)":"var(--down)"}}>{t.pct}%</span>
                <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:t.change.startsWith("+")?"var(--up)":"var(--down)"}}>{t.change}</span>
              </div>
            ))}
          </div>

          {/* Contrarian alerts */}
          <div style={{background:"var(--bg-card)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:"var(--r-lg)",padding:16}}>
            <div className="section-hdr" style={{marginBottom:12}}>
              <span className="section-title" style={{color:"var(--warn)"}}>Contrarian Uyari</span>
            </div>
            {CONTRARIAN.map((c)=>(
              <div key={c.symbol} style={{
                padding:"10px 12px",background:"var(--warn-dim)",
                border:"1px solid rgba(245,158,11,0.2)",borderRadius:"var(--r-md)",marginBottom:8
              }}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <Zap size={11} color="var(--warn)"/>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:"var(--t1)"}}>{c.symbol}</span>
                </div>
                <div style={{fontSize:11,color:"var(--t2)",lineHeight:1.45}}>{c.note}</div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div style={{padding:"10px 12px",background:"var(--bg-hover)",borderRadius:"var(--r-md)",border:"1px solid var(--b1)"}}>
            <div style={{fontSize:10,color:"var(--t4)",lineHeight:1.5}}>
              Bu veriler yalnizca topluluk goruslerini yansitir. Yatirim karari vermek icin kullanilmamalidir.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
