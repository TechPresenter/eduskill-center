import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { batchDetailForTrainer, trainerOf } from "@/server/trainer-scope";

/** GET /api/trainer/batches/[id] → overview, roster, attendance report and coursework for one of my batches. */
export const GET = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ user, params }) => {
  const t = trainerOf(user);
  if (!isUuid(params.id)) throw Errors.notFound("Batch");
  return batchDetailForTrainer(t.id, params.id);
});
