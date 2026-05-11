import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SIGNALS = [
  { id:"s1", symbol:"BTCUSDT", name:"Bitcoin",   direction:"LONG",  confidence:88, price:88000, change_24h:1.82, market:"crypto",  reason:"Hacim patlaması + momentum kırılımı.", stage:"TRIGGER" },
  { id:"s2", symbol:"XAUUSD",  name:"Altın",     direction:"LONG",  confidence:85, price:3295,  change_24h:0.28, market:"metal",   reason:"Güvenli liman talebi.", stage:"SETUP" },
  { id:"s3", symbol:"NVDA",    name:"NVIDIA",    direction:"LONG",  confidence:83, price:1085,  change_24h:3.15, market:"stock",   reason:"AI chip döngüsü.", stage:"TRIGGER" },
  { id:"s4", symbol:"ETHUSDT", name:"Ethereum",  direction:"LONG",  confidence:72, price:2340,  change_24h:2.41, market:"crypto",  reason:"DeFi büyümesi.", stage:"WATCH" },
  { id:"s5", symbol:"TSLA",    name:"Tesla",     direction:"SHORT", confidence:76, price:285,   change_24h:-2.84,market:"stock",   reason:"Direnç kırılamadı.", stage:"SETUP" },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "14"), 50);
  return NextResponse.json({
    items: SIGNALS.slice(0, limit),
    count: SIGNALS.length,
    updated_at: new Date().toISOString(),
  });
}
