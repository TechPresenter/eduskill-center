import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { confirmAdmission } from "@/server/applications";

const schema = z.object({ note: optionalString, allowPartialPayment: z.boolean().optional() });

/** Confirms admission: generates Student ID (once), admission number and the progress record. */
export const POST = apiHandler<{ id: string }>({ permission: "admissions.approve" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const admission = await confirmAdmission(params.id, { user: user!, ip, userAgent }, body.note ?? null, { allowPartialPayment: !!body.allowPartialPayment });
  return { admissionId: admission.id, admissionNo: admission.admissionNo, status: "ADMISSION_CONFIRMED" };
});
