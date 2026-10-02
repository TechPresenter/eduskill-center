import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { acknowledgeAlerts } from "@/server/security";
import { MANAGE_RATE_LIMIT } from "@/app/api/admin/security/_shared";

const ackSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1, "Choose at least one alert").max(100) }),
  z.object({ all: z.literal(true) }),
]);

/** Marks security alerts as reviewed: `{ ids }` for specific ones, `{ all: true }` for every open alert the caller can see. */
export const POST = apiHandler({ permission: "security.manage", rateLimit: MANAGE_RATE_LIMIT }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, ackSchema);
  return acknowledgeAlerts("all" in body ? "all" : body.ids, { user: user!, ip, userAgent });
});
