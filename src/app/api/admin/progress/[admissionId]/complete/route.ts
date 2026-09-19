import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { markAdmissionCompleted } from "@/server/progress";
import { progressNumbers } from "@/server/admissions";

const schema = z.object({ note: optionalString });

export const POST = apiHandler<{ admissionId: string }>({ permission: "progress.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const progress = await markAdmissionCompleted(params.admissionId, { user: user!, ip, userAgent }, body.note ?? null);
  return progressNumbers(progress);
});
