import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { applyDiscount } from "@/server/applications";

const schema = z.object({ discountAmount: z.coerce.number().min(0, "Cannot be negative").max(10_000_000), note: optionalString });

export const POST = apiHandler<{ id: string }>({ permission: "applications.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const updated = await applyDiscount(params.id, body.discountAmount, body.note ?? undefined, { user: user!, ip, userAgent });
  return { discountAmount: Number(updated.discountAmount), payableAmount: Number(updated.payableAmount) };
});
