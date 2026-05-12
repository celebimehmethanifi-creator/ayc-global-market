"use client";
import { usePrices } from "@/lib/prices/PriceContext";

/* Map market/SEED symbols -> PriceContext keys */
const PRICE_KEY: Record<string,string> = {
  "GC=F":"XAUUSD","SI=F":"XAGUSD","PL=F":"XPTUSD",
  "CL=F":"WTIUSD","BZ=F":"BRENT","NG=F":"NATGAS",
  "EURUSD=X":"EURUSD","USDJPY=X":"USDJPY","USDTRY=X":"USDTRY",
  "JPY=X":"USDJPY","CHF=X":"USDCHF","CAD=X":"USDCAD","GBPUSD=X":"GBPUSD",
  "^GSPC":"SPX","^DJI":"DJI","^NDX":"NDX","^GDAXI":"DAX","^FTSE":"FTSE","^VIX":"VIX",
  "XU100.IS":"BIST100","THYAO.IS":"THYAO","GARAN.IS":"GARAN",
  "AKBNK.IS":"AKBNK","ASELS.IS":"ASELS","EREGL.IS":"EREGL",
};
import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, ArrowDownRight, RefreshCw, Search, TrendingUp, SlidersHorizontal } from "lucide-react";
import { AssetDetailModal } from "@/components/ui/AssetDetailModal";
import type { AssetInfo } from "@/components/ui/AssetDetailModal";

const API = "/api/v1";

type Asset = {
  symbol:string; display?:string; name:string;
  price:number; chg:number; chg7d?:number;
  vol?:string; mcap?:string; market?:string;
};

const CATS = [
  {k:"all",l:"Tüm Piyasalar"},{k:"crypto",l:"Kripto"},{k:"us",l:"ABD Borsası"},
  {k:"turkey",l:"BIST"},{k:"precious",l:"Emtia"},{k:"energy",l:"Enerji"},
  {k:"forex",l:"Forex"},{k:"index",l:"Endeksler"},
];

const SEED: Asset[] = [
  {symbol:"BTCUSDT",display:"BTC",name:"Bitcoin",price:94520,chg:2.14,chg7d:5.4,vol:"42.6B",mcap:"1.85T",market:"crypto"},
  {symbol:"ETHUSDT",display:"ETH",name:"Ethereum",price:3218,chg:3.42,chg7d:8.1,vol:"18.2B",mcap:"386B",market:"crypto"},
  {symbol:"SOLUSDT",display:"SOL",name:"Solana",price:172.4,chg:4.81,chg7d:12.3,vol:"2.1B",mcap:"79B",market:"crypto"},
  {symbol:"BNBUSDT",display:"BNB",name:"BNB",price:587.3,chg:1.22,chg7d:3.2,vol:"1.4B",mcap:"88B",market:"crypto"},
  {symbol:"XRPUSDT",display:"XRP",name:"Ripple",price:0.5241,chg:-1.14,chg7d:-2.8,vol:"1.9B",mcap:"29B",market:"crypto"},
  {symbol:"AVAXUSDT",display:"AVAX",name:"Avalanche",price:36.4,chg:2.85,chg7d:7.1,vol:"0.8B",mcap:"15B",market:"crypto"},
  {symbol:"DOGEUSDT",display:"DOGE",name:"Dogecoin",price:0.162,chg:1.45,chg7d:3.8,vol:"1.2B",mcap:"23B",market:"crypto"},
  {symbol:"ADAUSDT",display:"ADA",name:"Cardano",price:0.461,chg:-0.82,chg7d:1.2,vol:"0.6B",mcap:"16B",market:"crypto"},
  {symbol:"AAPL",display:"AAPL",name:"Apple",price:211,chg:0.72,chg7d:1.8,vol:"8.4B",mcap:"2.9T",market:"us"},
  {symbol:"NVDA",display:"NVDA",name:"NVIDIA",price:1085,chg:3.15,chg7d:9.4,vol:"12.1B",mcap:"2.16T",market:"us"},
  {symbol:"TSLA",display:"TSLA",name:"Tesla",price:285,chg:-2.84,chg7d:-6.1,vol:"8.7B",mcap:"549B",market:"us"},
  {symbol:"MSFT",display:"MSFT",name:"Microsoft",price:435,chg:0.42,chg7d:1.2,vol:"6.2B",mcap:"3.06T",market:"us"},
  {symbol:"AMZN",display:"AMZN",name:"Amazon",price:209,chg:1.18,chg7d:3.5,vol:"5.1B",mcap:"1.92T",market:"us"},
  {symbol:"META",display:"META",name:"Meta",price:588,chg:1.64,chg7d:4.2,vol:"4.3B",mcap:"1.28T",market:"us"},
  {symbol:"GOOGL",display:"GOOGL",name:"Alphabet",price:175,chg:0.89,chg7d:2.1,vol:"3.8B",mcap:"2.18T",market:"us"},
  {symbol:"THYAO.IS",display:"THYAO",name:"Türk Hava Yol.",price:286.5,chg:1.14,chg7d:4.2,vol:"2.8B",mcap:"248B",market:"turkey"},
  {symbol:"GARAN.IS",display:"GARAN",name:"Garanti BBVA",price:98.4,chg:0.91,chg7d:2.1,vol:"1.2B",mcap:"41B",market:"turkey"},
  {symbol:"AKBNK.IS",display:"AKBNK",name:"Akbank",price:54.7,chg:0.55,chg7d:1.4,vol:"0.9B",mcap:"44B",market:"turkey"},
  {symbol:"ASELS.IS",display:"ASELS",name:"Aselsan",price:47.2,chg:1.80,chg7d:5.6,vol:"0.5B",mcap:"25B",market:"turkey"},
  {symbol:"EREGL.IS",display:"EREGL",name:"Ereğli Demir",price:42.8,chg:-0.46,chg7d:-1.2,vol:"0.7B",mcap:"36B",market:"turkey"},
  {symbol:"GC=F",display:"XAU/USD",name:"Altın",price:3295,chg:0.31,chg7d:1.4,market:"precious"},
  {symbol:"SI=F",display:"XAG/USD",name:"Gümüş",price:32.5,chg:0.74,chg7d:3.1,market:"precious"},
  {symbol:"CL=F",display:"WTI",name:"Ham Petrol",price:78.5,chg:-0.62,chg7d:-1.8,market:"energy"},
  {symbol:"BZ=F",display:"BRENT",name:"Brent Petrol",price:82.2,chg:-0.44,chg7d:-1.2,market:"energy"},
  {symbol:"EURUSD=X",display:"EUR/USD",name:"Euro / Dolar",price:1.0875,chg:-0.11,chg7d:-0.4,market:"forex"},
  {symbol:"USDJPY=X",display:"USD/JPY",name:"Dolar / Yen",price:145.5,chg:0.22,chg7d:0.9,market:"forex"},
  {symbol:"USDTRY=X",display:"USD/TRY",name:"Dolar / Lira",price:38.5,chg:0.48,chg7d:1.6,market:"forex"},
  {symbol:"^GSPC",display:"SPX",name:"S&P 500",price:5600,chg:0.58,chg7d:1.9,market:"index"},
  {symbol:"^NDX",display:"NDX",name:"NASDAQ 100",price:19800,chg:0.91,chg7d:3.2,market:"index"},
  {symbol:"XU100.IS",display:"BIST100",name:"BIST 100",price:9500,chg:0.87,chg7d:2.4,market:"index"},
];

function fmtP(p:number) {
  if (!p&&p!==0) return "-";
  if (p>=10000) return p.toLocaleString("en",{maximumFractionDigits:0});
  if (p>=1000)  return p.toLocaleString("en",{minimumFractionDigits:1,maximumFractionDigits:1});
  if (p>=1)     return p.toFixed(2);
  return p.toFixed(4);
}
function getSym(a:Asset) { return a.display||a.symbol; }
function getMarket(a:Asset) { return (a.market||"").toLowerCase(); }
function toAssetInfo(a:Asset): AssetInfo {
  return { symbol:a.symbol, display:getSym(a), name:a.name, price:a.price, chg:a.chg, market:getMarket(a) };
}

export default function MarketPage() {
  const [cat,     setCat]     = useState("all");
  const [data,    setData]    = useState<Asset[]>(SEED);
  const [search,  setSearch]  = useState("");
  const [sortKey, setSort]    = useState<"chg"|"price"|"name"|"chg7d">("chg");
  const [sortDir, setSortDir] = useState<1|-1>(-1);
  const [loading, setLoading] = useState(false);
  const [apiOk,   setApiOk]   = useState<boolean|null>(null);
  const [selected,setSelected]= useState<AssetInfo|null>(null);
  const livePrices = usePrices();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/brain/scan?market=${cat}&limit=100`,{signal:AbortSignal.timeout(8000)});
      if (!r.ok) throw new Error();
      const d = await r.json();
      const items:Asset[] = (d.items||[]).map((s:any):Asset=>({
        symbol:s.symbol, display:s.display||s.symbol, name:s.name||s.symbol,
        price:s.current_price||s.price||0, chg:s.change_pct||s.chg||0,
        chg7d:s.change_7d||0, vol:s.volume_label||"-", market:s.market||s.assetClass||"",
      }));
      if (items.length>0) {
        // Merge: update prices for known symbols, add new ones — never remove SEED categories
        const apiMap = new Map(items.map((i:Asset) => [i.symbol, i]));
        setData(prev => {
          const updated = prev.map(a => {
            const u = apiMap.get(a.symbol);
            if (u && u.price > 0) return { ...a, price: u.price, chg: u.chg, chg7d: u.chg7d||a.chg7d, vol: u.vol||a.vol };
            return a;
          });
          const existing = new Set(prev.map(a => a.symbol));
          const newItems = items.filter((i:Asset) => !existing.has(i.symbol));
          return [...updated, ...newItems];
        });
        setApiOk(true);
      }
      else setApiOk(true);
    } catch {
      setApiOk(false);
      setData(p=>p.map(a=>({...a,price:+(a.price*(1+(Math.random()-0.499)*0.0005)),chg:+(a.chg+(Math.random()-0.5)*0.06)})));
    } finally { setLoading(false); }
  },[cat]);

  useEffect(()=>{fetchData();const iv=setInterval(fetchData,30000);return()=>clearInterval(iv);},[fetchData]);

  // Overlay Binance WS / Finnhub live prices (faster than REST poll)
  useEffect(()=>{
    if(Object.keys(livePrices).length===0) return;
    setData(prev=>prev.map(a=>{
      const pkey = PRICE_KEY[a.symbol] ?? a.symbol;
      const lp = livePrices[pkey] ?? livePrices[a.symbol] ?? livePrices[a.symbol+"USDT"];
      if(!lp) return a;
      const sc = (v:any)=>{const n=Number(v);return isFinite(n)?n:0;};
      const liveChg = sc(lp.chg); return {...a, price:lp.price||a.price, chg:liveChg!==0?liveChg:a.chg};
    }));
  },[livePrices]);

  const toggleSort=(k:typeof sortKey)=>{
    if(k===sortKey)setSortDir(d=>d===-1?1:-1); else{setSort(k);setSortDir(-1);}
  };

  let rows=data;
  if(cat!=="all") rows=rows.filter(a=>getMarket(a)===cat);
  if(search.trim()){const q=search.toLowerCase();rows=rows.filter(a=>getSym(a).toLowerCase().includes(q)||a.name.toLowerCase().includes(q));}
  rows=[...rows].sort((a,b)=>{
    if(sortKey==="name") return sortDir*(getSym(a)<getSym(b)?-1:1);
    const va=sortKey==="price"?a.price:sortKey==="chg7d"?(a.chg7d||0):a.chg;
    const vb=sortKey==="price"?b.price:sortKey==="chg7d"?(b.chg7d||0):b.chg;
    return sortDir*(vb-va);
  });

  function SortHdr({k,children}:{k:typeof sortKey,children:React.ReactNode}){
    const a=sortKey===k;
    return(<th className="right" onClick={()=>toggleSort(k)} style={{cursor:"pointer",userSelect:"none",color:a?"var(--gold)":"var(--t3)"}}>{children}{a?(sortDir===-1?" ↓":" ↑"):""}</th>);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,rowGap:12}}>
        <div>
          <h1 style={{fontFamily:"var(--font-head)",fontSize:"18px",fontWeight:800,color:"var(--t1)"}}>Piyasalar</h1>
          <div style={{fontSize:"11px",color:"var(--t3)",marginTop:2}}>{rows.length} enstrüman · {apiOk?"Canlı":"Demo"} · Üstüne tıklayın → Detay + AI Analiz</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{position:"relative"}}>
            <Search size={12} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"var(--t3)"}}/>
            <input className="inp" style={{paddingLeft:28,width:"100%",maxWidth:200,minWidth:120}} placeholder="Sembol ara..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <button onClick={fetchData} disabled={loading} className="btn-ghost">
            <RefreshCw size={12} style={{animation:loading?"spin 0.8s linear infinite":""}}/>
          </button>
        </div>
      </div>

      <div className="cat-pills">
        {CATS.map(c=>(<button key={c.k} className={`cat-pill${cat===c.k?" active":""}`} onClick={()=>setCat(c.k)}>{c.l}</button>))}
      </div>

      <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-lg)",overflow:"hidden"}}>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <table className="market-table" style={{minWidth:520}}>
          <thead><tr>
            <th style={{width:36,padding:"8px 8px 8px 14px"}}>#</th>
            <th onClick={()=>toggleSort("name")} style={{cursor:"pointer",userSelect:"none",color:sortKey==="name"?"var(--gold)":"var(--t3)"}}>Varlık</th>
            <SortHdr k="price">Fiyat</SortHdr>
            <SortHdr k="chg">24s%</SortHdr>
            <SortHdr k="chg7d">7G%</SortHdr>
            <th className="right">Hacim</th>
            <th className="right">Piyasa</th>
          </tr></thead>
          <tbody>
            {rows.map((a,i)=>{
              const up=(a.chg||0)>=0;const u7=(a.chg7d||0)>=0;
              return(
                <tr key={a.symbol} onClick={()=>setSelected(toAssetInfo(a))}
                  style={{cursor:"pointer"}} className="fade-in"
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=""}>
                  <td style={{color:"var(--t4)",fontSize:"11px",paddingLeft:14,fontFamily:"var(--font-mono)"}}>{i+1}</td>
                  <td><div style={{display:"flex",flexDirection:"column",gap:2}}>
                    <span style={{fontFamily:"var(--font-mono)",fontWeight:700,fontSize:"12px",color:"var(--t1)"}}>{getSym(a)}</span>
                    <span style={{fontSize:"10px",color:"var(--t3)"}}>{a.name}</span>
                  </div></td>
                  <td className="price right">{fmtP(a.price)}</td>
                  <td className={`chg right ${up?"chg-up":"chg-down"}`}>{up?"+":""}{(isFinite(Number(a.chg))?Number(a.chg):0).toFixed(2)}%</td>
                  <td className={`right ${u7?"chg-up":"chg-down"}`} style={{fontFamily:"var(--font-mono)",fontSize:"11px",fontWeight:600}}>{a.chg7d!=null?(u7?"+":"")+a.chg7d.toFixed(2)+"%":"-"}</td>
                  <td className="right" style={{fontSize:"11px",color:"var(--t3)",fontFamily:"var(--font-mono)"}}>{a.vol||"-"}</td>
                  <td className="right"><span style={{fontSize:"9px",fontWeight:600,background:"var(--bg-hover)",border:"1px solid var(--b1)",padding:"2px 6px",borderRadius:3,color:"var(--t3)",fontFamily:"var(--font-mono)",letterSpacing:"0.04em"}}>{getMarket(a).toUpperCase()||"-"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {rows.length===0&&(<div style={{padding:"40px",textAlign:"center",color:"var(--t3)"}}><TrendingUp size={28} style={{marginBottom:8,opacity:0.3}}/><br/>Veri bulunamadi</div>)}
      </div>

      <AssetDetailModal asset={selected} onClose={()=>setSelected(null)}/>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(max-width:640px){
          .market-table th:nth-child(5),.market-table td:nth-child(5){display:none}
          .market-table th:nth-child(6),.market-table td:nth-child(6){display:none}
          .market-table th:nth-child(7),.market-table td:nth-child(7){display:none}
          .cat-pills{flex-wrap:nowrap!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px}
          .cat-pills::-webkit-scrollbar{display:none}
        }
      `}</style>
    </div>
  );
}


