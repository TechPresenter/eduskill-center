import { db } from "@/lib/db";
import type { AdmissionStatus } from "@/generated/prisma/enums";
import { getPaging, paged } from "@/lib/api/query";
import { toNumber } from "@/lib/utils";

/** Course choices for the center form (active + draft, plus anything already offered). */
export async function centerCourseOptions(includeIds: string[] = []) {
  return db.course.findMany({
    where: { deletedAt: null, OR: [{ status: { in: ["ACTIVE", "DRAFT"] } }, { id: { in: includeIds } }] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, status: true, durationText: true, category: { select: { name: true } } },
  });
}

/** Active trainers for the assignment drawer. */
export async function activeTrainerOptions() {
  const rows = await db.trainer.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { user: { name: "asc" } },
    select: { id: true, trainerId: true, level: true, skills: true, user: { select: { name: true } }, state: { select: { name: true } }, district: { select: { name: true } }, assignments: { where: { isActive: true }, select: { centerId: true } } },
  });
  return rows.map((t) => ({ id: t.id, trainerId: t.trainerId, name: t.user.name, level: t.level, skills: t.skills, location: [t.district?.name, t.state.name].filter(Boolean).join(", "), centerIds: Array.from(new Set(t.assignments.map((a) => a.centerId))) }));
}

/** Admissions (current and past students) at a center. */
export async function centerAdmissions(centerId: string, q: { page: number; limit: number; status?: string }) {
  const where = { centerId, ...(q.status ? { status: { in: q.status.split(",").filter(Boolean) as AdmissionStatus[] } } : {}) };
  const [items, total, byStatus] = await Promise.all([
    db.admission.findMany({
      where,
      orderBy: { admittedAt: "desc" },
      ...getPaging(q),
      include: {
        student: { select: { id: true, name: true, studentId: true, mobile: true, photoUrl: true } },
        course: { select: { id: true, name: true, code: true } },
        batch: { select: { id: true, name: true, code: true, status: true } },
        trainer: { select: { id: true, trainerId: true, user: { select: { name: true } } } },
        progress: { select: { attendancePct: true, completionPct: true, certificateEligible: true } },
      },
    }),
    db.admission.count({ where }),
    db.admission.groupBy({ by: ["status"], where: { centerId }, _count: { _all: true } }),
  ]);
  return {
    ...paged(
      items.map((a) => ({ ...a, attendancePct: a.progress ? toNumber(a.progress.attendancePct) : null, completionPct: a.progress ? toNumber(a.progress.completionPct) : null })),
      total,
      q
    ),
    byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])) as Record<string, number>,
  };
}

/** Occupancy per batch for the reports tab. */
export async function centerBatchOccupancy(centerId: string) {
  const batches = await db.batch.findMany({ where: { centerId, deletedAt: null }, orderBy: { startDate: "desc" }, select: { id: true, code: true, name: true, status: true, capacity: true, startDate: true, endDate: true, course: { select: { name: true } } } });
  const out = [];
  for (const b of batches) {
    const [admitted, reserved, completed] = await Promise.all([
      db.admission.count({ where: { batchId: b.id, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
      db.application.count({ where: { batchId: b.id, status: { in: ["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED"] } } }),
      db.admission.count({ where: { batchId: b.id, status: "COMPLETED" } }),
    ]);
    out.push({ ...b, admitted, reserved, completed, occupied: admitted + reserved, available: Math.max(0, b.capacity - admitted - reserved) });
  }
  return out;
}
