import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { confirmTwoFactorSetup } from "@/server/two-factor";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the app") });

/** Confirms set-up with a code from the app and returns the backup codes — shown once, never cached. */
export const POST = apiHandler(
  { roles: ["SUPER_ADMIN", "STAFF"], rateLimit: { limit: 10, windowSec: 15 * 60, keyBy: "user", name: "2fa-confirm", failClosed: true } },
  async ({ req, user, ip, userAgent }) => {
    const body = await parseBody(req, schema);
    const data = await confirmTwoFactorSetup(body.code, { user: user!, ip, userAgent });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  }
);
