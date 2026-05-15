import { NextRequest } from "next/server";
import { createResponse, getSynchronizedRecord, resolveDemoIdentity } from "../../_lib/demo-trading";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const identity = await resolveDemoIdentity(req);
  const record = await getSynchronizedRecord(req, identity);
  return createResponse(identity, {
    ok: true,
    mode: "demo",
    balance: {
      balance: record.account.balance,
      equity: record.account.equity,
      availableBalance: record.account.availableBalance,
      usedMargin: record.account.usedMargin,
      openPnL: record.account.openPnL,
      realizedPnL: record.account.realizedPnL,
      totalPnL: record.account.totalPnL,
      winRate: record.account.winRate,
      updatedAt: record.account.updatedAt,
    },
    warning: "Demo state is stored in-memory and can reset after redeploy/cold start.",
  });
}

