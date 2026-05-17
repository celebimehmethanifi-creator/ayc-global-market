import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../_lib/auth";

export const dynamic = "force-dynamic";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOW_CANCEL_INSECURE_FOR_TESTS =
  process.env.ALLOW_CANCEL_INSECURE_FOR_TESTS === "true";

export async function POST(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) {
    return NextResponse.json({ detail: "Yetkisiz erisim" }, { status: 401 });
  }

  if (IS_PRODUCTION) {
    return NextResponse.json(
      {
        success: false,
        detail: "Canli abonelik iptali bu endpointte desteklenmiyor. Provider backend gerekli.",
      },
      { status: 503 },
    );
  }

  if (!ALLOW_CANCEL_INSECURE_FOR_TESTS) {
    return NextResponse.json(
      {
        success: false,
        detail: "Test iptal endpointi kapali. Bypass icin ALLOW_CANCEL_INSECURE_FOR_TESTS=true gerekli.",
      },
      { status: 501 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Test ortaminda abonelik iptal simule edildi",
    cancelled_at: new Date().toISOString(),
  });
}
