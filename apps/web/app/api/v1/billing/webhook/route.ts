import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { lookupUser, saveUser, USERS_BY_ID } from "../../_lib/auth";

const WEBHOOK_SECRET = (process.env.LEMON_WEBHOOK_SECRET || "").trim();
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const BILLING_ACTIVATION_EVENTS = new Set([
  "order_created",
  "order_paid",
  "subscription_created",
  "subscription_payment_success",
]);
const VALID_PLANS = new Set(["pro", "elite"]);

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

function readCustomData(event: Record<string, unknown>): Record<string, string> {
  const meta = (event.meta as Record<string, unknown> | undefined) || {};
  const metaCustom = (meta.custom_data as Record<string, string> | undefined) || {};
  const attributes =
    (event.data as Record<string, unknown> | undefined)?.attributes as
      | Record<string, unknown>
      | undefined;
  const attrCustom = (attributes?.custom_data as Record<string, string> | undefined) || {};
  return {
    ...attrCustom,
    ...metaCustom,
  };
}

async function activatePlanFromWebhook(customData: Record<string, string>): Promise<string | null> {
  const plan = String(customData.plan || "").toLowerCase();
  if (!VALID_PLANS.has(plan)) return null;

  const userId = String(customData.user_id || "").trim();
  const email = String(customData.email || "").toLowerCase().trim();

  let user = userId ? USERS_BY_ID.get(userId) || null : null;
  if (!user && email) {
    user = await lookupUser(email);
  }
  if (!user) return null;

  user.plan = plan as "pro" | "elite";
  await saveUser(user);
  return user.id;
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
    const meta = evt.meta as Record<string, unknown> | undefined;
    const eventName = String(meta?.event_name || "");
    const customData = readCustomData(evt);
    const plan = String(customData.plan || "").toLowerCase();

    if (BILLING_ACTIVATION_EVENTS.has(eventName)) {
      await activatePlanFromWebhook(customData);
    }

    console.log("[LS Webhook]", eventName, "plan:", plan || "n/a");
    return NextResponse.json({ received: true, processed: BILLING_ACTIVATION_EVENTS.has(eventName) });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
