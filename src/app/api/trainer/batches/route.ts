import { apiHandler } from "@/lib/api/handler";
import { myBatches, trainerOf } from "@/server/trainer-scope";

/** GET /api/trainer/batches → batches I teach or am actively assigned to. */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ user }) => {
  const t = trainerOf(user);
  return myBatches(t.id);
});
