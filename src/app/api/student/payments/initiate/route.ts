import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { initiatePayment } from "@/server/payments";
import { attachPaymentProof } from "@/server/student-portal";

const schema = z.object({
  applicationId: z.string().uuid("Invalid application"),
  amount: z.coerce.number().positive("Enter a valid amount").max(10_000_000).optional(),
  method: z.enum(["ONLINE", "CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]),
  referenceNo: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  /** URL returned by POST /api/student/uploads?kind=payment-proof (offline payments only). */
  proofUrl: z.string().trim().max(500).optional().nullable(),
  proofName: z.string().trim().max(160).optional().nullable(),
});

/**
 * POST /api/student/payments/initiate
 * ONLINE → creates a gateway order (returns checkout params). Offline methods → PROCESSING payment awaiting verification.
 */
export const POST = apiHandler({ roles: ["STUDENT"], rateLimit: { limit: 30, windowSec: 3600, keyBy: "user", name: "payment-initiate" } }, async ({ req, user, ip }) => {
  const studentId = user!.student!.id;
  const body = await parseBody(req, schema);
  if (body.method !== "ONLINE" && !body.referenceNo && body.method !== "CASH") {
    throw Errors.validation("Please correct the highlighted fields.", { referenceNo: "Enter the transaction / reference number" });
  }
  if (body.proofUrl && !body.proofUrl.startsWith(`/api/files/private/students/${studentId}/`)) throw Errors.badRequest("Invalid proof file");

  const result = await initiatePayment(
    { applicationId: body.applicationId, studentId, amount: body.amount, method: body.method, referenceNo: body.referenceNo || null, notes: body.notes || null },
    { ip }
  );
  if (body.method !== "ONLINE" && body.proofUrl) {
    await attachPaymentProof(result.payment.id, studentId, { url: body.proofUrl, name: body.proofName || "Payment proof" });
  }
  return result;
});
