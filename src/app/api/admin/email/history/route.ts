import { apiHandler, parseQuery } from "@/lib/api/handler";
import { historySchema, listEmails } from "@/server/email";
import { scopeHistoryQuery } from "@/components/admin/email/history-query";

/**
 * Sent-email history: search (subject, recipient, Message-ID), status, date range and "mine".
 * A sender without `email.view` only ever sees their own emails (see scopeHistoryQuery).
 */
export const GET = apiHandler({ permission: ["email.view", "email.send"] }, async ({ req, user, ip, userAgent }) => {
  const q = scopeHistoryQuery(parseQuery(req, historySchema), user!);
  return listEmails(q, { user: user!, ip, userAgent });
});
