import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTrainer } from "@/lib/auth/guards";
import { formatDate, isUuid, toNumber } from "@/lib/utils";
import { batchDetailForTrainer } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { BatchTabs } from "./batch-tabs";

export const metadata: Metadata = { title: "Batch" };

export default async function TrainerBatchDetailPage({ params }: PageProps<"/trainer/batches/[id]">) {
  const user = await requireTrainer();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  let detail: Awaited<ReturnType<typeof batchDetailForTrainer>>;
  try {
    detail = await batchDetailForTrainer(user.trainer.id, id);
  } catch {
    notFound();
  }
  const b = detail.batch;
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Batches", href: "/trainer/batches" }, { label: b.code }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {b.name} <StatusBadge status={b.status} />
          </span>
        }
        description={`${b.course.name} · ${b.center.name} (${b.center.code}) · ${formatDate(b.startDate)} – ${formatDate(b.endDate)}`}
        actions={
          <>
            <ButtonLink href={`/trainer/attendance?batchId=${b.id}`} variant="navy" size="sm">
              Mark attendance
            </ButtonLink>
            <ButtonLink href={`/trainer/coursework?batchId=${b.id}`} variant="outline" size="sm">
              Coursework
            </ButtonLink>
          </>
        }
      />
      <InactiveBanner status={user.trainer.status} />
      <BatchTabs
        batch={{
          id: b.id,
          code: b.code,
          name: b.name,
          status: b.status,
          startDate: b.startDate.toISOString(),
          endDate: b.endDate.toISOString(),
          startTime: b.startTime,
          endTime: b.endTime,
          days: b.days,
          room: b.room,
          capacity: b.capacity,
          notes: b.notes,
          admitted: b._count.admissions,
          course: { name: b.course.name, code: b.course.code, durationText: b.course.durationText, totalClasses: b.course.totalClasses },
          center: { name: b.center.name, code: b.center.code, address: [b.center.address, b.center.villageTown, b.center.district.name, b.center.state.name, b.center.pincode].filter(Boolean).join(", ") },
        }}
        roster={detail.roster.map((r) => ({ ...r, student: { ...r.student } }))}
        report={{ held: detail.report.held, rows: detail.report.rows, daily: detail.report.daily.map((d) => ({ ...d, date: d.date.toISOString() })) }}
        assignments={detail.assignments.map((a) => ({ id: a.id, title: a.title, dueDate: iso(a.dueDate), maxMarks: a.maxMarks, submissions: a._count.submissions, attachmentUrl: a.attachmentUrl }))}
        assessments={detail.assessments.map((a) => ({ id: a.id, title: a.title, type: a.type, date: iso(a.date), maxMarks: a.maxMarks, passingMarks: a.passingMarks, weightage: a.weightage, results: a._count.results }))}
        materials={detail.materials.map((m) => ({ id: m.id, title: m.title, description: m.description, fileUrl: m.fileUrl, fileType: m.fileType, createdAt: m.createdAt.toISOString(), mine: m.uploadedById === user.id }))}
        announcements={detail.announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, createdAt: a.createdAt.toISOString() }))}
        avgAttendance={detail.roster.length ? Math.round((detail.roster.reduce((s, r) => s + toNumber(r.attendancePct), 0) / detail.roster.length) * 10) / 10 : 0}
      />
    </>
  );
}
