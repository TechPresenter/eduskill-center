import { apiHandler } from "@/lib/api/handler";
import { ensureStudentId } from "@/server/students";

/** Generates the permanent Student ID (idempotent – returns the existing one when already set). */
export const POST = apiHandler<{ id: string }>({ permission: "students.update" }, async ({ params, user, ip, userAgent }) => {
  const studentId = await ensureStudentId(params.id, { user: user!, ip, userAgent });
  return { studentId };
});
