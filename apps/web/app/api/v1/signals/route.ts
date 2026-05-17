import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Dev-only static signals: only served when explicitly enabled via flag.
// In production this route returns an empty list — use /api/v1/signals/live for real data.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ENABLE_DEV_SIGNALS = process.env.ENABLE_DEV_SIGNALS === "true";

const STATIC_DEV_SIGNALS = [
  { id:"s1", symbol:"BTCUSDT", name:"Bitcoin",   direction:"LONG",  confidence:88, price:88000, change_24h:1.82, market:"crypto",  reason:"Hacim patlaması + momentum kırılımı.", stage:"TRIGGER" },
  { id:"s2", symbol:"XAUUSD",  name:"Altın",     direction:"LONG",  confidence:85, price:3295,  change_24h:0.28, market:"metal",   reason:"Güvenli liman talebi.", stage:"SETUP" },
  { id:"s3", symbol:"NVDA",    name:"NVIDIA",    direction:"LONG",  confidence:83, price:1085,  change_24h:3.15, market:"stock",   reason:"AI chip döngüsü.", stage:"TRIGGER" },
  { id:"s4", symbol:"ETHUSDT", name:"Ethereum",  confidence:72, direction:"LONG", price:2340,  change_24h:2.41, market:"crypto",  reason:"DeFi büyümesi.", stage:"WATCH" },
  { id:"s5", symbol:"TSLA",    name:"Tesla",     direction:"SHORT", confidence:76, price:285,   change_24h:-2.84,market:"stock",   reason:"Direnç kırılamadı.", stage:"SETUP" },
];

export async function GET(req: NextRequest) {
  if (IS_PRODUCTION && !ENABLE_DEV_SIGNALS) {
    return NextResponse.json({
      items: [],
      count: 0,
      updated_at: new Date().toISOString(),
      source: "static_disabled",
      warning: "Static signal source disabled in production. Use /api/v1/signals/live for real data.",
    });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "14"), 50);
  return NextResponse.json({
    items: STATIC_DEV_SIGNALS.slice(0, limit),
    count: STATIC_DEV_SIGNALS.length,
    updated_at: new Date().toISOString(),
    source: "static_dev",
  });
}
