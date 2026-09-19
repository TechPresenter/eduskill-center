import { apiHandler } from "@/lib/api/handler";
import { completeBatch } from "@/server/progress";

/** Completes the batch: all active admissions become COMPLETED and eligibility is recomputed. */
export const POST = apiHandler<{ batchId: string }>({ permission: "progress.update" }, async ({ params, user, ip, userAgent }) => {
  return completeBatch(params.batchId, { user: user!, ip, userAgent });
});
