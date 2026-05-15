import { NextRequest } from "next/server";
import { createResponse, resetDemoAccount, resolveDemoIdentity, toView } from "../../_lib/demo-trading";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const identity = await resolveDemoIdentity(req);
  const record = await resetDemoAccount(req, identity);
  return createResponse(identity, {
    ok: true,
    ...toView(record),
    message: "Demo hesap sifirlandi.",
  });
}

