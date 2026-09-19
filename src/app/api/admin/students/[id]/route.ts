import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { studentProfileSchema } from "@/lib/validation/students";
import { adminUpdateStudent, getStudentAdmin } from "@/server/students";

const adminStudentUpdateSchema = studentProfileSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

export const GET = apiHandler<{ id: string }>({ permission: "students.view" }, async ({ params }) => getStudentAdmin(params.id));

/** Staff edit of a student profile (any subset of fields) plus account status. */
export const PATCH = apiHandler<{ id: string }>({ permission: "students.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, adminStudentUpdateSchema);
  return adminUpdateStudent(params.id, body, { user: user!, ip, userAgent });
});
