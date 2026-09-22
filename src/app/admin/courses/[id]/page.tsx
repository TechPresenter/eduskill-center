import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarDays, ClipboardList, GraduationCap, Award, Star, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatINR, formatNumber, titleCase } from "@/lib/utils";
import { getCourseAdmin, studentDocumentTypes } from "@/server/courses";
import { PageHeader, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/ui/icon";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { orNotFound } from "@/components/admin/shared/server";
import { CourseHeaderActions } from "@/components/admin/courses/course-actions";
import { parseSyllabus } from "@/app/admin/courses/syllabus";
import { IconTile, RecordIdentity } from "@/components/admin/locations/list-kit";
import { withBasePath } from "@/lib/base-path";

export const metadata: Metadata = { title: "Course · Foundation Admin" };

const APP_ORDER = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "WAITLISTED", "REJECTED", "CANCELLED", "COMPLETED"];

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("courses.view");
  const { id } = await params;
  const [course, docTypes] = await Promise.all([orNotFound(getCourseAdmin(id)), studentDocumentTypes()]);
  const perms = { update: hasPermission(user, "courses.update"), delete: hasPermission(user, "courses.delete") };
  const syllabus = parseSyllabus(course.syllabus);
  const totalFee = course.courseFee + course.registrationFee + course.examFee + course.certificateFee;
  const appTotal = Object.values(course.stats.applicationsByStatus).reduce((a, b) => a + b, 0);
  const docName = (key: string) => docTypes.find((d) => d.key === key)?.name ?? key;

  return (
    <div className="space-y-6">
      {/* Identity and status first on phones, where the app bar only has room for a code. */}
      <RecordIdentity
        lead={<IconTile icon={<DynamicIcon name={course.icon ?? undefined} />} size="lg" />}
        title={course.name}
        meta={<span className="font-mono font-semibold text-navy">{course.code}</span>}
        badges={
          <>
            <StatusBadge status={course.status} />
            {course.isFeatured && (
              <Badge tone="orange">
                <Star className="h-3.5 w-3.5" /> Featured
              </Badge>
            )}
          </>
        }
      />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-lavender text-navy">
              <DynamicIcon name={course.icon ?? undefined} className="h-5 w-5" />
            </span>
            {course.name}
            <StatusBadge status={course.status} />
            {course.isFeatured && (
              <Badge tone="orange">
                <Star className="h-3.5 w-3.5" /> Featured
              </Badge>
            )}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">{course.code}</span>
            {course.category && <span>· {course.category.name}</span>}
            <span>
              · {course.durationText} · {titleCase(course.level)} · {titleCase(course.mode)}
            </span>
            {course.status === "ACTIVE" && (
              <Link href={`/courses/${course.slug}`} className="inline-flex items-center gap-1 text-orange hover:underline" target="_blank" rel="noreferrer">
                Public page <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </span>
        }
        backHref="/admin/courses"
        mobileTitle={course.code}
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.code }]}
        actions={<CourseHeaderActions course={{ id: course.id, code: course.code, name: course.name, status: course.status, batches: course._count.batches, applications: course._count.applications }} perms={perms} />}
      />


      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatsCard label="Centers offering" value={course.centers.length} icon={<Building2 className="h-5 w-5" />} tone="navy" />
        <StatsCard label="Batches" value={course._count.batches} icon={<CalendarDays className="h-5 w-5" />} tone="orange" href={`/admin/batches?courseId=${course.id}`} />
        <StatsCard label="Applications" value={appTotal} hint={`${formatNumber(course.stats.applicationsByStatus.SUBMITTED ?? 0)} submitted · ${formatNumber(course.stats.applicationsByStatus.UNDER_REVIEW ?? 0)} in review`} icon={<ClipboardList className="h-5 w-5" />} tone="warning" href={`/admin/applications?courseId=${course.id}`} />
        <StatsCard label="Active students" value={course.stats.activeStudents} icon={<GraduationCap className="h-5 w-5" />} tone="success" />
        <StatsCard label="Completed" value={course.stats.completed} icon={<GraduationCap className="h-5 w-5" />} tone="info" />
        <StatsCard label="Certificates" value={course._count.certificates} icon={<Award className="h-5 w-5" />} tone="navy" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Course details" />
            <CardBody className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <KeyValue label="Short description" value={course.shortDescription ?? "—"} />
              </div>
              <KeyValue label="Duration" value={`${course.durationText}${course.durationWeeks ? ` (${course.durationWeeks} weeks)` : ""} · ${course.totalClasses} classes`} />
              <KeyValue label="Age range" value={course.minAge || course.maxAge ? `${course.minAge ?? "—"} – ${course.maxAge ?? "—"} years` : "Any age"} />
              <div className="sm:col-span-2">
                <KeyValue label="Eligibility" value={course.eligibility ?? "—"} />
              </div>
              <KeyValue label="Minimum attendance" value={`${course.minAttendancePct}%`} />
              <KeyValue label="Passing marks" value={`${course.passingMarksPct}%`} />
              <div className="sm:col-span-2">
                <KeyValue label="Certificate eligibility" value={course.certificateEligibility ?? "—"} />
              </div>
              <div className="sm:col-span-2">
                <KeyValue label="Required documents" value={course.requiredDocuments.length ? <span className="flex flex-wrap gap-1.5">{course.requiredDocuments.map((d) => <Badge key={d}>{docName(d)}</Badge>)}</span> : "None"} />
              </div>
              {course.description && (
                <div className="sm:col-span-2">
                  <KeyValue label="Description" value={<span className="whitespace-pre-line">{course.description}</span>} />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Syllabus" description={`${syllabus.length} module${syllabus.length === 1 ? "" : "s"}`} />
            <CardBody>
              {syllabus.length === 0 ? (
                <p className="text-body-sm text-muted">No syllabus added yet.</p>
              ) : (
                <ol className="space-y-3">
                  {syllabus.map((m, i) => (
                    <li key={i} className="rounded-md border border-line p-4">
                      <p className="text-caption font-semibold tracking-wide text-orange uppercase">{m.module}</p>
                      <p className="font-semibold text-navy">{m.title || "Untitled"}</p>
                      {m.topics.length > 0 && <p className="mt-1 text-body-sm text-muted">{m.topics.join(" · ")}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent batches" description="Latest 25 batches for this course." action={<Link href={`/admin/batches?courseId=${course.id}`} className="text-caption font-semibold text-orange hover:underline">All batches</Link>} />
            <TableWrap className="rounded-none border-0">
              <THead>
                <tr>
                  <TH>Batch</TH>
                  <TH>Center</TH>
                  <TH>Dates</TH>
                  <TH>Trainer</TH>
                  <TH className="text-right">Students</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {course.batches.length === 0 && <EmptyRow colSpan={6}>No batches yet.</EmptyRow>}
                {course.batches.map((b) => (
                  <TR key={b.id}>
                    <TD primary>
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <Link href={`/admin/batches/${b.id}`} className="font-medium text-navy hover:underline">
                            {b.name}
                          </Link>
                          <span className="block font-mono text-caption font-normal text-muted">{b.code}</span>
                        </span>
                        <span className="shrink-0 md:hidden">
                          <StatusBadge status={b.status} />
                        </span>
                      </span>
                    </TD>
                    <TD label="Center">
                      <Link href={`/admin/centers/${b.center.id}`} className="hover:underline">
                        {b.center.name}
                      </Link>
                    </TD>
                    <TD label="Dates" className="text-caption md:whitespace-nowrap">
                      {formatDate(b.startDate)} – {formatDate(b.endDate)}
                    </TD>
                    <TD label="Trainer">{b.trainer?.user.name ?? <span className="text-muted">—</span>}</TD>
                    <TD label="Students" className="text-right tabular-nums">
                      {b._count.admissions}/{b.capacity}
                    </TD>
                    <TD mobile="hidden">
                      <StatusBadge status={b.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </Card>
        </div>

        <div className="space-y-4">
          {course.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBasePath(course.image)} alt={course.name} className="aspect-[4/3] w-full rounded-card border border-line object-cover" />
          )}
          <Card>
            <CardHeader title="Fees" />
            <CardBody>
              <dl className="space-y-2 text-body-sm">
                {[
                  ["Course fee", course.courseFee],
                  ["Registration fee", course.registrationFee],
                  ["Exam fee", course.examFee],
                  ["Certificate fee", course.certificateFee],
                ].map(([label, amount]) => (
                  <div key={String(label)} className="flex justify-between">
                    <dt className="text-muted">{label}</dt>
                    <dd className="tabular-nums">{formatINR(amount)}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-line pt-2 font-semibold text-navy">
                  <dt>Total payable</dt>
                  <dd className="tabular-nums">{totalFee === 0 ? "Free" : formatINR(totalFee)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-caption text-muted">{course.scholarshipAvailable ? `Scholarship available. ${course.scholarshipNote ?? ""}` : "No scholarship for this course."}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Applications by status" />
            <CardBody className="flex flex-wrap gap-2">
              {appTotal === 0 && <p className="text-body-sm text-muted">No applications yet.</p>}
              {APP_ORDER.filter((s) => course.stats.applicationsByStatus[s]).map((s) => (
                <Link key={s} href={`/admin/applications?courseId=${course.id}&status=${s}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-ink hover:border-navy/40 sm:min-h-0">
                  {titleCase(s)} <span className="rounded-full bg-white px-1.5 font-bold text-navy tabular-nums">{formatNumber(course.stats.applicationsByStatus[s])}</span>
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Centers offering this course" description={`${course.centers.length} center${course.centers.length === 1 ? "" : "s"}`} />
            <ul className="divide-y divide-line">
              {course.centers.length === 0 && <li className="px-5 py-4 text-body-sm text-muted">Not offered at any center yet. Add it from a center&apos;s Courses tab.</li>}
              {course.centers.map((cc) => (
                <li key={cc.centerId} className="flex min-h-14 items-center justify-between gap-3 px-5 py-3 text-body-sm sm:min-h-0">
                  <Link href={`/admin/centers/${cc.center.id}`} className="min-w-0">
                    <span className="block truncate font-medium text-navy hover:underline">{cc.center.name}</span>
                    <span className="block text-caption text-muted">
                      {cc.center.code} · {cc.center.district.name}, {cc.center.state.name}
                    </span>
                  </Link>
                  <StatusBadge status={cc.center.status} />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="SEO" />
            <CardBody className="space-y-3">
              <KeyValue label="Title" value={course.seoTitle ?? "—"} />
              <KeyValue label="Description" value={course.seoDescription ?? "—"} />
              <KeyValue label="Slug" value={<span className="font-mono text-caption">{course.slug}</span>} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
