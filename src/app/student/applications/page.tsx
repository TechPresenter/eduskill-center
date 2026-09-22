import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { listStudentApplications } from "@/server/student-portal";
import { formatDate, formatINR } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { nextAction } from "@/components/student/application-status";

export const metadata: Metadata = { title: "My Applications" };

export default async function StudentApplicationsPage() {
  const user = await requireStudent();
  const applications = await listStudentApplications(user.student.id);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="My Applications" description="Track every application, upload documents and pay fees." actions={<ButtonLink href="/student/apply">New application</ButtonLink>} />

      {applications.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No applications yet" description="Find a training center near you and apply for a course." action={<ButtonLink href="/student/apply">Find a center & apply</ButtonLink>} />
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {applications.map((a) => {
              const action = nextAction({ ...a, missingDocuments: a.missingDocuments });
              return (
                <li key={a.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/student/applications/${a.id}`} className="font-mono text-body-sm font-semibold text-navy hover:underline">
                        {a.applicationNo}
                      </Link>
                      <p className="mt-0.5 font-semibold text-ink">{a.course.name}</p>
                      <p className="text-body-sm text-muted">
                        {a.center.name} · {a.batch ? a.batch.name : "Batch to be allocated"}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-caption text-muted">
                    <span>
                      Payable {formatINR(a.payableAmount)} · Paid {formatINR(a.paidAmount)}
                    </span>
                    <span>{formatDate(a.createdAt)}</span>
                  </div>
                  <ButtonLink href={action.href} size="sm" variant={action.actionable ? "primary" : "outline"} fullWidth className="mt-3">
                    {action.label}
                  </ButtonLink>
                </li>
              );
            })}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block">
            <TableWrap>
              <THead>
                <tr>
                  <TH>Application</TH>
                  <TH>Course & center</TH>
                  <TH>Batch</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Payable / Paid</TH>
                  <TH>Created</TH>
                  <TH>Next step</TH>
                </tr>
              </THead>
              <TBody>
                {applications.map((a) => {
                  const action = nextAction({ ...a, missingDocuments: a.missingDocuments });
                  return (
                    <TR key={a.id}>
                      <TD>
                        <Link href={`/student/applications/${a.id}`} className="font-mono text-body-sm font-semibold text-navy hover:underline">
                          {a.applicationNo}
                        </Link>
                      </TD>
                      <TD>
                        <p className="font-medium">{a.course.name}</p>
                        <p className="text-caption text-muted">
                          {a.center.name} <span className="font-mono">({a.center.code})</span>
                        </p>
                      </TD>
                      <TD className="text-body-sm">{a.batch ? `${a.batch.name}` : <span className="text-muted">To be allocated</span>}</TD>
                      <TD>
                        <StatusBadge status={a.status} />
                      </TD>
                      <TD className="text-right tabular-nums">
                        {formatINR(a.payableAmount)}
                        <span className="text-muted"> / {formatINR(a.paidAmount)}</span>
                      </TD>
                      <TD className="text-body-sm text-muted">{formatDate(a.createdAt)}</TD>
                      <TD>
                        <ButtonLink href={action.href} size="xs" variant={action.actionable ? "primary" : "outline"}>
                          {action.label}
                        </ButtonLink>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}
    </div>
  );
}
