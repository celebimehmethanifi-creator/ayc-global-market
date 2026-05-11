import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../_lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const payload = await getUserFromAuthHeader(req);
  if (!payload) {
    return NextResponse.json({ transactions: [], count: 0 });
  }
  return NextResponse.json({
    transactions: [],
    count: 0,
  });
}
