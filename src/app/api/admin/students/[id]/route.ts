import { apiHandler, parseBody } from "@/lib/api/handler";
import { adminStudentUpdateSchema } from "@/lib/validation/students";
import { adminUpdateStudent, getStudentAdmin } from "@/server/students";

export const GET = apiHandler<{ id: string }>({ permission: "students.view" }, async ({ params }) => getStudentAdmin(params.id));

/** Staff edit of a student profile (any subset of fields) plus account status. */
export const PATCH = apiHandler<{ id: string }>({ permission: "students.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, adminStudentUpdateSchema);
  return adminUpdateStudent(params.id, body, { user: user!, ip, userAgent });
});
