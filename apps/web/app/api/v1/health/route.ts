import { NextResponse } from "next/server";
import { getAuthRuntimeMetadata, getAuthRuntimeWarnings } from "../_lib/auth";

export async function GET() {
  const authWarnings = getAuthRuntimeWarnings();
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
    auth: getAuthRuntimeMetadata(),
    warnings: authWarnings,
  });
}
