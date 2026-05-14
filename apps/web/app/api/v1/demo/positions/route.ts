import { NextRequest } from "next/server";
import { createResponse, getSynchronizedRecord, resolveDemoIdentity } from "../../_lib/demo-trading";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const identity = await resolveDemoIdentity(req);
  const record = await getSynchronizedRecord(req, identity);
  return createResponse(identity, {
    ok: true,
    mode: "demo",
    positions: record.positions,
    count: record.positions.length,
    updatedAt: record.account.updatedAt,
  });
}

