import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { waitlistApplication } from "@/server/applications";

const schema = z.object({ note: optionalString });

export const POST = apiHandler<{ id: string }>({ permission: "applications.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await waitlistApplication(params.id, body.note ?? undefined, { user: user!, ip, userAgent });
  return { status: "WAITLISTED" };
});
