import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SIGNALS: Record<string, any> = {
  s1: { id:"s1", symbol:"BTCUSDT", name:"Bitcoin",  direction:"LONG",  confidence:88, price:88000, change_24h:1.82, market:"crypto",  reason:"Hacim patlaması + momentum kırılımı. 5/6 motor LONG.", stage:"TRIGGER", timeframe:"4H", risk_score:35 },
  s2: { id:"s2", symbol:"XAUUSD",  name:"Altın",    direction:"LONG",  confidence:85, price:3295,  change_24h:0.28, market:"metal",   reason:"Güvenli liman talebi + Fed belirsizliği.", stage:"SETUP",   timeframe:"1D", risk_score:28 },
  s3: { id:"s3", symbol:"NVDA",    name:"NVIDIA",   direction:"LONG",  confidence:83, price:1085,  change_24h:3.15, market:"stock",   reason:"AI chip döngüsü + kurumsal birikim.", stage:"TRIGGER", timeframe:"1W", risk_score:32 },
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sig = SIGNALS[params.id];
  if (!sig) {
    return NextResponse.json({ detail: "Sinyal bulunamadi" }, { status: 404 });
  }
  return NextResponse.json(sig);
}
