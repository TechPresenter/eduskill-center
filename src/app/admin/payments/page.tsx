import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, CreditCard, RotateCcw } from "lucide-react";
import { db, type Prisma } from "@/lib/db";
import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatINR, formatNumber, titleCase, toNumber } from "@/lib/utils";
import { listPayments, paymentListSchema } from "@/server/payments";
import { getAdminLookups } from "@/server/admissions";
import { StatsCard } from "@/components/ui/stats";
import { StatusBadge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pager } from "@/components/admin/pickers/pager";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { PaymentActions } from "@/components/admin/payments/payment-actions";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Payments" };

const METHOD_OPTIONS = ["ONLINE", "CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"].map((m) => ({ value: m, label: titleCase(m) }));

/** Status totals for the current filters (ignoring the status tab) so the KPI row reflects the selected range. */
async function paymentKpis(q: ReturnType<typeof paymentListSchema.parse>) {
  const where: Prisma.PaymentWhereInput = {};
  if (q.method) where.method = { in: q.method.split(",") as PaymentMethod[] };
  if (q.centerId || q.courseId) where.application = { centerId: q.centerId, courseId: q.courseId };
  if (q.studentId) where.studentId = q.studentId;
  if (q.from || q.to) where.createdAt = { gte: q.from, lt: q.to };
  if (q.q) {
    where.OR = [
      { paymentNo: { contains: q.q, mode: "insensitive" } },
      { receiptNo: { contains: q.q, mode: "insensitive" } },
      { invoiceNo: { contains: q.q, mode: "insensitive" } },
      { referenceNo: { contains: q.q, mode: "insensitive" } },
      { student: { name: { contains: q.q, mode: "insensitive" } } },
      { application: { applicationNo: { contains: q.q, mode: "insensitive" } } },
    ];
  }
  const rows = await db.payment.groupBy({ by: ["status"], where, _sum: { amount: true }, _count: { _all: true } });
  const get = (...statuses: PaymentStatus[]) => rows.filter((r) => statuses.includes(r.status)).reduce((acc, r) => ({ amount: acc.amount + toNumber(r._sum.amount), count: acc.count + r._count._all }), { amount: 0, count: 0 });
  return { collected: get("COMPLETED"), pending: get("PENDING", "PROCESSING"), failed: get("FAILED", "CANCELLED"), refunded: get("REFUNDED"), all: rows.reduce((n, r) => n + r._count._all, 0) };
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("payments.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(paymentListSchema, sp);
  const [data, lookups, kpis] = await Promise.all([listPayments(q), getAdminLookups(), paymentKpis(q)]);
  const can = { verify: hasPermission(user, "payments.verify"), refund: hasPermission(user, "payments.refund"), export: hasPermission(user, "payments.export") };
  const base = "/admin/payments";
  const filterKeys = ["method", "centerId", "courseId", "from", "to", "q"];

  const isEmpty = kpis.all === 0 && !Object.keys(sp).length;

  return (
    <AdminListPage
      header={{
        title: "Payments",
        description: `${formatNumber(data.meta.total)} payment${data.meta.total === 1 ? "" : "s"} in the current view · ${formatINR(data.totalCompleted)} collected.`,
        actions: <ExportButton href={withParams("/api/admin/payments/export", sp, { page: undefined, limit: undefined })} disabled={!can.export} />,
      }}
      tabs={
        <>
          {/* The money summary is the first thing finance staff look for, so it sits above the tabs. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsCard label="Collected" value={formatINR(kpis.collected.amount)} hint={`${formatNumber(kpis.collected.count)} completed`} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
            <StatsCard label="Pending verification" value={formatINR(kpis.pending.amount)} hint={`${formatNumber(kpis.pending.count)} awaiting`} icon={<Clock className="h-5 w-5" />} tone="warning" href={withParams(base, sp, { status: "PENDING,PROCESSING", page: undefined })} />
            <StatsCard label="Failed / cancelled" value={formatINR(kpis.failed.amount)} hint={`${formatNumber(kpis.failed.count)} payments`} icon={<AlertTriangle className="h-5 w-5" />} tone="orange" />
            <StatsCard label="Refunded" value={formatINR(kpis.refunded.amount)} hint={`${formatNumber(kpis.refunded.count)} payments`} icon={<RotateCcw className="h-5 w-5" />} tone="navy" />
          </div>
          <QueryTabs
            param="status"
            keep={filterKeys}
            items={[
              { value: "", label: "All", count: kpis.all },
              { value: "PENDING,PROCESSING", label: "Pending verification", count: kpis.pending.count },
              { value: "COMPLETED", label: "Completed", count: kpis.collected.count },
              { value: "FAILED,CANCELLED", label: "Failed", count: kpis.failed.count },
              { value: "REFUNDED", label: "Refunded", count: kpis.refunded.count },
            ]}
          />
        </>
      }
      filters={
        <FilterBar
          lookups={lookups}
          preserve={["status"]}
          fields={[
            { type: "search", placeholder: "Payment no, receipt, invoice, reference, student or application no" },
            { type: "select", name: "method", label: "Method", options: METHOD_OPTIONS },
            { type: "center" },
            { type: "course" },
            { type: "date-range", label: "Created between" },
          ]}
        />
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
    >
      {isEmpty ? (
        <EmptyState icon={<CreditCard className="h-7 w-7" />} title="No payments yet" description="Payments appear here when students pay fees online or staff record a payment on an application." />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Payment</TH>
              <TH>Student</TH>
              <TH>Application</TH>
              <TH className="text-right">Amount</TH>
              <TH>Method</TH>
              <TH>Status</TH>
              <TH>Date</TH>
              <TH>Actions</TH>
            </tr>
          </THead>
          <TBody>
            {data.items.length === 0 && <EmptyRow colSpan={8}>No payments match these filters.</EmptyRow>}
            {data.items.map((p) => {
              const meta = (p.metadata ?? null) as { proofUrl?: string } | null;
              return (
                <TR key={p.id}>
                  <TD primary>
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <Link href={`${base}/${p.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                          {p.paymentNo}
                        </Link>
                        <span className="block text-caption font-normal text-muted">{p.receiptNo ? `Receipt ${p.receiptNo}` : `Invoice ${p.invoiceNo}`}</span>
                        {p.referenceNo && <span className="block text-caption font-normal text-muted">Ref {p.referenceNo}</span>}
                      </span>
                      {/* Amount + status lead the card on phones (those columns are dropped there). */}
                      <span className="shrink-0 text-right md:hidden">
                        <span className="block text-h4 tabular-nums text-navy">{formatINR(p.amount)}</span>
                        <StatusBadge status={p.status} className="mt-1" />
                      </span>
                    </span>
                    {p.failureReason && <span className="mt-1 block text-caption font-normal text-danger md:hidden">{p.failureReason}</span>}
                  </TD>
                  <TD label="Student">
                    <Link href={`/admin/students/${p.student.id}`} className="font-semibold hover:text-navy">
                      {p.student.name}
                    </Link>
                    <span className="block font-mono text-caption text-muted">{p.student.studentId ?? p.student.mobile}</span>
                  </TD>
                  <TD label="Application">
                    <Link href={`/admin/applications/${p.application.id}`} className="font-mono text-caption text-navy hover:underline">
                      {p.application.applicationNo}
                    </Link>
                    <span className="block text-caption text-muted">{p.application.course.name}</span>
                    <span className="block text-caption text-muted">{p.application.center.name}</span>
                  </TD>
                  <TD mobile="hidden" className="text-right font-semibold tabular-nums">
                    {formatINR(p.amount)}
                  </TD>
                  <TD label="Method">
                    {titleCase(p.method)}
                    <span className="block text-caption text-muted">{p.gateway}</span>
                  </TD>
                  <TD mobile="hidden">
                    <StatusBadge status={p.status} />
                    {p.failureReason && <span className="block max-w-48 truncate text-caption text-danger">{p.failureReason}</span>}
                  </TD>
                  <TD label="Date" className="text-muted md:whitespace-nowrap">
                    {formatDateTime(p.paidAt ?? p.createdAt)}
                  </TD>
                  <TD actions>
                    <PaymentActions paymentId={p.id} paymentNo={p.paymentNo} status={p.status} method={p.method} amount={p.amount} referenceNo={p.referenceNo} studentName={p.student.name} proofUrl={meta?.proofUrl ?? null} can={can} compact />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
