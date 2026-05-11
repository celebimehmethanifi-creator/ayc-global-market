import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { direction } = body;
  return NextResponse.json({
    success: true,
    id: params.id,
    direction,
    message: "Oy kaydedildi",
  });
}
