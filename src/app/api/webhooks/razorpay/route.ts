import { apiHandler } from "@/lib/api/handler";
import { handleRazorpayWebhook } from "@/server/payments";

/**
 * POST /api/webhooks/razorpay – Razorpay server-to-server events (payment.captured / order.paid / payment.failed).
 * No session and no same-origin check: the request is authenticated by the HMAC signature header instead.
 */
export const POST = apiHandler({ auth: "none", csrf: false, rateLimit: { limit: 600, windowSec: 60, name: "razorpay-webhook" } }, async ({ req }) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  await handleRazorpayWebhook(rawBody, signature);
  return { ok: true };
});
