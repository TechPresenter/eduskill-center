import type { z } from "zod";
import type { AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import type { historySchema } from "@/server/email";

export type EmailHistoryQuery = z.infer<typeof historySchema>;

/**
 * Narrows a Sent-history query to what the signed-in administrator may read. Server-safe (no React),
 * shared by `GET /api/admin/email/history` and the history page so both apply the same rules:
 *
 *   - Without `email.view` (a sender only) the list is limited to the emails they sent or created.
 *   - `status=DRAFT` is ignored in the `sent` scope, where the service would otherwise list every
 *     administrator's unsent drafts (the `drafts` scope limits them to their author).
 *   - The `all` scope (sent + drafts of everyone) is for a Super Admin only.
 *   - `to` (a yyyy-mm-dd day, parsed as its first instant) is widened to the END of that day, so
 *     "to 2 Oct" includes emails sent on 2 Oct.
 */
export function scopeHistoryQuery(q: EmailHistoryQuery, user: AuthUser): EmailHistoryQuery {
  const scope = q.scope === "all" && user.role !== "SUPER_ADMIN" ? "sent" : q.scope;
  const status = q.status === "DRAFT" && scope === "sent" ? undefined : q.status;
  const mine = scope === "drafts" ? q.mine : hasPermission(user, "email.view") ? q.mine : true;
  const to = q.to ? new Date(q.to.getTime() + 86_400_000 - 1) : q.to;
  return { ...q, scope, status, mine: mine || undefined, to };
}
