import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { rejectPayment } from "@/server/payments";

const schema = z.object({ reason: z.string().trim().min(3, "Enter a reason").max(1000) });

export const POST = apiHandler<{ id: string }>({ permission: "payments.verify" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await rejectPayment(params.id, body.reason, { user: user!, ip, userAgent });
  return { status: "FAILED" };
});
