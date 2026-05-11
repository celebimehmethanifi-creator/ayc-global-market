import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.LEMON_WEBHOOK_SECRET || "";

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true; // skip verification if no secret set
  try {
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    const digest = hmac.update(body).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-signature") || "";

  if (WEBHOOK_SECRET && !verifySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: unknown;
  try { event = JSON.parse(body); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const evt = event as Record<string, unknown>;
  const meta = evt?.meta as Record<string, unknown> | undefined;
  const eventData = evt?.data as Record<string, unknown> | undefined;
  const eventName = (meta?.event_name as string) || "";
  const customData = (meta?.custom_data as Record<string, string>) || {};
  const attributes = eventData?.attributes as Record<string, unknown> | undefined;
  const orderEmail = (attributes?.user_email as string) || "";
  const plan = customData?.plan || "pro";

  // Log event for debugging
  console.log("[LS Webhook]", eventName, "plan:", plan, "email:", orderEmail);

  if (eventName === "order_created" || eventName === "subscription_created") {
    // TODO: Update user tier in database
    // For now, just acknowledge
    console.log("[LS Webhook] Order paid — plan:", plan, "email:", orderEmail);
  }

  return NextResponse.json({ received: true });
}
