import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { submitAssignment } from "@/server/student-portal";

const schema = z.object({
  text: z.string().trim().max(10000).optional().nullable(),
  /** URL returned by POST /api/student/uploads?kind=assignment */
  fileUrl: z.string().trim().max(500).optional().nullable(),
});

/** POST /api/student/assignments/[id]/submit – create or replace the student's submission (LATE when past the due date). */
export const POST = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ req, params, user }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Assignment");
  const body = await parseBody(req, schema);
  const submission = await submitAssignment(user!.student!.id, params.id, body);
  return { id: submission.id, status: submission.status, submittedAt: submission.submittedAt };
});
