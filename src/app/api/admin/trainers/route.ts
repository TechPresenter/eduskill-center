import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listTrainers, trainerListSchema } from "@/server/trainers";

export const GET = apiHandler({ permission: "trainers.view" }, async ({ req }) => {
  const q = parseQuery(req, trainerListSchema);
  return listTrainers(q);
});
