import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ASSETS = [
  { id:"a1", symbol:"BTCUSDT", name:"Bitcoin",   category:"crypto",  price:88000, change_24h:1.82, market_cap:1750000000000 },
  { id:"a2", symbol:"ETHUSDT", name:"Ethereum",  category:"crypto",  price:2340,  change_24h:2.41, market_cap:281000000000 },
  { id:"a3", symbol:"SOLUSDT", name:"Solana",    category:"crypto",  price:200,   change_24h:4.81, market_cap:94000000000 },
  { id:"a4", symbol:"BNBUSDT", name:"BNB Chain", category:"crypto",  price:620,   change_24h:1.05, market_cap:90000000000 },
  { id:"a5", symbol:"XRPUSDT", name:"XRP",       category:"crypto",  price:2.45,  change_24h:0.82, market_cap:141000000000 },
  { id:"a6", symbol:"AAPL",    name:"Apple",     category:"stock",   price:213.5, change_24h:0.35, market_cap:3260000000000 },
  { id:"a7", symbol:"NVDA",    name:"NVIDIA",    category:"stock",   price:1085,  change_24h:3.15, market_cap:2680000000000 },
  { id:"a8", symbol:"TSLA",    name:"Tesla",     category:"stock",   price:285,   change_24h:-2.84,market_cap:910000000000 },
  { id:"a9", symbol:"XAUUSD",  name:"Altın",     category:"metal",   price:3295,  change_24h:0.28, market_cap:0 },
  { id:"a10",symbol:"THYAO",   name:"THY",       category:"bist",    price:286.5, change_24h:1.20, market_cap:0 },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
  const category = searchParams.get("category");
  const filtered = category ? ASSETS.filter(a => a.category === category) : ASSETS;
  return NextResponse.json({
    items: filtered.slice(0, limit),
    count: filtered.length,
    updated_at: new Date().toISOString(),
  });
}
