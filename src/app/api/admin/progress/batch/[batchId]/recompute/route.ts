import { apiHandler } from "@/lib/api/handler";
import { recomputeBatchProgress } from "@/server/progress";

/** Recomputes progress for every admission of the batch. */
export const POST = apiHandler<{ batchId: string }>({ permission: "progress.update" }, async ({ params }) => {
  const count = await recomputeBatchProgress(params.batchId);
  return { recomputed: count };
});
