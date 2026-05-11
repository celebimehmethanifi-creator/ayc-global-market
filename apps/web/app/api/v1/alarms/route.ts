import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../_lib/auth";

export const dynamic = "force-dynamic";

// In-memory alarm store (per process — resets on cold start)
declare global { var __AYC_ALARMS: any[]; }
if (!globalThis.__AYC_ALARMS) globalThis.__AYC_ALARMS = [];

export async function GET(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  const userId = payload?.sub || "guest";
  const alarms = globalThis.__AYC_ALARMS.filter((a: any) => a.user_id === userId);
  return NextResponse.json({ alarms, count: alarms.length });
}

export async function POST(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  const userId = payload?.sub || "guest";
  const body = await req.json();
  const alarm = {
    id: "a_" + Date.now().toString(36),
    user_id: userId,
    alarm_type: body.alarm_type || "price",
    condition: body.condition || {},
    is_active: true,
    created_at: new Date().toISOString(),
  };
  globalThis.__AYC_ALARMS.push(alarm);
  return NextResponse.json({ alarm, success: true }, { status: 201 });
}
