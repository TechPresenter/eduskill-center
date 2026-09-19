import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/handler";
import { toNumber } from "@/lib/utils";

export const GET = apiHandler<{ id: string }>({ permission: "payments.view" }, async ({ params }) => {
  const p = await db.payment.findUnique({
    where: { id: params.id },
    include: {
      student: { select: { id: true, name: true, studentId: true, mobile: true, email: true } },
      application: { select: { id: true, applicationNo: true, status: true, payableAmount: true, paidAmount: true, course: { select: { name: true } }, center: { select: { name: true, code: true } } } },
      installments: { orderBy: { installmentNo: "asc" } },
    },
  });
  if (!p) throw Errors.notFound("Payment");
  const verifiedBy = p.verifiedById ? await db.user.findUnique({ where: { id: p.verifiedById }, select: { name: true } }) : null;
  return {
    ...p,
    amount: toNumber(p.amount),
    verifiedByName: verifiedBy?.name ?? null,
    application: { ...p.application, payableAmount: toNumber(p.application.payableAmount), paidAmount: toNumber(p.application.paidAmount) },
    installments: p.installments.map((i) => ({ ...i, amount: toNumber(i.amount) })),
  };
});
