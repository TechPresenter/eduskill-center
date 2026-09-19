import { apiHandler, parseQuery } from "@/lib/api/handler";
import { myStudents, myStudentsQuery, trainerOf } from "@/server/trainer-scope";

/** GET /api/trainer/students?q=&batchId=&status= → students admitted to my batches (no documents / private data). */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ req, user }) => {
  const t = trainerOf(user);
  const q = parseQuery(req, myStudentsQuery);
  return myStudents(t.id, q);
});
