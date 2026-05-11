import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (typeof globalThis.__AYC_ALARMS !== "undefined") {
    globalThis.__AYC_ALARMS = globalThis.__AYC_ALARMS.filter((a: any) => a.id !== id);
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const body = await req.json();
  if (typeof globalThis.__AYC_ALARMS !== "undefined") {
    const idx = globalThis.__AYC_ALARMS.findIndex((a: any) => a.id === id);
    if (idx >= 0) {
      globalThis.__AYC_ALARMS[idx] = { ...globalThis.__AYC_ALARMS[idx], ...body };
    }
  }
  return NextResponse.json({ success: true });
}
