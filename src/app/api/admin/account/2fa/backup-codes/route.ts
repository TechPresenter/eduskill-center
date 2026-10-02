import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { regenerateBackupCodes } from "@/server/two-factor";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app") });

/** Replaces every backup code (needs a current authenticator code); the new set is shown once, never cached. */
export const POST = apiHandler(
  { roles: ["SUPER_ADMIN", "STAFF"], rateLimit: { limit: 10, windowSec: 15 * 60, keyBy: "user", name: "2fa-backup-codes", failClosed: true } },
  async ({ req, user, ip, userAgent }) => {
    const body = await parseBody(req, schema);
    const data = await regenerateBackupCodes(body.code, { user: user!, ip, userAgent });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  }
);
