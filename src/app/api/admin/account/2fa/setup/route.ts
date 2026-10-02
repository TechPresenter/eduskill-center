import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { beginTwoFactorSetup } from "@/server/two-factor";

/**
 * Starts authenticator set-up for the signed-in administrator. The response carries the QR code and
 * the manual key — the only time the secret ever leaves the server — so it must never be cached.
 */
export const POST = apiHandler(
  { roles: ["SUPER_ADMIN", "STAFF"], rateLimit: { limit: 10, windowSec: 15 * 60, keyBy: "user", name: "2fa-setup" } },
  async ({ user, ip, userAgent }) => {
    const data = await beginTwoFactorSetup({ user: user!, ip, userAgent });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  }
);
