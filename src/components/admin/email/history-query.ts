import type { z } from "zod";
import type { AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import type { historySchema } from "@/server/email";

export type EmailHistoryQuery = z.infer<typeof historySchema>;

/** India Standard Time (UTC+05:30) — the day the filter means, as for the daily sending limit. */
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/**
 * Narrows a Sent-history query to what the signed-in administrator may read. Server-safe (no React),
 * shared by `GET /api/admin/email/history` and the history page so both apply the same rules:
 *
 *   - Without `email.view` (a sender only) the list is limited to the emails they sent or created.
 *   - `status=DRAFT` is ignored in the `sent` scope, where the service would otherwise list every
 *     administrator's unsent drafts (the `drafts` scope limits them to their author).
 *   - The `all` scope (sent + drafts of everyone) is for a Super Admin only.
 *   - `from` / `to` are yyyy-mm-dd days in INDIA time (parsed as UTC midnight, then shifted by
 *     +05:30), and `to` is widened to the END of that day, so "2 Oct to 2 Oct" means 2 Oct 00:00 to
 *     23:59:59 IST — the same day the "sent today" count and the daily limit use.
 */
export function scopeHistoryQuery(q: EmailHistoryQuery, user: AuthUser): EmailHistoryQuery {
  const scope = q.scope === "all" && user.role !== "SUPER_ADMIN" ? "sent" : q.scope;
  const status = q.status === "DRAFT" && scope === "sent" ? undefined : q.status;
  const mine = scope === "drafts" ? q.mine : hasPermission(user, "email.view") ? q.mine : true;
  const from = q.from ? new Date(q.from.getTime() - IST_OFFSET_MS) : q.from;
  const to = q.to ? new Date(q.to.getTime() + DAY_MS - IST_OFFSET_MS - 1) : q.to;
  return { ...q, scope, status, mine: mine || undefined, from, to };
}
