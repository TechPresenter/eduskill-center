import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { PUBLIC_EVENT_TYPES, trackEvent } from "@/server/analytics";

const schema = z.object({
  type: z.enum(PUBLIC_EVENT_TYPES),
  path: z.string().trim().max(500).optional(),
  refId: z.string().trim().max(100).optional(),
  sessionId: z.string().trim().max(100).optional(),
});

/** POST /api/public/analytics → records a website event (IP is hashed, never stored raw). */
export const POST = apiHandler({ auth: "none", csrf: false, rateLimit: { limit: 120, windowSec: 60, name: "public-analytics" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  if (body.path && !body.path.startsWith("/")) return { ok: false };
  await trackEvent({ type: body.type, path: body.path, refId: body.refId, sessionId: body.sessionId, ip, userAgent });
  return { ok: true };
});
