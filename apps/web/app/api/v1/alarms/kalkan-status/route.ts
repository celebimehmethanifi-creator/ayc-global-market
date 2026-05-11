import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    active_kalkan_blocks: [],
    kalkan_status: "normal",
    message: "Kalkan sistemi normal — aktif blok yok",
  });
}
