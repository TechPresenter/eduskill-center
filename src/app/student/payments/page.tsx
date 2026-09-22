import Link from "next/link";
import type { Metadata } from "next";
import { CreditCard, Download, Receipt } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { listStudentFeeSummaries, listStudentPayments } from "@/server/student-portal";
import { formatDate, formatINR, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/stats";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { PaymentRowCard } from "@/components/student/mobile";
import { withBasePath } from "@/lib/base-path";

export const metadata: Metadata = { title: "Fees & Payments" };

export default async function StudentPaymentsPage() {
  const user = await requireStudent();
  const [applications, payments] = await Promise.all([listStudentFeeSummaries(user.student.id), listStudentPayments(user.student.id)]);
  const totalDue = applications.reduce((s, a) => s + a.due, 0);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Fees & Payments" mobileTitle="Fees & Payments" description={totalDue > 0 ? `Total due: ${formatINR(totalDue)}` : "No fees are due right now."} />

      {applications.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-7 w-7" />} title="No fee records yet" description="Fees appear here once an application is submitted." action={<ButtonLink href="/student/applications" variant="outline">My applications</ButtonLink>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {applications.map((a) => (
            <Card key={a.id}>
              <CardHeader
                title={a.course.name}
                description={
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/student/applications/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                      {a.applicationNo}
                    </Link>
                    <StatusBadge status={a.status} />
                    <span>{a.center.name}</span>
                  </span>
                }
                action={a.canPay ? <ButtonLink href={`/student/payments/${a.id}`} size="sm" leftIcon={<CreditCard className="h-4 w-4" />}>Pay {formatINR(a.due)}</ButtonLink> : undefined}
              />
              <CardBody className="space-y-3 text-body-sm">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Original" value={formatINR(a.originalFee)} />
                  <Stat label="Scholarship" value={a.scholarshipAmount > 0 ? `− ${formatINR(a.scholarshipAmount)}` : "—"} />
                  <Stat label="Payable" value={formatINR(a.payableAmount)} />
                  <Stat label="Due" value={formatINR(a.due)} strong />
                </div>
                <ProgressBar value={a.paidAmount} max={a.payableAmount || 1} tone={a.due > 0 ? "orange" : "success"} label={`Paid ${formatINR(a.paidAmount)} of ${formatINR(a.payableAmount)}`} />
                {a.installmentsAllowed && a.due > 0 && <p className="text-caption text-green-700">Installments are allowed for this application.</p>}
                {a.installments.length > 0 && (
                  <ul className="space-y-1 rounded-md bg-surface p-3 text-caption">
                    {a.installments.map((i) => (
                      <li key={i.id} className="flex justify-between">
                        <span>
                          Installment {i.installmentNo} · due {formatDate(i.dueDate)}
                        </span>
                        <span className="flex items-center gap-2 tabular-nums">
                          {formatINR(i.amount)} <StatusBadge status={i.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!a.canPay && a.due > 0 && <p className="text-caption text-muted">Payment opens once the application is approved.</p>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Payment history – cards on phones, table from md up. */}
      <section aria-label="Payment history" className="space-y-3 md:hidden">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-overline text-muted">Payment history</h2>
          <span className="text-caption text-muted tabular-nums">{payments.length}</span>
        </div>
        {payments.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Receipt className="h-6 w-6" />}
            title="No payments yet"
            description="Once you pay a course fee, the payment and its receipt appear here to download any time."
          />
        ) : (
          <ul className="space-y-3">
            {payments.map((p) => (
              <PaymentRowCard key={p.id} payment={p} />
            ))}
          </ul>
        )}
      </section>

      <Card className="hidden md:block">
        <CardHeader title="Payment history" description="Download receipts for completed payments. Pending payments show a proforma invoice." />
        <div className="p-0">
          <TableWrap cards={false} className="rounded-none border-0">
            <THead>
              <tr>
                <TH>Payment no.</TH>
                <TH>Date</TH>
                <TH>Application</TH>
                <TH className="text-right">Amount</TH>
                <TH>Method</TH>
                <TH>Status</TH>
                <TH>Receipt</TH>
              </tr>
            </THead>
            <TBody>
              {payments.length === 0 ? (
                <EmptyRow colSpan={7}>No payments yet.</EmptyRow>
              ) : (
                payments.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <span className="font-mono text-body-sm">{p.paymentNo}</span>
                      {p.receiptNo && <p className="font-mono text-caption text-muted">Receipt {p.receiptNo}</p>}
                    </TD>
                    <TD className="text-body-sm">{formatDate(p.paidAt ?? p.createdAt)}</TD>
                    <TD className="text-body-sm">
                      <Link href={`/student/applications/${p.application.id}`} className="font-mono text-navy hover:underline">
                        {p.application.applicationNo}
                      </Link>
                      <p className="text-caption text-muted">{p.application.course.name}</p>
                    </TD>
                    <TD className="text-right font-semibold tabular-nums">{formatINR(p.amount)}</TD>
                    <TD className="text-body-sm">
                      {titleCase(p.method)}
                      {p.referenceNo && <p className="text-caption text-muted">Ref {p.referenceNo}</p>}
                    </TD>
                    <TD>
                      <StatusBadge status={p.status} />
                      {p.status === "FAILED" && p.failureReason && <p className="mt-0.5 max-w-56 text-caption text-danger">{p.failureReason}</p>}
                    </TD>
                    <TD>
                      {["COMPLETED", "PENDING", "PROCESSING"].includes(p.status) ? (
                        <a href={withBasePath(`/api/student/payments/${p.id}/receipt`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-body-sm font-semibold text-orange hover:underline">
                          {p.status === "COMPLETED" ? <Download className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                          {p.status === "COMPLETED" ? "Receipt" : "Invoice"}
                        </a>
                      ) : (
                        <span className="text-caption text-muted">—</span>
                      )}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </TableWrap>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-caption font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className={`tabular-nums ${strong ? "text-body font-bold text-navy" : "font-medium text-ink"}`}>{value}</p>
    </div>
  );
}
