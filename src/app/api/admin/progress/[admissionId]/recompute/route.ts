import { apiHandler } from "@/lib/api/handler";
import { recomputeProgress } from "@/server/progress";
import { progressNumbers } from "@/server/admissions";

export const POST = apiHandler<{ admissionId: string }>({ permission: "progress.update" }, async ({ params }) => {
  const progress = await recomputeProgress(params.admissionId);
  return progressNumbers(progress);
});
