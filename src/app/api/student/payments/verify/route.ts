import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { verifyOnlinePayment } from "@/server/payments";
import { toNumber } from "@/lib/utils";

const schema = z.object({
  paymentId: z.string().uuid(),
  razorpayOrderId: z.string().trim().min(1).max(120),
  razorpayPaymentId: z.string().trim().min(1).max(120),
  razorpaySignature: z.string().trim().min(1).max(256),
});

/** POST /api/student/payments/verify – verifies the Razorpay checkout response and completes the payment. */
export const POST = apiHandler({ roles: ["STUDENT"] }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const payment = await verifyOnlinePayment({ ...body, studentId: user!.student!.id });
  return { id: payment.id, paymentNo: payment.paymentNo, receiptNo: payment.receiptNo, status: payment.status, amount: toNumber(payment.amount), applicationId: payment.applicationId };
});
