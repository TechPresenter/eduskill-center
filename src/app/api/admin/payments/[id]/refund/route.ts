import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { refundPayment } from "@/server/payments";

const schema = z.object({ reason: z.string().trim().min(3, "Enter a reason").max(1000) });

export const POST = apiHandler<{ id: string }>({ permission: "payments.refund" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const payment = await refundPayment(params.id, body.reason, { user: user!, ip, userAgent });
  return { status: payment.status };
});
