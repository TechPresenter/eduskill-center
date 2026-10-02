import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { consumeRecoveryLink } from "@/server/admin-auth";
import { noStore, requestMeta, startSession } from "../_lib/respond";

const schema = z.object({
  token: z.string().trim().min(20).max(100).regex(/^[A-Za-z0-9_-]+$/),
});

/**
 * Break-glass sign-in with a one-time recovery link issued on the server (scripts/admin-recovery.ts).
 * The token arrives in a POST body only — /login/admin/recover strips it from the address bar before
 * sending it — and it works once, within 15 minutes.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 10, windowSec: 15 * 60, name: "admin-recover", failClosed: true } }, async ({ req, ip, userAgent }) => {
  const parsed = schema.safeParse(await parseBody(req, z.unknown()));
  // A malformed token gets the same answer as an unknown or used one.
  if (!parsed.success) throw Errors.unauthorized("This sign-in has expired. Please start again.");
  const session = await consumeRecoveryLink(parsed.data.token, await requestMeta(ip, userAgent));
  await startSession(session);
  return noStore({ redirect: session.redirect });
});
