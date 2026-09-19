import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { renderPaymentDocument } from "@/server/receipts";

/** GET /api/student/payments/[id]/receipt – PDF receipt (completed) or proforma invoice (pending) for the student's own payment. */
export const GET = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ params, user }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Payment");
  const { buffer, filename } = await renderPaymentDocument(params.id, { studentId: user!.student!.id });
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
