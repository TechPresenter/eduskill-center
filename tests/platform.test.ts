import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSetting, setSetting, invalidateSettingsCache } from "@/lib/settings";
import { renderTemplate } from "@/lib/notifications";
import { verifyRazorpayCheckoutSignature } from "@/lib/payments";
import { createHmac } from "node:crypto";
import { uid } from "./helpers";

describe("platform utilities", () => {
  it("rate limits after the configured number of requests in a window", async () => {
    const key = `rl:${uid()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit(key, 3, 60));
    expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
    expect(results[3]!.allowed).toBe(false);
    expect(results[3]!.retryAfterSec).toBeGreaterThan(0);
  });

  it("reads defaults and persists overrides for settings", async () => {
    expect(await getSetting<string>("codes.centerPrefix")).toBe("ESK");
    await setSetting("codes.centerPrefix", "TST");
    invalidateSettingsCache();
    expect(await getSetting<string>("codes.centerPrefix")).toBe("TST");
    await setSetting("codes.centerPrefix", "ESK");
    await expect(getSetting("does.not.exist")).rejects.toThrow();
  });

  it("renders notification templates with variables", () => {
    expect(renderTemplate("Hi {{name}}, app {{applicationNo}} is {{status}}.", { name: "Riya", applicationNo: "APP-1", status: "Approved" })).toBe("Hi Riya, app APP-1 is Approved.");
    expect(renderTemplate("{{missing}}!", {})).toBe("!");
  });

  it("verifies Razorpay checkout signatures", () => {
    const secret = "test_secret";
    const sig = createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    expect(verifyRazorpayCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: sig, secret })).toBe(true);
    expect(verifyRazorpayCheckoutSignature({ orderId: "order_1", paymentId: "pay_2", signature: sig, secret })).toBe(false);
  });
});
