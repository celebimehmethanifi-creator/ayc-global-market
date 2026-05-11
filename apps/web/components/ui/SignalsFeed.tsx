"use client";
import { useEffect, useState } from "react";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";

type Signal = {
  id: number; symbol: string; name: string; direction: "LONG"|"SHORT"|"NEUTRAL";
  confidence: number; price: number; category: string; reason: string;
};

const MOCK: Signal[] = [
  {id:1,symbol:"BTCUSDT", name:"Bitcoin",  direction:"LONG",    confidence:88, price:94520, category:"crypto",   reason:"Momentum kırılımı + hacim artışı"},
  {id:2,symbol:"NVDA",    name:"NVIDIA",   direction:"LONG",    confidence:82, price:875,   category:"us",       reason:"Kazanç sezonu öncesi birikim"},
  {id:3,symbol:"TSLA",    name:"Tesla",    direction:"SHORT",   confidence:74, price:172.6, category:"us",       reason:"Direnç bölgesi + zayıf momentum"},
  {id:4,symbol:"XAUUSD",  name:"Altın",    direction:"LONG",    confidence:79, price:2341,  category:"precious", reason:"Fed faiz beklentisi + jeopolitik"},
  {id:5,symbol:"THYAO.IS",name:"THY",      direction:"LONG",    confidence:71, price:286.5, category:"turkey",   reason:"Teknik destek + turizm sezonu"},
  {id:6,symbol:"SOLUSDT", name:"Solana",   direction:"LONG",    confidence:85, price:172.3, category:"crypto",   reason:"DeFi büyümesi + NFT patlaması"},
  {id:7,symbol:"EURUSD",  name:"EUR/USD",  direction:"SHORT",   confidence:68, price:1.0875,category:"forex",    reason:"USD güçlenmesi beklentisi"},
  {id:8,symbol:"AAPL",    name:"Apple",    direction:"NEUTRAL", confidence:62, price:189.5, category:"us",       reason:"Konsolidasyon bölgesi"},
];

const DIR_STYLE = {
  LONG:    {bg:"rgba(22,199,132,0.1)", color:"#16c784", border:"rgba(22,199,132,0.25)"},
  SHORT:   {bg:"rgba(234,57,67,0.1)",  color:"#ea3943", border:"rgba(234,57,67,0.25)"},
  NEUTRAL: {bg:"rgba(201,160,64,0.1)", color:"#c9a040", border:"rgba(201,160,64,0.25)"},
};

export function SignalsFeed({ compact = false }: { compact?: boolean }) {
  const [signals, setSignals] = useState<Signal[]>(MOCK);
  const [filter, setFilter] = useState<"ALL"|"LONG"|"SHORT">("ALL");

  useEffect(() => {
    const iv = setInterval(() => {
      setSignals(prev => prev.map(s => ({...s, confidence: Math.min(99, Math.max(50, s.confidence + Math.floor((Math.random()-0.5)*3)))})));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = filter === "ALL" ? signals : signals.filter(s => s.direction === filter);
  const list = compact ? filtered.slice(0,5) : filtered;

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={14} style={{color:"#e8bc52"}}/>
          <h2 className="text-[13px] font-bold" style={{color:"#e8edf5"}}>
            {compact ? "Son Sinyaller" : "Tüm Sinyaller"}
          </h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-black"
                style={{background:"rgba(201,160,64,0.15)",color:"#c9a040"}}>
            {filtered.length} AKTİF
          </span>
        </div>
        {!compact && (
          <div className="flex gap-1">
            {(["ALL","LONG","SHORT"] as const).map(d => (
              <button key={d} onClick={() => setFilter(d)}
                className="px-2 py-0.5 rounded text-[9px] font-black transition-all"
                style={filter === d ? {background:"rgba(201,160,64,0.15)",color:"#e8bc52"} : {color:"#3d4f6b"}}>
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5" style={{minHeight:0}}>
        {list.map(sig => {
          const ds = DIR_STYLE[sig.direction];
          const Icon = sig.direction === "SHORT" ? TrendingDown : TrendingUp;
          return (
            <div key={sig.id} className="signal-card">
              <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                   style={{background:ds.bg, border:`1px solid ${ds.border}`}}>
                <Icon size={14} style={{color:ds.color}}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-black text-[12px]" style={{color:"#e8edf5"}}>{sig.symbol}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase"
                        style={{background:ds.bg, color:ds.color, border:`1px solid ${ds.border}`}}>
                    {sig.direction}
                  </span>
                  <span className="text-[10px]" style={{color:"#3d4f6b"}}>{sig.category}</span>
                </div>
                {!compact && <div className="text-[10px] truncate" style={{color:"#6b7fa0"}}>{sig.reason}</div>}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[11px] font-black" style={{color:ds.color}}>{sig.confidence}%</div>
                <div className="conf-bar mt-1">
                  <div className="conf-bar-fill" style={{
                    width:`${sig.confidence}%`,
                    background: sig.confidence >= 80 ? "linear-gradient(90deg,#16c784,#4ade80)"
                              : sig.confidence >= 65 ? "linear-gradient(90deg,#c9a040,#e8bc52)"
                              : "linear-gradient(90deg,#ea3943,#f87171)"
                  }}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}