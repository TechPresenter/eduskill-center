import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { markAdmissionCompleted } from "@/server/progress";
import { progressNumbers } from "@/server/admissions";

const schema = z.object({ note: optionalString });

/** Marks the student's training as completed and recomputes certificate eligibility. */
export const POST = apiHandler<{ id: string }>({ permission: ["admissions.update", "progress.update"] }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const progress = await markAdmissionCompleted(params.id, { user: user!, ip, userAgent }, body.note ?? null);
  return progressNumbers(progress);
});
