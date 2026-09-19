import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { saveUpload } from "@/lib/storage";
import { isUuid, toNumber } from "@/lib/utils";
import { attachPaymentProof } from "@/server/student-portal";

/** PATCH /api/student/payments/[id]/proof (multipart: file) – attach proof to an offline payment awaiting verification. */
export const PATCH = apiHandler<{ id: string }>({ roles: ["STUDENT"], rateLimit: { limit: 30, windowSec: 600, keyBy: "user", name: "payment-proof" } }, async ({ req, params, user }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Payment");
  const studentId = user!.student!.id;
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const stored = await saveUpload(file, { folder: `students/${studentId}/payments`, visibility: "private", preset: "document" });
  const payment = await attachPaymentProof(params.id, studentId, { url: stored.url, name: stored.name });
  return { ...stored, payment: { id: payment.id, status: payment.status, amount: toNumber(payment.amount), metadata: payment.metadata } };
});
