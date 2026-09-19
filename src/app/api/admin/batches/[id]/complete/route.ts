import { apiHandler } from "@/lib/api/handler";
import { completeBatch } from "@/server/progress";

/** Completes the batch: all active admissions become COMPLETED and progress/eligibility is recomputed. */
export const POST = apiHandler<{ id: string }>({ permission: "batches.update" }, async ({ params, user, ip, userAgent }) => completeBatch(params.id, { user: user!, ip, userAgent }));
