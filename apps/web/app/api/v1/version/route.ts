import { NextResponse } from "next/server";
import { getVersionInfo } from "../_lib/version-info";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const body = getVersionInfo();
  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
