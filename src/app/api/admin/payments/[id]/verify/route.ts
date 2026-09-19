import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation/common";
import { verifyPaymentByStaff } from "@/server/payments";

const schema = z.object({
  referenceNo: optionalString,
  method: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "ONLINE", "OTHER"]).optional(),
});

/** Marks an offline / pending payment as received (issues the receipt and may auto-confirm the admission). */
export const POST = apiHandler<{ id: string }>({ permission: "payments.verify" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const payment = await verifyPaymentByStaff(params.id, { user: user!, ip, userAgent }, { referenceNo: body.referenceNo ?? undefined, method: body.method });
  return { paymentId: payment.id, status: payment.status, receiptNo: payment.receiptNo, applicationStatus: payment.application.status };
});
