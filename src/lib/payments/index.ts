import { createHmac, timingSafeEqual } from "node:crypto";
import { getSettingsGroup } from "@/lib/settings";

export type GatewayName = "manual" | "razorpay";

export interface GatewayConfig {
  gateway: GatewayName;
  currency: string;
  allowOffline: boolean;
  installmentsEnabled: boolean;
  maxInstallments: number;
  bankDetails: string;
  razorpay: { keyId: string; keySecret: string; webhookSecret: string };
}

export async function getGatewayConfig(): Promise<GatewayConfig> {
  const s = await getSettingsGroup("payments");
  const str = (k: string, env?: string) => String(s[`payments.${k}`] || (env ? process.env[env] ?? "" : ""));
  const gatewaySetting = (str("gateway") || process.env.PAYMENT_GATEWAY || "manual") as GatewayName;
  return {
    gateway: gatewaySetting === "razorpay" ? "razorpay" : "manual",
    currency: str("currency") || "INR",
    allowOffline: s["payments.allowOffline"] !== false,
    installmentsEnabled: s["payments.installmentsEnabled"] === true,
    maxInstallments: Number(s["payments.maxInstallments"] || 3),
    bankDetails: str("bankDetails"),
    razorpay: {
      keyId: str("razorpayKeyId", "RAZORPAY_KEY_ID"),
      keySecret: str("razorpayKeySecret", "RAZORPAY_KEY_SECRET"),
      webhookSecret: str("razorpayWebhookSecret", "RAZORPAY_WEBHOOK_SECRET"),
    },
  };
}

export interface GatewayOrder {
  gateway: GatewayName;
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

/** Creates an order with the configured gateway. Manual gateway returns a local pseudo-order. */
export async function createGatewayOrder(input: {
  amount: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<GatewayOrder> {
  const cfg = await getGatewayConfig();
  if (cfg.gateway === "razorpay") {
    if (!cfg.razorpay.keyId || !cfg.razorpay.keySecret) throw new Error("Razorpay keys are not configured");
    const auth = Buffer.from(`${cfg.razorpay.keyId}:${cfg.razorpay.keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: cfg.currency,
        receipt: input.receipt,
        notes: input.notes ?? {},
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Razorpay order failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return { gateway: "razorpay", orderId: order.id, amount: order.amount / 100, currency: order.currency, keyId: cfg.razorpay.keyId };
  }
  return { gateway: "manual", orderId: `manual_${input.receipt}`, amount: input.amount, currency: cfg.currency };
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyRazorpayCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  const expected = createHmac("sha256", input.secret).update(`${input.orderId}|${input.paymentId}`).digest("hex");
  return safeEqual(expected, input.signature);
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}
