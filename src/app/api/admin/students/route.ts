import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listStudents, studentListSchema } from "@/server/students";

/** Paginated student directory with location / center / course / batch / status filters. */
export const GET = apiHandler({ permission: "students.view" }, async ({ req }) => {
  const q = parseQuery(req, studentListSchema);
  return listStudents(q);
});
