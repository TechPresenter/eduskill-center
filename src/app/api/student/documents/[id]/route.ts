import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { deleteStudentDocument } from "@/server/students";

/** DELETE /api/student/documents/[id] – remove a pending / rejected document of the student. */
export const DELETE = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ params, user }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Document");
  await deleteStudentDocument(user!.student!.id, params.id);
  return { id: params.id, deleted: true };
});
