"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Item = { symbol: string; name: string; price: number; change: number; category: string };

const CATEGORIES = [
  { key:"all",      label:"Tümü" },
  { key:"crypto",   label:"Kripto" },
  { key:"us",       label:"ABD" },
  { key:"turkey",   label:"BIST" },
  { key:"forex",    label:"Forex" },
  { key:"precious", label:"Emtia" },
  { key:"index",    label:"Endeks" },
];

const MOCK: Item[] = [
  {symbol:"BTCUSDT",  name:"Bitcoin",       price:94520, change:1.82,  category:"crypto"},
  {symbol:"ETHUSDT",  name:"Ethereum",      price:3210,  change:2.41,  category:"crypto"},
  {symbol:"SOLUSDT",  name:"Solana",        price:172.3, change:3.12,  category:"crypto"},
  {symbol:"AAPL",     name:"Apple",         price:189.5, change:0.71,  category:"us"},
  {symbol:"NVDA",     name:"NVIDIA",        price:875,   change:3.18,  category:"us"},
  {symbol:"TSLA",     name:"Tesla",         price:172.6, change:-2.84, category:"us"},
  {symbol:"MSFT",     name:"Microsoft",     price:430.2, change:1.12,  category:"us"},
  {symbol:"THYAO.IS", name:"THY",           price:286.5, change:1.22,  category:"turkey"},
  {symbol:"ASELS.IS", name:"Aselsan",       price:79.3,  change:-0.81, category:"turkey"},
  {symbol:"EREGL.IS", name:"Ereğli",        price:41.6,  change:2.12,  category:"turkey"},
  {symbol:"XAUUSD",   name:"Altın",         price:2341,  change:0.28,  category:"precious"},
  {symbol:"XAGUSD",   name:"Gümüş",         price:27.85, change:0.78,  category:"precious"},
  {symbol:"EURUSD",   name:"EUR/USD",       price:1.0875,change:-0.12, category:"forex"},
  {symbol:"USDTRY",   name:"USD/TRY",       price:32.45, change:0.48,  category:"forex"},
  {symbol:"SPX",      name:"S&P 500",       price:5248,  change:0.61,  category:"index"},
  {symbol:"XU100",    name:"BIST 100",      price:9285,  change:0.92,  category:"index"},
];

function fmt(p: number) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1)    return p.toFixed(2);
  return p.toFixed(4);
}

export function MarketOverview() {
  const [cat, setCat] = useState("all");
  const [items, setItems] = useState<Item[]>(MOCK);

  useEffect(() => {
    const iv = setInterval(() => {
      setItems(prev => prev.map(item => ({
        ...item,
        price: +(item.price * (1 + (Math.random() - 0.499) * 0.001)),
        change: +(item.change + (Math.random() - 0.5) * 0.05).toFixed(2),
      })));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const filtered = cat === "all" ? items : items.filter(i => i.category === cat);

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-bold" style={{color:"#e8edf5"}}>Piyasa Durumu</h2>
        <div className="w-2 h-2 rounded-full" style={{background:"#16c784",boxShadow:"0 0 6px rgba(22,199,132,0.8)"}}/>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1" style={{scrollbarWidth:"none"}}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={cat === c.key ? {
              background:"rgba(201,160,64,0.15)",color:"#e8bc52",
              border:"1px solid rgba(201,160,64,0.3)"
            } : {
              background:"transparent",color:"#3d4f6b",
              border:"1px solid rgba(255,255,255,0.05)"
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto" style={{minHeight:0}}>
        <table className="data-table w-full">
          <thead><tr>
            <th>Sembol</th>
            <th className="text-right">Fiyat</th>
            <th className="text-right">24s</th>
          </tr></thead>
          <tbody>
            {filtered.map(item => {
              const up = item.change > 0;
              const flat = Math.abs(item.change) < 0.05;
              return (
                <tr key={item.symbol} style={{cursor:"pointer"}}>
                  <td>
                    <div className="font-bold text-[12px]" style={{color:"#e8edf5"}}>{item.symbol.replace(".IS","")}</div>
                    <div className="text-[10px]" style={{color:"#3d4f6b"}}>{item.name}</div>
                  </td>
                  <td className="text-right mono text-[12px]" style={{color:"#e8edf5"}}>
                    {fmt(item.price)}
                  </td>
                  <td className="text-right">
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${flat ? "price-flat" : up ? "price-up" : "price-down"}`}>
                      {flat ? <Minus size={9}/> : up ? <TrendingUp size={9}/> : <TrendingDown size={9}/>}
                      {up && !flat ? "+" : ""}{item.change.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}