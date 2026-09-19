import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { dateString } from "@/lib/validation/common";
import { setInstallmentsAllowed } from "@/server/applications";
import { createInstallmentPlan } from "@/server/payments";

const toggleSchema = z.object({ allowed: z.boolean() });

/** Toggle whether the student may pay in installments. */
export const PATCH = apiHandler<{ id: string }>({ permission: "applications.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, toggleSchema);
  const updated = await setInstallmentsAllowed(params.id, body.allowed, { user: user!, ip, userAgent });
  return { installmentsAllowed: updated.installmentsAllowed };
});

const planSchema = z.object({
  plan: z
    .array(z.object({ amount: z.coerce.number().positive("Enter an amount"), dueDate: dateString }))
    .min(1, "Add at least one installment")
    .max(12, "Maximum 12 installments"),
});

/** Replace the pending installment plan (must total the due amount). */
export const POST = apiHandler<{ id: string }>({ permission: "payments.create" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, planSchema);
  await createInstallmentPlan(params.id, body.plan, { user: user!, ip, userAgent });
  return { installments: body.plan.length };
});
