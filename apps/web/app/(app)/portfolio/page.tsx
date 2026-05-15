"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AssetDetailModal, type AssetInfo } from "@/components/ui/AssetDetailModal";
import { Plus, TrendingUp, TrendingDown, Briefcase, BarChart2, X, ArrowUpRight, ArrowDownRight, DollarSign, Percent, Activity, Brain, Search } from "lucide-react";
import { usePrices } from "@/lib/prices/PriceContext";
import { useDemo } from "@/lib/demo/DemoContext";
import { FlaskConical } from "lucide-react";

function inferCategory(sym: string): string {
  const db = ASSET_DB.find(a => a.symbol === sym);
  if (db) return db.category;
  if (sym.endsWith("USDT")) return "CRYPTO";
  if (sym === "XAUUSD" || sym === "XAGUSD") return "PRECIOUS";
  if (sym === "USOIL" || sym === "BRENTOIL") return "ENERGY";
  if (["EURUSD","GBPUSD","USDJPY","USDTRY"].includes(sym)) return "FOREX";
  return "US";
}

// Kapsamli varlik veritabani (arama icin)
const ASSET_DB = [
  // Crypto
  {symbol:"BTCUSDT", name:"Bitcoin",       category:"CRYPTO"},
  {symbol:"ETHUSDT", name:"Ethereum",      category:"CRYPTO"},
  {symbol:"SOLUSDT", name:"Solana",        category:"CRYPTO"},
  {symbol:"BNBUSDT", name:"BNB Chain",     category:"CRYPTO"},
  {symbol:"XRPUSDT", name:"Ripple",        category:"CRYPTO"},
  {symbol:"ADAUSDT", name:"Cardano",       category:"CRYPTO"},
  {symbol:"DOGEUSDT",name:"Dogecoin",      category:"CRYPTO"},
  {symbol:"AVAXUSDT",name:"Avalanche",     category:"CRYPTO"},
  {symbol:"DOTUSDT", name:"Polkadot",      category:"CRYPTO"},
  {symbol:"LINKUSDT",name:"Chainlink",     category:"CRYPTO"},
  {symbol:"LTCUSDT", name:"Litecoin",      category:"CRYPTO"},
  {symbol:"MATICUSDT",name:"Polygon",      category:"CRYPTO"},
  {symbol:"UNIUSDT", name:"Uniswap",       category:"CRYPTO"},
  {symbol:"ATOMUSDT",name:"Cosmos",        category:"CRYPTO"},
  {symbol:"NEARUSDT",name:"NEAR Protocol", category:"CRYPTO"},
  {symbol:"APTUSDT", name:"Aptos",         category:"CRYPTO"},
  {symbol:"ARBUSDT", name:"Arbitrum",      category:"CRYPTO"},
  {symbol:"OPUSDT",  name:"Optimism",      category:"CRYPTO"},
  {symbol:"INJUSDT", name:"Injective",     category:"CRYPTO"},
  {symbol:"SUIUSDT", name:"Sui",           category:"CRYPTO"},
  // US Stocks
  {symbol:"AAPL",  name:"Apple",           category:"US"},
  {symbol:"NVDA",  name:"NVIDIA",          category:"US"},
  {symbol:"TSLA",  name:"Tesla",           category:"US"},
  {symbol:"MSFT",  name:"Microsoft",       category:"US"},
  {symbol:"GOOGL", name:"Alphabet",        category:"US"},
  {symbol:"AMZN",  name:"Amazon",          category:"US"},
  {symbol:"META",  name:"Meta Platforms",  category:"US"},
  {symbol:"NFLX",  name:"Netflix",         category:"US"},
  {symbol:"AMD",   name:"AMD",             category:"US"},
  {symbol:"INTC",  name:"Intel",           category:"US"},
  {symbol:"COIN",  name:"Coinbase",        category:"US"},
  {symbol:"MSTR",  name:"MicroStrategy",   category:"US"},
  {symbol:"PLTR",  name:"Palantir",        category:"US"},
  // BIST
  {symbol:"THYAO", name:"Turk Hava Yollari",category:"BIST"},
  {symbol:"GARAN", name:"Garanti Bankasi", category:"BIST"},
  {symbol:"EREGL", name:"Eregli Demir",    category:"BIST"},
  {symbol:"ASELS", name:"Aselsan",         category:"BIST"},
  {symbol:"SASA",  name:"Sasa Polyester",  category:"BIST"},
  {symbol:"KCHOL", name:"Koc Holding",     category:"BIST"},
  {symbol:"SAHOL", name:"Sabanci Holding", category:"BIST"},
  {symbol:"AKBNK", name:"Akbank",          category:"BIST"},
  {symbol:"YKBNK", name:"Yapi Kredi",      category:"BIST"},
  {symbol:"BIMAS", name:"BIM Magazalar",   category:"BIST"},
  {symbol:"PGSUS", name:"Pegasus",         category:"BIST"},
  {symbol:"TCELL", name:"Turkcell",        category:"BIST"},
  // Forex / Emtia
  {symbol:"EURUSD",name:"Euro / Dolar",    category:"FOREX"},
  {symbol:"GBPUSD",name:"Sterlin / Dolar", category:"FOREX"},
  {symbol:"USDJPY",name:"Dolar / Yen",     category:"FOREX"},
  {symbol:"USDTRY",name:"Dolar / TL",      category:"FOREX"},
  {symbol:"XAUUSD",name:"Altin",           category:"PRECIOUS"},
  {symbol:"XAGUSD",name:"Gumus",           category:"PRECIOUS"},
  {symbol:"USOIL", name:"Ham Petrol",      category:"ENERGY"},
  {symbol:"BRENTOIL",name:"Brent Petrol",  category:"ENERGY"},
];

const CAT_COLORS: Record<string,string> = {
  CRYPTO:"#F0C060", US:"#818CF8", PRECIOUS:"#0ECB81", FOREX:"#60A5FA", BIST:"#F59E0B", ENERGY:"#FB923C"
};

type Position = {
  id:string; symbol:string; name:string; category:string;
  entry:number; current:number; qty:number; change24h:number;
};

// Symbol search dropdown
function SymbolSearch({ onSelect }: { onSelect:(sym:string,name:string,cat:string)=>void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const fn = (e:MouseEvent)=>{ if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown",fn); return ()=>document.removeEventListener("mousedown",fn);
  },[]);

  const results = q.trim().length < 1 ? [] : ASSET_DB.filter(a=>{
    const s = q.toUpperCase();
    return a.symbol.includes(s) || a.name.toUpperCase().includes(s);
  }).slice(0, 8);

  // Kullanicinin kendi yazdigi sembol (listede yoksa)
  const customEntry = q.trim().length > 1 && results.length === 0;

  return (
    <div ref={ref} style={{position:"relative"}}>
      <div style={{position:"relative"}}>
        <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--t3)"}}/>
        <input
          value={q}
          onChange={e=>{setQ(e.target.value);setOpen(true);}}
          onFocus={()=>setOpen(true)}
          className="inp"
          placeholder="BTC, THYAO, AAPL, EURUSD... veya kendi sembolunu yaz"
          style={{width:"100%",boxSizing:"border-box",padding:"8px 12px 8px 32px"}}
        />
      </div>
      {open && (results.length > 0 || customEntry) && (
        <div style={{
          position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:200,
          background:"var(--bg-panel)",border:"1px solid var(--b2)",borderRadius:"var(--r-md)",
          boxShadow:"0 8px 24px rgba(0,0,0,0.4)",overflow:"hidden",
        }}>
          {results.map(r=>(
            <div key={r.symbol} onClick={()=>{ onSelect(r.symbol,r.name,r.category); setQ(r.symbol); setOpen(false); }}
              style={{
                display:"flex",alignItems:"center",gap:10,padding:"9px 14px",
                cursor:"pointer",transition:"background 0.1s",
              }}
              onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <div style={{
                width:28,height:28,borderRadius:6,flexShrink:0,
                background:`${CAT_COLORS[r.category]||"#D4A843"}18`,
                border:`1px solid ${CAT_COLORS[r.category]||"#D4A843"}30`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"var(--font-mono)",fontSize:8,fontWeight:800,color:CAT_COLORS[r.category]||"#D4A843"
              }}>{r.symbol.slice(0,3)}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:"var(--t1)"}}>{r.symbol}</div>
                <div style={{fontSize:10,color:"var(--t3)"}}>{r.name}</div>
              </div>
              <span style={{
                fontSize:9,padding:"2px 6px",borderRadius:3,fontWeight:700,fontFamily:"var(--font-mono)",
                background:`${CAT_COLORS[r.category]||"#D4A843"}18`,
                color:CAT_COLORS[r.category]||"#D4A843",
              }}>{r.category}</span>
            </div>
          ))}
          {customEntry && (
            <div onClick={()=>{ onSelect(q.toUpperCase(),q.toUpperCase(),"CUSTOM"); setQ(q.toUpperCase()); setOpen(false); }}
              style={{
                display:"flex",alignItems:"center",gap:10,padding:"9px 14px",
                cursor:"pointer",borderTop:"1px solid var(--b1)",
              }}
              onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <div style={{
                width:28,height:28,borderRadius:6,flexShrink:0,
                background:"var(--gold-dim)",border:"1px solid var(--gold-border)",
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <Plus size={12} color="var(--gold)"/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:"var(--gold)"}}>"{q.toUpperCase()}" ekle</div>
                <div style={{fontSize:10,color:"var(--t3)"}}>Ozel sembol — AI analiz edecek</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PosRow({ pos, livePrice, onDetail }: { pos:Position; livePrice?:number; onDetail:()=>void }) {
  const current = livePrice ?? pos.current;
  const val = current * pos.qty;
  const cost = pos.entry * pos.qty;
  const pnl = val - cost;
  const pnlPct = (pnl/cost)*100;
  const up = pnl >= 0;
  return (
    <tr style={{borderBottom:"1px solid var(--b1)",cursor:"pointer",transition:"background 0.12s"}}
        onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")}
        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
      <td style={{padding:"12px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{
            width:32,height:32,borderRadius:8,
            background:`${CAT_COLORS[pos.category]||"#D4A843"}18`,
            border:`1px solid ${CAT_COLORS[pos.category]||"#D4A843"}30`,
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
            fontFamily:"var(--font-mono)",fontSize:9,fontWeight:800,
            color:CAT_COLORS[pos.category]||"#D4A843",
          }}>{pos.symbol.slice(0,3)}</div>
          <div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>{pos.symbol}</div>
            <div style={{fontSize:10,color:"var(--t3)",marginTop:1}}>{pos.name}</div>
          </div>
        </div>
      </td>
      <td style={{padding:"12px 14px",textAlign:"right",fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:"var(--t1)"}}>
        ${current.toLocaleString("en-US",{maximumFractionDigits:2})}
      </td>
      <td style={{padding:"12px 14px",textAlign:"right",fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:pos.change24h>=0?"var(--up)":"var(--down)"}}>
        {pos.change24h>=0?"+":""}{pos.change24h.toFixed(2)}%
      </td>
      <td style={{padding:"12px 14px",textAlign:"right",fontFamily:"var(--font-mono)",fontSize:12,color:"var(--t2)"}}>{pos.qty}</td>
      <td style={{padding:"12px 14px",textAlign:"right",fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:"var(--t1)"}}>
        ${val.toLocaleString("en-US",{maximumFractionDigits:0})}
      </td>
      <td style={{padding:"12px 14px",textAlign:"right"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
          <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:up?"var(--up)":"var(--down)"}}>
            {up?"+":""}{pnl.toFixed(2)}$
          </span>
          <span style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:600,color:up?"var(--up)":"var(--down)",
            background:up?"var(--up-dim)":"var(--down-dim)",border:`1px solid ${up?"var(--up-border)":"var(--down-border)"}`,
            padding:"1px 5px",borderRadius:4}}>
            {up?"+":""}{pnlPct.toFixed(2)}%
          </span>
        </div>
      </td>
      <td style={{padding:"12px 14px",textAlign:"right"}}>
        <button className="btn-ghost" style={{padding:"4px 10px",fontSize:10,gap:4,display:"inline-flex",alignItems:"center"}}
          onClick={e=>{e.stopPropagation();onDetail();}}>
          <Brain size={11} color="var(--gold)"/> Analiz
        </button>
      </td>
    </tr>
  );
}

export default function PortfolioPage() {
  const qc = useQueryClient();
  const livePrices = usePrices();
  const { demo, closeTrade, totalValue: demoTotal, totalPnlUSD: demoPnl, totalPnlPct: demoPnlPct } = useDemo();
  const [activeTab, setActiveTab] = useState<"real"|"demo">("demo");
  const getLP = (sym:string) => {
    const p = livePrices[sym] ?? livePrices[sym+"USDT"] ?? livePrices[sym.replace("/","")];
    return p?.price;
  };
  const [showAdd, setShowAdd] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo|null>(null);
  const [form, setForm] = useState({symbol:"",name:"",category:"CRYPTO",entry:"",qty:"",date:""});

  const {data:posData,isLoading} = useQuery({
    queryKey:["positions"],
    queryFn:()=>api.get("/portfolio/positions").then(r=>r.data.positions).catch(()=>[]),
  });

  const addMut = useMutation({
    mutationFn:(b:any)=>api.post("/portfolio/positions",b),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["positions"]}); setShowAdd(false); setForm({symbol:"",name:"",category:"CRYPTO",entry:"",qty:"",date:""}); },
  });

  const demoPositions: Position[] = demo.openTrades.map(t => ({
    id: t.id,
    symbol: t.symbol,
    name: t.name,
    category: inferCategory(t.symbol),
    entry: t.entryPrice,
    current: getLP(t.symbol) ?? t.entryPrice,
    qty: t.quantity,
    change24h: 0,
  }));

  const positions: Position[] = activeTab === "demo"
    ? demoPositions
    : (posData || []);

  const totalVal  = positions.reduce((s,p)=>s+(getLP(p.symbol)??p.current)*p.qty,0);
  const totalCost = positions.reduce((s,p)=>s+p.entry*p.qty,0);
  const totalPnl  = totalVal - totalCost;
  const totalPct  = totalCost > 0 ? (totalPnl/totalCost)*100 : 0;
  const winners   = positions.filter(p=>(p.current-p.entry)>0).length;
  const winRate   = positions.length > 0 ? Math.round(winners/positions.length*100) : 0;

  const alloc: Record<string,number> = {};
  positions.forEach(p=>{ alloc[p.category]=(alloc[p.category]||0)+p.current*p.qty; });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20,maxWidth:1100,margin:"0 auto"}}>

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Briefcase size={18} color="var(--gold)"/>
            <h1 style={{fontFamily:"var(--font-head)",fontSize:20,fontWeight:800,color:"var(--t1)",margin:0}}>Portföyum</h1>
          </div>
          <p style={{fontSize:12,color:"var(--t3)",margin:"4px 0 0",paddingLeft:28}}>Pozisyon tikla → aninda AI analizi</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowAdd(true)} className="btn-gold" style={{gap:6,display:"flex",alignItems:"center"}}>
            <Plus size={14}/> Pozisyon Ekle
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
        {[
          {label:"Portföy Degeri",value:positions.length===0?"$0":`$${totalVal.toLocaleString("en-US",{maximumFractionDigits:0})}`,sub:positions.length===0?"Pozisyon yok":`${positions.length} pozisyon`,icon:DollarSign,color:"var(--gold)",dim:"var(--gold-dim)",border:"var(--gold-border)"},
          {label:"Toplam K/Z",value:`${totalPnl>=0?"+":""}$${Math.abs(totalPnl).toFixed(0)}`,sub:`Maliyet: $${totalCost.toLocaleString("en-US",{maximumFractionDigits:0})}`,icon:totalPnl>=0?TrendingUp:TrendingDown,color:totalPnl>=0?"var(--up)":"var(--down)",dim:totalPnl>=0?"var(--up-dim)":"var(--down-dim)",border:totalPnl>=0?"var(--up-border)":"var(--down-border)"},
          {label:"Getiri",value:`${totalPct>=0?"+":""}${totalPct.toFixed(2)}%`,sub:"Tum zamanlar",icon:Percent,color:totalPct>=0?"var(--up)":"var(--down)",dim:totalPct>=0?"var(--up-dim)":"var(--down-dim)",border:totalPct>=0?"var(--up-border)":"var(--down-border)"},
          {label:"Kazanan Oran",value:`${winRate}%`,sub:`${winners}/${positions.length} karli`,icon:Activity,color:"var(--purple)",dim:"var(--purple-dim)",border:"rgba(129,140,248,0.25)"},
        ].map(s=>(
          <div key={s.label} className="stat-card" style={{borderColor:s.border,background:`linear-gradient(135deg,${s.dim},var(--bg-card))`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span className="stat-label">{s.label}</span>
              <s.icon size={13} color={s.color} style={{opacity:0.4}}/>
            </div>
            <div className="stat-value" style={{color:s.color,fontSize:24}}>{s.value}</div>
            <div className="stat-delta">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* TABLE + ALLOC */}
      <div className="portfolio-grid">
        <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-lg)",overflow:"hidden"}}>
          <div style={{padding:"14px 16px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",gap:8}}>
            <BarChart2 size={14} color="var(--gold)"/>
            <span style={{fontFamily:"var(--font-head)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>Pozisyonlar</span>
            <span style={{marginLeft:"auto",fontSize:11,color:"var(--t3)"}}>Analiz icin satira tikla</span>
          </div>
          {positions.length === 0 ? (
            <div style={{padding:"48px 24px",textAlign:"center",color:"var(--t3)"}}>
              <Briefcase size={28} color="var(--t4)" style={{margin:"0 auto 12px"}}/>
              <div style={{fontSize:14,fontWeight:600,color:"var(--t2)",marginBottom:6}}>
                {activeTab === "demo" ? "Henüz demo pozisyon yok" : "Henüz pozisyon yok"}
              </div>
              <div style={{fontSize:12,color:"var(--t3)"}}>
                {activeTab === "demo"
                  ? "Sinyal sayfasından Demo butonuna basarak demo işlem açabilirsiniz."
                  : "Pozisyon Ekle butonuna basarak portföyünüzü oluşturun."}
              </div>
            </div>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table className="market-table pos-table" style={{width:"100%",minWidth:400}}>
                <thead>
                  <tr>
                    {["Varlik","Fiyat","24s %","Miktar","Deger","K/Z",""].map((h,i)=>(
                      <th key={i} style={{textAlign:i>0&&i<6?"right":"left"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map(p=>(
                    <PosRow key={p.id} pos={p} onDetail={()=>setSelectedAsset({
                      symbol:p.symbol,name:p.name,display:p.symbol,
                      price:getLP(p.symbol)??p.current,chg:p.change24h,market:p.category.toLowerCase(),
                    })}/>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Allocation */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-lg)",padding:16}}>
            <div className="section-hdr" style={{marginBottom:14}}>
              <span className="section-title">Dagilim</span>
            </div>
            {positions.length === 0 ? (
              <div style={{fontSize:11,color:"var(--t3)",textAlign:"center",padding:"12px 0"}}>Pozisyon yok</div>
            ) : (
              <>
                <div style={{height:8,borderRadius:4,overflow:"hidden",display:"flex",marginBottom:14}}>
                  {Object.entries(alloc).map(([cat,val])=>(
                    <div key={cat} style={{width:`${(val/totalVal*100)}%`,background:CAT_COLORS[cat]||"#D4A843",transition:"width 0.5s ease"}}/>
                  ))}
                </div>
                {Object.entries(alloc).map(([cat,val])=>(
                  <div key={cat} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:7,height:7,borderRadius:2,background:CAT_COLORS[cat]||"#D4A843"}}/>
                      <span style={{fontSize:12,color:"var(--t2)",fontWeight:500}}>{cat}</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:600,color:"var(--t1)"}}>{(val/totalVal*100).toFixed(1)}%</div>
                      <div style={{fontSize:10,color:"var(--t3)"}}>${val.toLocaleString("en-US",{maximumFractionDigits:0})}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* P&L list */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-lg)",padding:16}}>
            <div className="section-hdr" style={{marginBottom:12}}>
              <span className="section-title">P&L Ozeti</span>
            </div>
            {positions.length === 0 ? (
              <div style={{fontSize:11,color:"var(--t3)",textAlign:"center",padding:"12px 0"}}>Kapanan işlem yok</div>
            ) : positions.map(p=>{
              const cur = getLP(p.symbol) ?? p.current;
              const pnl=(cur-p.entry)*p.qty; const up=pnl>=0;
              return (
                <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,cursor:"pointer"}}
                  onClick={()=>setSelectedAsset({symbol:p.symbol,name:p.name,display:p.symbol,price:cur,chg:p.change24h,market:p.category.toLowerCase()})}>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t2)",fontWeight:600}}>{p.symbol}</span>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    {up?<ArrowUpRight size={11} color="var(--up)"/>:<ArrowDownRight size={11} color="var(--down)"/>}
                    <span style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:up?"var(--up)":"var(--down)"}}>
                      {up?"+":""}{pnl.toFixed(1)}$
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI ANALYSIS MODAL */}
      {selectedAsset && (
        <AssetDetailModal asset={selectedAsset} onClose={()=>setSelectedAsset(null)}/>
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <div style={{position:"fixed",inset:0,background:"var(--bg-modal)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
             onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div style={{background:"var(--bg-panel)",border:"1px solid var(--b2)",borderRadius:"var(--r-xl)",padding:28,width:"100%",maxWidth:440}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
              <div>
                <span style={{fontFamily:"var(--font-head)",fontSize:16,fontWeight:700,color:"var(--t1)"}}>Pozisyon Ekle</span>
                <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>Herhangi bir varlik ekleyebilirsiniz</div>
              </div>
              <button onClick={()=>setShowAdd(false)} className="btn-ghost" style={{padding:"4px 8px",minWidth:0}}><X size={14}/></button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Symbol search */}
              <div>
                <label style={{fontSize:11,color:"var(--t3)",display:"block",marginBottom:5,fontWeight:600,letterSpacing:"0.04em"}}>SEMBOL ARA</label>
                <SymbolSearch onSelect={(sym,name,cat)=>setForm(p=>({...p,symbol:sym,name,category:cat}))}/>
                {form.symbol && (
                  <div style={{
                    marginTop:6,display:"flex",alignItems:"center",gap:8,padding:"6px 10px",
                    background:"var(--gold-dim)",border:"1px solid var(--gold-border)",borderRadius:"var(--r-sm)"
                  }}>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:"var(--gold)"}}>{form.symbol}</span>
                    <span style={{fontSize:11,color:"var(--t2)"}}>{form.name}</span>
                    <span style={{marginLeft:"auto",fontSize:10,color:"var(--t3)",background:"var(--bg-hover)",padding:"1px 6px",borderRadius:3}}>{form.category}</span>
                  </div>
                )}
              </div>

              {[
                {key:"entry",label:"GIRIS FIYATI ($)",type:"number",ph:"81000"},
                {key:"qty",  label:"MIKTAR",          type:"number",ph:"0.05"},
                {key:"date", label:"GIRIS TARIHI",     type:"date",  ph:""},
              ].map(f=>(
                <div key={f.key}>
                  <label style={{fontSize:11,color:"var(--t3)",display:"block",marginBottom:5,fontWeight:600,letterSpacing:"0.04em"}}>{f.label}</label>
                  <input type={f.type} placeholder={f.ph}
                    value={(form as any)[f.key]}
                    onChange={e=>setForm(prev=>({...prev,[f.key]:e.target.value}))}
                    className="inp" style={{width:"100%",boxSizing:"border-box",padding:"8px 12px"}}/>
                </div>
              ))}
            </div>

            <div style={{display:"flex",gap:10,marginTop:22}}>
              <button onClick={()=>setShowAdd(false)} className="btn-ghost" style={{flex:1,justifyContent:"center"}}>Iptal</button>
              <button className="btn-gold" style={{flex:1,justifyContent:"center",display:"flex",gap:6,alignItems:"center"}}
                disabled={!form.symbol||!form.entry||!form.qty||addMut.isPending}
                onClick={()=>addMut.mutate({asset_id:form.symbol.toLowerCase(),entry_price:+form.entry,quantity:+form.qty,entry_date:form.date,is_simulation:false})}>
                <Plus size={13}/>{addMut.isPending?"Kaydediliyor...":"Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media(max-width:768px){
          .portfolio-grid{grid-template-columns:1fr!important}
          .pos-table th:nth-child(4),.pos-table td:nth-child(4){display:none}
          .pos-table th:nth-child(5),.pos-table td:nth-child(5){display:none}
          .pos-table th:nth-child(7),.pos-table td:nth-child(7){display:none}
        }
        @media(max-width:480px){
          .pos-table th:nth-child(6),.pos-table td:nth-child(6){display:none}
        }
      `}</style>
    </div>
  );
}
