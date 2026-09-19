import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { optionalDateString, optionalString } from "@/lib/validation/common";
import { getPaymentSummary, recordManualPayment } from "@/server/payments";

export const GET = apiHandler<{ id: string }>({ permission: "payments.view" }, async ({ params }) => getPaymentSummary(params.id));

const schema = z.object({
  amount: z.coerce.number().positive("Enter the amount received"),
  method: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "ONLINE", "OTHER"]),
  referenceNo: optionalString,
  description: optionalString,
  paidAt: optionalDateString,
});

/** Staff records a payment collected directly (cash at the center, bank transfer seen on the statement). */
export const POST = apiHandler<{ id: string }>({ permission: "payments.create" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const payment = await recordManualPayment(
    { applicationId: params.id, amount: body.amount, method: body.method, referenceNo: body.referenceNo ?? null, description: body.description ?? null, paidAt: body.paidAt ?? null },
    { user: user!, ip, userAgent }
  );
  return { paymentId: payment.id, paymentNo: payment.paymentNo, receiptNo: payment.receiptNo, status: payment.status, applicationStatus: payment.application.status };
});
