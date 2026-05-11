import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "AYC Global Market API",
    version: "1.0.0",
    ts: new Date().toISOString(),
    features: {
      auth: true,
      signals: true,
      news: true,
      realtime_prices: true,
    },
  });
}
