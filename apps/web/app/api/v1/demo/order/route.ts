import { NextRequest } from "next/server";
import { createResponse, placeDemoOrder, resolveDemoIdentity } from "../../_lib/demo-trading";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const identity = await resolveDemoIdentity(req);
  const body = await req.json().catch(() => ({}));
  const result = await placeDemoOrder(req, identity, body);
  return createResponse(identity, result.payload, result.status);
}

