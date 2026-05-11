import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../_lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) {
    return NextResponse.json({ detail: "Yetkisiz erisim" }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    message: "Abonelik iptal edildi",
    cancelled_at: new Date().toISOString(),
  });
}
