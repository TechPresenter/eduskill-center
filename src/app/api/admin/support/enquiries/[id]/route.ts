import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { respondToEnquiry } from "@/server/support";

const schema = z
  .object({ response: z.string().trim().max(5000).default(""), status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]) })
  .superRefine((d, ctx) => {
    if (d.status === "RESOLVED" && !d.response) ctx.addIssue({ code: "custom", path: ["response"], message: "Write a response before resolving" });
  });

/** Responds to (and/or changes the status of) a public enquiry. A non-empty response is emailed/SMSed to the enquirer. */
export const POST = apiHandler<{ id: string }>({ permission: "support.respond" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return respondToEnquiry(params.id, body.response, body.status, { user: user!, ip, userAgent });
});
