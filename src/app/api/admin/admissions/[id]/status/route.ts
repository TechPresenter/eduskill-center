import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { setAdmissionStatus } from "@/server/progress";

const schema = z
  .object({ status: z.enum(["ACTIVE", "ON_HOLD", "DROPPED"]), note: optionalString })
  .superRefine((v, ctx) => {
    if (v.status !== "ACTIVE" && !v.note?.trim()) ctx.addIssue({ code: "custom", path: ["note"], message: "Enter a note explaining this change" });
  });

/** Put an admission on hold, reactivate it, or mark the student as dropped (cancels the application). */
export const POST = apiHandler<{ id: string }>({ permission: "admissions.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await setAdmissionStatus(params.id, body.status, body.note ?? null, { user: user!, ip, userAgent });
  return { status: body.status };
});
