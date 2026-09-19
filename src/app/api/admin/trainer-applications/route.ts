import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listTrainerApplications, trainerApplicationListSchema } from "@/server/trainers";

export const GET = apiHandler({ permission: "trainers.view" }, async ({ req }) => {
  const q = parseQuery(req, trainerApplicationListSchema);
  return listTrainerApplications(q);
});
