import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatINR, titleCase, toNumber } from "@/lib/utils";
import { PageHeader, KeyValue, Timeline, type TimelineItem } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { Alert } from "@/components/ui/feedback";
import { PaymentActions } from "@/components/admin/payments/payment-actions";

export const metadata = { title: "Payment" };

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("payments.view");
  const { id } = await params;
  const p = await db.payment.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, studentId: true, mobile: true, email: true } },
      application: { select: { id: true, applicationNo: true, status: true, originalFee: true, scholarshipAmount: true, discountAmount: true, payableAmount: true, paidAmount: true, installmentsAllowed: true, course: { select: { name: true, code: true } }, center: { select: { name: true, code: true } }, batch: { select: { code: true, name: true } } } },
      installments: { orderBy: { installmentNo: "asc" } },
    },
  });
  if (!p) notFound();
  const [verifiedBy, logs] = await Promise.all([
    p.verifiedById ? db.user.findUnique({ where: { id: p.verifiedById }, select: { name: true } }) : Promise.resolve(null),
    db.auditLog.findMany({ where: { recordType: "Payment", recordId: p.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const can = { verify: hasPermission(user, "payments.verify"), refund: hasPermission(user, "payments.refund") };
  const amount = toNumber(p.amount);
  const app = { ...p.application, originalFee: toNumber(p.application.originalFee), scholarshipAmount: toNumber(p.application.scholarshipAmount), discountAmount: toNumber(p.application.discountAmount), payableAmount: toNumber(p.application.payableAmount), paidAmount: toNumber(p.application.paidAmount) };
  const meta = (p.metadata ?? null) as { proofUrl?: string; proofName?: string; proofUploadedAt?: string; notes?: string; ip?: string } | null;
  const due = Math.max(0, app.payableAmount - app.paidAmount);

  const timeline: TimelineItem[] = [{ title: `Payment ${p.gateway === "manual" ? (p.verifiedById ? "recorded by staff" : "declared by student") : "initiated online"}`, description: `${titleCase(p.method)} · ${formatINR(amount)}`, meta: formatDateTime(p.createdAt), tone: "navy" }];
  if (meta?.proofUploadedAt) timeline.push({ title: "Proof of payment attached", description: meta.proofName ?? "File", meta: formatDateTime(meta.proofUploadedAt), tone: "navy" });
  if (p.status === "COMPLETED" || p.status === "REFUNDED") timeline.push({ title: `Payment received${p.receiptNo ? ` – receipt ${p.receiptNo}` : ""}`, description: p.verifiedById ? `Verified by ${verifiedBy?.name ?? "staff"}` : "Confirmed by the payment gateway", meta: formatDateTime(p.verifiedAt ?? p.paidAt ?? p.updatedAt), tone: "success" });
  if (p.status === "FAILED") timeline.push({ title: "Payment failed / rejected", description: `${p.failureReason ?? "No reason recorded"}${verifiedBy ? ` · ${verifiedBy.name}` : ""}`, meta: formatDateTime(p.verifiedAt ?? p.updatedAt), tone: "danger" });
  if (p.status === "CANCELLED") timeline.push({ title: "Cancelled", description: p.failureReason ?? undefined, meta: formatDateTime(p.updatedAt), tone: "neutral" });
  if (p.status === "REFUNDED") timeline.push({ title: "Refunded", description: p.failureReason ?? undefined, meta: formatDateTime(p.updatedAt), tone: "danger" });
  for (const l of logs) if (!["payment_completed", "record_payment", "declare_payment", "initiate_payment", "reject_payment", "refund"].includes(l.action)) timeline.push({ title: l.description, description: l.actorName ?? "System", meta: formatDateTime(l.createdAt), tone: "neutral" });

  return (
    <div>
      <PageHeader
        backHref="/admin/payments"
        mobileTitle={p.paymentNo}
        breadcrumbs={[{ label: "Payments", href: "/admin/payments" }, { label: p.paymentNo }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{p.paymentNo}</span>
            <StatusBadge status={p.status} className="text-body-sm" />
          </span>
        }
        description={`${formatINR(amount)} · ${titleCase(p.method)} · ${p.student.name} · ${app.course.name}`}
        actions={<PaymentActions paymentId={p.id} paymentNo={p.paymentNo} status={p.status} method={p.method} amount={amount} referenceNo={p.referenceNo} studentName={p.student.name} proofUrl={meta?.proofUrl ?? null} can={can} />}
      />

      {/* The app bar shows only the payment number on phones – keep the status and amount in the page. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 lg:hidden">
        <StatusBadge status={p.status} />
        <span className="text-h3 text-navy tabular-nums">{formatINR(amount)}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {(p.status === "PENDING" || p.status === "PROCESSING") && (
            <Alert tone="warning" title="Awaiting verification">
              {p.gateway === "manual" ? "The student declared an offline payment. Check the bank statement / cash register, then verify or reject it." : "The gateway has not confirmed this payment yet."}
            </Alert>
          )}
          {meta?.proofUrl && (
            <Alert tone="info" title="Proof of payment" action={<a href={meta.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-center text-body-sm font-semibold text-navy hover:underline"><Paperclip className="h-4 w-4" /> Open</a>}>
              {meta.proofName ?? "File"} {meta.proofUploadedAt ? `· uploaded ${formatDateTime(meta.proofUploadedAt)}` : ""}
            </Alert>
          )}
          <Card>
            <CardHeader title="Payment details" />
            <CardBody className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
              <KeyValue label="Amount" value={<span className="text-h3 text-navy tabular-nums">{formatINR(amount, { decimals: true })}</span>} />
              <KeyValue label="Method" value={titleCase(p.method)} />
              <KeyValue label="Gateway" value={p.gateway} />
              <KeyValue label="Invoice No" value={<span className="font-mono">{p.invoiceNo}</span>} />
              <KeyValue label="Receipt No" value={p.receiptNo ? <span className="font-mono">{p.receiptNo}</span> : "—"} />
              <KeyValue label="Reference" value={p.referenceNo ?? "—"} />
              <KeyValue label="Gateway order" value={p.gatewayOrderId ?? "—"} />
              <KeyValue label="Gateway payment" value={p.gatewayPaymentId ?? "—"} />
              <KeyValue label="Currency" value={p.currency} />
              <KeyValue label="Created" value={formatDateTime(p.createdAt)} />
              <KeyValue label="Paid at" value={p.paidAt ? formatDateTime(p.paidAt) : "—"} />
              <KeyValue label="Verified" value={p.verifiedAt ? `${formatDateTime(p.verifiedAt)}${verifiedBy ? ` · ${verifiedBy.name}` : ""}` : "—"} />
              <KeyValue label="Description" value={p.description ?? "—"} className="col-span-2 md:col-span-3" />
              {p.failureReason && <KeyValue label={p.status === "REFUNDED" ? "Refund reason" : "Failure reason"} value={<span className="text-danger">{p.failureReason}</span>} className="col-span-2 md:col-span-3" />}
              {meta?.notes && <KeyValue label="Student's note" value={meta.notes} className="col-span-2 md:col-span-3" />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Application fee" action={<Link href={`/admin/applications/${app.id}`} className="text-body-sm font-semibold text-navy hover:underline">Open application</Link>} />
            <CardBody>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Original", value: app.originalFee },
                  { label: "Scholarship", value: -app.scholarshipAmount },
                  { label: "Discount", value: -app.discountAmount },
                  { label: "Payable", value: app.payableAmount },
                  { label: "Paid", value: app.paidAmount },
                  { label: "Due", value: due },
                ].map((x) => (
                  <div key={x.label} className="rounded-md bg-surface p-3">
                    <p className="text-caption font-medium tracking-wide text-muted uppercase">{x.label}</p>
                    <p className="mt-0.5 text-h4 tabular-nums">{x.value < 0 ? `− ${formatINR(-x.value)}` : formatINR(x.value)}</p>
                  </div>
                ))}
              </div>
              {p.installments.length > 0 && (
                <TableWrap className="mt-4">
                  <THead>
                    <tr>
                      <TH>Installment</TH>
                      <TH className="text-right">Amount</TH>
                      <TH>Due</TH>
                      <TH>Status</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {p.installments.map((i) => (
                      <TR key={i.id}>
                        <TD primary>
                          <span className="flex items-center justify-between gap-2">
                            <span>
                              <span className="md:hidden">Installment </span>#{i.installmentNo}
                            </span>
                            <span className="md:hidden">
                              <StatusBadge status={i.status} />
                            </span>
                          </span>
                        </TD>
                        <TD label="Amount" className="text-right tabular-nums">
                          {formatINR(i.amount)}
                        </TD>
                        <TD label="Due">{formatDate(i.dueDate)}</TD>
                        <TD mobile="hidden">
                          <StatusBadge status={i.status} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </TableWrap>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Student" />
            <CardBody className="space-y-3">
              <KeyValue
                label="Name"
                value={
                  <Link href={`/admin/students/${p.student.id}`} className="text-navy hover:underline">
                    {p.student.name}
                  </Link>
                }
              />
              <KeyValue label="Student ID" value={p.student.studentId ? <span className="font-mono">{p.student.studentId}</span> : "Not generated"} />
              <KeyValue label="Mobile" value={p.student.mobile} />
              <KeyValue label="Email" value={p.student.email ?? "—"} />
              <KeyValue label="Application" value={<Link href={`/admin/applications/${app.id}`} className="font-mono text-navy hover:underline">{app.applicationNo}</Link>} />
              <KeyValue label="Application status" value={<StatusBadge status={app.status} />} />
              <KeyValue label="Course" value={`${app.course.name} (${app.course.code})`} />
              <KeyValue label="Center" value={`${app.center.name} (${app.center.code})`} />
              <KeyValue label="Batch" value={app.batch ? `${app.batch.name} (${app.batch.code})` : "Not allocated"} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <CardBody>
              <Timeline items={timeline} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
