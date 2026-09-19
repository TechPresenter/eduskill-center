import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listPayments, paymentListSchema } from "@/server/payments";
import { collectAll, csvResponse } from "@/server/admissions";
import { formatDate } from "@/lib/utils";

export const GET = apiHandler({ permission: "payments.export" }, async ({ req }) => {
  const q = parseQuery(req, paymentListSchema);
  const rows = await collectAll(listPayments, q);
  return csvResponse(
    `payments-${formatDate(new Date(), "yyyy-MM-dd")}.csv`,
    ["Payment No", "Invoice No", "Receipt No", "Student", "Student ID", "Mobile", "Application No", "Course", "Center", "Amount", "Currency", "Method", "Gateway", "Gateway payment ID", "Reference", "Status", "Paid at", "Verified at", "Failure reason", "Created"],
    rows.map((p) => [
      p.paymentNo,
      p.invoiceNo,
      p.receiptNo,
      p.student.name,
      p.student.studentId,
      p.student.mobile,
      p.application.applicationNo,
      p.application.course.name,
      p.application.center.name,
      p.amount,
      p.currency,
      p.method,
      p.gateway,
      p.gatewayPaymentId,
      p.referenceNo,
      p.status,
      p.paidAt,
      p.verifiedAt,
      p.failureReason,
      p.createdAt,
    ])
  );
});
