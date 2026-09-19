import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listPayments, paymentListSchema } from "@/server/payments";

export const GET = apiHandler({ permission: "payments.view" }, async ({ req }) => {
  const q = parseQuery(req, paymentListSchema);
  return listPayments(q);
});
