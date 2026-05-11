import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FEATURED = [
  { id:"f1", symbol:"BTCUSDT", name:"Bitcoin",   direction:"LONG",  confidence:88, price:88000, change_24h:1.82, reason:"Hacim patlaması + momentum kırılımı.", market:"crypto" },
  { id:"f2", symbol:"XAUUSD",  name:"Altın",     direction:"LONG",  confidence:85, price:3295,  change_24h:0.28, reason:"Güvenli liman talebi + Fed belirsizliği.", market:"metal" },
  { id:"f3", symbol:"NVDA",    name:"NVIDIA",    direction:"LONG",  confidence:83, price:1085,  change_24h:3.15, reason:"AI chip döngüsü + kurumsal birikim.", market:"stock" },
];

export async function GET(req: NextRequest) {
  return NextResponse.json({
    featured: FEATURED,
    count: FEATURED.length,
    updated_at: new Date().toISOString(),
  });
}
