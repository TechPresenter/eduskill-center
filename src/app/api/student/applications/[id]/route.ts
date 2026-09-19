import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { applyPatchSchema } from "@/lib/validation/students";
import { getApplicationDetail, updateDraftApplication } from "@/server/applications";

/** GET /api/student/applications/[id] – full detail of one of the student's applications. */
export const GET = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ params, user }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Application");
  const detail = await getApplicationDetail(params.id, { studentId: user!.student!.id });
  // Never expose the embedded user record / other students' data.
  const { student, ...rest } = detail;
  return { ...rest, student: { id: student.id, name: student.name, studentId: student.studentId } };
});

/**
 * PATCH /api/student/applications/[id] – the apply wizard saves its DRAFT (center, course, batch,
 * scholarship). Scoped to the signed-in student, DRAFT only; fees are recomputed server-side.
 */
export const PATCH = apiHandler<{ id: string }>({ roles: ["STUDENT"], rateLimit: { limit: 120, windowSec: 3600, keyBy: "user", name: "apply-draft" } }, async ({ req, params, user, ip, userAgent }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Application");
  const body = await parseBody(req, applyPatchSchema);
  return updateDraftApplication(params.id, user!.student!.id, { ...body, batchId: body.batchId === undefined ? undefined : body.batchId || null }, { ip, userAgent });
});
