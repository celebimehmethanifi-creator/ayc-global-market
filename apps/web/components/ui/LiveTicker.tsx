"use client";
import { useEffect, useState, useRef } from "react";

interface TickerItem {
  symbol: string;
  name: string;
  price: number;
  chg: number;
  category: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "";
const REFRESH_MS = 60_000;

function fmt(p: number): string {
  if (p <= 0) return "—";
  if (p >= 100000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 10000)  return p.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (p >= 1000)   return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)      return p.toFixed(2);
  if (p >= 0.01)   return p.toFixed(4);
  return p.toFixed(6);
}

export function LiveTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchTicker = async () => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await fetch(`${API}/api/v1/markets/ticker`, { signal: ctrl.signal, cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      const tickers: TickerItem[] = (d.tickers || [])
        .filter((t: any) => t.price > 0)
        .map((t: any): TickerItem => ({
          symbol: t.symbol,
          name: t.name || t.symbol,
          price: t.price,
          chg: isNaN(t.chg) ? 0 : t.chg,
          category: t.category || "",
        }))
        .sort((a: TickerItem, b: TickerItem) => b.chg - a.chg);
      if (tickers.length > 0) { setItems(tickers); setLoading(false); }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchTicker();
    const t = setInterval(fetchTicker, REFRESH_MS);
    return () => { clearInterval(t); abortRef.current?.abort(); };
  }, []);

  if (loading || items.length === 0) {
    return (
      <div style={{
        height:"var(--ticker-h,32px)", background:"var(--bg-panel,#0C0E16)",
        borderBottom:"1px solid var(--b1,rgba(255,255,255,0.06))",
        display:"flex", alignItems:"center", paddingLeft:16, gap:8,
      }}>
        {[0,1,2,3,4,5,6,7].map(i=>(
          <div key={i} style={{
            width:80, height:14, borderRadius:4,
            background:"rgba(255,255,255,0.05)",
            animation:`pulse 1.4s ease-in-out ${i*0.1}s infinite`,
          }} />
        ))}
      </div>
    );
  }

  const doubled = [...items, ...items]; // doubled: seamless loop at -50%
  const speed = Math.max(40, items.length * 4);

  return (
    <div style={{
      height:"var(--ticker-h,32px)",
      background:"var(--bg-panel,#0C0E16)",
      borderBottom:"1px solid var(--b1,rgba(255,255,255,0.06))",
      overflow:"hidden", position:"relative",
      display:"flex", alignItems:"center",
    }}>
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:32, background:"linear-gradient(to right,var(--bg-panel,#0C0E16),transparent)", zIndex:2, pointerEvents:"none" }} />
      <div style={{ position:"absolute", right:0, top:0, bottom:0, width:32, background:"linear-gradient(to left,var(--bg-panel,#0C0E16),transparent)", zIndex:2, pointerEvents:"none" }} />
      <div
        className="ticker-track"
        style={{
          display:"flex",
          animation:`ticker-scroll ${speed}s linear infinite`,
          whiteSpace:"nowrap",
          willChange:"transform",
        }}
      >
        {doubled.map((item,i)=>{
          const up=item.chg>=0;
          return (
            <span key={`${item.symbol}-${i}`} style={{
              display:"inline-flex", alignItems:"center", gap:5,
              padding:"0 14px", height:"var(--ticker-h,32px)",
              borderRight:"1px solid var(--b1,rgba(255,255,255,0.06))",
              flexShrink:0,
            }}>
              <span style={{ fontFamily:"var(--font-mono,'IBM Plex Mono',monospace)", fontSize:10, fontWeight:700, color:"var(--t2,#9BA3BA)", letterSpacing:"0.04em" }}>{item.symbol}</span>
              <span style={{ fontFamily:"var(--font-mono,'IBM Plex Mono',monospace)", fontSize:11, fontWeight:600, color:"var(--t1,#F0F2F8)", letterSpacing:"0.02em" }}>{fmt(item.price)}</span>
              <span style={{ fontFamily:"var(--font-mono,'IBM Plex Mono',monospace)", fontSize:10, fontWeight:700, color:up?"var(--up,#0ECB81)":"var(--down,#F6465D)", letterSpacing:"0.01em" }}>
                {up?"+":""}{item.chg.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

