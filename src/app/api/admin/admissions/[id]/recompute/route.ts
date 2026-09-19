import { apiHandler } from "@/lib/api/handler";
import { recomputeProgress } from "@/server/progress";
import { progressNumbers } from "@/server/admissions";

export const POST = apiHandler<{ id: string }>({ permission: ["admissions.update", "progress.update"] }, async ({ params }) => {
  const progress = await recomputeProgress(params.id);
  return progressNumbers(progress);
});
