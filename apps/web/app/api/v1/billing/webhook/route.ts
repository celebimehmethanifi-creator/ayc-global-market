import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const WEBHOOK_SECRET = (process.env.LEMON_WEBHOOK_SECRET || "").trim();
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const digest = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  const left = Buffer.from(digest, "utf8");
  const right = Buffer.from(signature, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function POST(req: NextRequest) {
  if (IS_PRODUCTION && !WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret zorunlu." },
      { status: 503 },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("x-signature") || "";

  if (WEBHOOK_SECRET && !verifySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (IS_PRODUCTION && !WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook dogrulamasi kapali olamaz." }, { status: 503 });
  }

  try {
    const event = JSON.parse(body);
    const evt = event as Record<string, unknown>;
    const meta = evt?.meta as Record<string, unknown> | undefined;
    const eventName = String(meta?.event_name || "");
    const customData = (meta?.custom_data as Record<string, string>) || {};
    const plan = customData?.plan || "pro";
    console.log("[LS Webhook]", eventName, "plan:", plan);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
