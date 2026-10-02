import { z } from "zod";
import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { paginationSchema } from "@/lib/api/query";
import { composeSchema, listEmails, saveDraft } from "@/server/email";

const draftSchema = composeSchema.extend({ draftId: z.string().uuid().optional().nullable() });

/** The signed-in administrator's own drafts (a Super Admin sees every draft). */
export const GET = apiHandler({ permission: "email.send" }, async ({ req, user, ip, userAgent }) => {
  const q = parseQuery(req, paginationSchema);
  return listEmails({ ...q, scope: "drafts" }, { user: user!, ip, userAgent });
});

/** Creates a draft, or updates `draftId` when it is given (only the author or a Super Admin may). */
export const POST = apiHandler({ permission: "email.send", rateLimit: { limit: 120, windowSec: 600, keyBy: "user", name: "admin-email-draft" } }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, draftSchema);
  return saveDraft(body, { user: user!, ip, userAgent });
});
