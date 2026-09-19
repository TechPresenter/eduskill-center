import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { AuthUser } from "@/lib/auth/session";
import { toNumber } from "@/lib/utils";
import { batchAttendanceReport } from "@/server/attendance";

/**
 * Trainer-portal scope helpers. Every query here is scoped to ONE trainer:
 *   myBatches  = batches where trainerId = me OR I hold an active assignment on the batch (not deleted)
 *   myCenters  = centers of my active assignments (+ centers of my batches)
 *   myStudents = admissions ACTIVE / ON_HOLD / COMPLETED in my batches
 */

export type TrainerRef = NonNullable<AuthUser["trainer"]>;

export function trainerOf(user: AuthUser | null | undefined): TrainerRef {
  if (!user || user.role !== "TRAINER" || !user.trainer) throw Errors.forbidden();
  return user.trainer;
}

/** Inactive trainers can look but not act. */
export function assertActiveTrainer(user: AuthUser | null | undefined): TrainerRef {
  const t = trainerOf(user);
  if (t.status !== "ACTIVE") throw Errors.forbidden("Your trainer account is inactive. Please contact the Foundation.");
  return t;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** UTC calendar day (matches how attendance dates are stored). */
export function utcToday(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function batchMeetsOn(days: string[], weekday: string): boolean {
  const w = weekday.slice(0, 3).toLowerCase();
  return days.some((d) => d.trim().slice(0, 3).toLowerCase() === w);
}

export function myBatchWhere(trainerId: string): Prisma.BatchWhereInput {
  return { deletedAt: null, OR: [{ trainerId }, { trainerAssignments: { some: { trainerId, isActive: true } } }] };
}

const batchSelect = {
  id: true,
  code: true,
  name: true,
  startDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  days: true,
  capacity: true,
  room: true,
  status: true,
  notes: true,
  course: { select: { id: true, name: true, code: true, durationText: true, totalClasses: true } },
  center: { select: { id: true, name: true, code: true, address: true, villageTown: true, pincode: true, district: { select: { name: true } }, state: { select: { name: true } } } },
  _count: { select: { admissions: { where: { status: { in: ["ACTIVE", "ON_HOLD"] } } }, assignments: true, assessments: true, studyMaterials: true } },
} satisfies Prisma.BatchSelect;

export async function myBatches(trainerId: string) {
  const rows = await db.batch.findMany({ where: myBatchWhere(trainerId), select: batchSelect, orderBy: [{ startDate: "desc" }] });
  const order = { ONGOING: 0, UPCOMING: 1, COMPLETED: 2, CANCELLED: 3 } as const;
  return rows.sort((a, b) => order[a.status] - order[b.status] || b.startDate.getTime() - a.startDate.getTime());
}

export type MyBatch = Awaited<ReturnType<typeof myBatches>>[number];

export async function myBatchIds(trainerId: string): Promise<string[]> {
  const rows = await db.batch.findMany({ where: myBatchWhere(trainerId), select: { id: true } });
  return rows.map((r) => r.id);
}

/** A single batch of mine (404 when it is not in my scope). */
export async function myBatch(trainerId: string, batchId: string) {
  const b = await db.batch.findFirst({ where: { id: batchId, ...myBatchWhere(trainerId) }, select: batchSelect });
  if (!b) throw Errors.notFound("Batch");
  return b;
}

export async function myCenters(trainerId: string) {
  const [assignments, batches] = await Promise.all([
    db.trainerAssignment.findMany({ where: { trainerId, isActive: true }, select: { centerId: true } }),
    db.batch.findMany({ where: myBatchWhere(trainerId), select: { centerId: true } }),
  ]);
  const ids = [...new Set([...assignments.map((a) => a.centerId), ...batches.map((b) => b.centerId)])];
  if (ids.length === 0) return [];
  return db.center.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, name: true, code: true, address: true, pincode: true, phone: true, district: { select: { name: true } }, state: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export const myStudentsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  batchId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED"]).optional(),
});

const NO_MATCH = "00000000-0000-0000-0000-000000000000";

/** Students admitted to my batches (limited fields — no documents / private data). */
export async function myStudents(trainerId: string, q: z.infer<typeof myStudentsQuery> = {}) {
  const batchIds = await myBatchIds(trainerId);
  if (batchIds.length === 0) return [];
  const rows = await db.admission.findMany({
    where: {
      batchId: q.batchId ? (batchIds.includes(q.batchId) ? q.batchId : NO_MATCH) : { in: batchIds },
      status: q.status ? q.status : { in: ["ACTIVE", "ON_HOLD", "COMPLETED"] },
      ...(q.q
        ? { student: { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { studentId: { contains: q.q, mode: "insensitive" } }, { mobile: { contains: q.q } }] } }
        : {}),
    },
    orderBy: [{ batch: { startDate: "desc" } }, { student: { name: "asc" } }],
    include: {
      student: { select: { id: true, name: true, studentId: true, photoUrl: true, mobile: true, gender: true } },
      batch: { select: { id: true, code: true, name: true, status: true, course: { select: { name: true } } } },
      progress: true,
    },
  });
  return rows.map((r) => ({
    admissionId: r.id,
    admissionNo: r.admissionNo,
    status: r.status,
    admittedAt: r.admittedAt,
    student: r.student,
    batch: r.batch,
    attendancePct: toNumber(r.progress?.attendancePct),
    classesHeld: r.progress?.classesHeld ?? 0,
    classesAttended: r.progress?.classesAttended ?? 0,
    assignmentsTotal: r.progress?.assignmentsTotal ?? 0,
    assignmentsCompleted: r.progress?.assignmentsCompleted ?? 0,
    assessmentAvgPct: toNumber(r.progress?.assessmentAvgPct),
    completionPct: toNumber(r.progress?.completionPct),
  }));
}

export type MyStudent = Awaited<ReturnType<typeof myStudents>>[number];

export async function myAssignments(trainerId: string) {
  const rows = await db.trainerAssignment.findMany({
    where: { trainerId },
    orderBy: [{ isActive: "desc" }, { assignedAt: "desc" }],
    include: {
      center: { select: { id: true, name: true, code: true, address: true, villageTown: true, pincode: true, phone: true, district: { select: { name: true } }, state: { select: { name: true } } } },
      course: { select: { id: true, name: true, code: true } },
      batch: { select: { id: true, name: true, code: true, status: true } },
    },
  });
  return { active: rows.filter((r) => r.isActive), past: rows.filter((r) => !r.isActive) };
}

// ───────────────────────────── Profile ─────────────────────────────

export async function trainerProfile(trainerId: string) {
  const t = await db.trainer.findFirst({
    where: { id: trainerId, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, mobile: true, avatarUrl: true, lastLoginAt: true } },
      state: { select: { name: true } },
      district: { select: { name: true } },
      block: { select: { name: true } },
      application: { select: { applicationNo: true, experienceYears: true, teachingExperienceYears: true, availability: true, trainingMode: true, submittedAt: true } },
    },
  });
  if (!t) throw Errors.notFound("Trainer");
  return t;
}

export function trainerLocationLabel(t: { level: string; state: { name: string } | null; district: { name: string } | null; block: { name: string } | null }) {
  return [t.block?.name, t.district?.name, t.state?.name].filter(Boolean).join(", ");
}

export const trainerProfileSchema = z.object({
  bio: z.string().trim().max(2000).optional().nullable(),
  qualification: z.string().trim().max(200).optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  languages: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  photoUrl: z.string().trim().max(500).optional().nullable(),
});

export async function updateTrainerProfile(user: AuthUser, input: z.infer<typeof trainerProfileSchema>, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const t = trainerOf(user);
  const before = await db.trainer.findFirst({ where: { id: t.id, deletedAt: null }, select: { bio: true, qualification: true, skills: true, languages: true } });
  if (!before) throw Errors.notFound("Trainer");
  if (input.photoUrl && !input.photoUrl.startsWith(`/api/files/private/trainers/${t.id}/photo/`)) throw Errors.badRequest("Invalid photo");
  const updated = await db.$transaction(async (tx) => {
    const tr = await tx.trainer.update({
      where: { id: t.id },
      data: { bio: input.bio || null, qualification: input.qualification || null, skills: input.skills, languages: input.languages },
    });
    if (input.photoUrl) await tx.user.update({ where: { id: user.id }, data: { avatarUrl: input.photoUrl } });
    return tr;
  });
  await audit({
    user: { id: user.id, name: user.name, role: user.role },
    action: "update_profile",
    module: "trainers",
    recordType: "Trainer",
    recordId: t.id,
    description: `${user.name} updated their trainer profile`,
    oldValue: before,
    newValue: { bio: updated.bio, qualification: updated.qualification, skills: updated.skills, languages: updated.languages, photoUrl: input.photoUrl ?? undefined },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

// ───────────────────────────── Dashboard / timetable ─────────────────────────────

export async function classesOn(trainerId: string, day: Date) {
  const weekday = WEEKDAYS[day.getUTCDay()]!;
  const batches = await db.batch.findMany({
    where: { ...myBatchWhere(trainerId), status: { in: ["ONGOING", "UPCOMING"] }, startDate: { lte: day }, endDate: { gte: day } },
    select: { id: true, code: true, name: true, days: true, startTime: true, endTime: true, room: true, status: true, course: { select: { name: true } }, center: { select: { name: true, code: true } } },
    orderBy: { startTime: "asc" },
  });
  const todays = batches.filter((b) => batchMeetsOn(b.days, weekday));
  if (todays.length === 0) return [];
  const marked = await db.attendance.groupBy({ by: ["batchId"], where: { batchId: { in: todays.map((b) => b.id) }, date: day } });
  const markedSet = new Set(marked.map((m) => m.batchId));
  return todays.map((b) => ({ ...b, attendanceMarked: markedSet.has(b.id) }));
}

export async function trainerDashboard(user: AuthUser) {
  const t = trainerOf(user);
  const today = utcToday();
  const [profile, batches, activeAssignments, centers, announcements, notifications, todayClasses] = await Promise.all([
    trainerProfile(t.id),
    myBatches(t.id),
    db.trainerAssignment.findMany({ where: { trainerId: t.id, isActive: true }, select: { id: true, course: { select: { id: true, name: true, code: true } } } }),
    myCenters(t.id),
    visibleAnnouncements(t.id, 5),
    db.notification.findMany({ where: { userId: user.id, channel: "IN_APP" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, body: true, readAt: true, createdAt: true } }),
    classesOn(t.id, today),
  ]);
  const batchIds = batches.map((b) => b.id);
  const students = batchIds.length ? await db.admission.count({ where: { batchId: { in: batchIds }, status: { in: ["ACTIVE", "ON_HOLD"] } } }) : 0;
  // Distinct courses I teach (from my batches) or am assigned to (course-level assignments).
  const courseMap = new Map<string, { id: string; name: string; code: string }>();
  for (const b of batches) courseMap.set(b.course.id, { id: b.course.id, name: b.course.name, code: b.course.code });
  for (const a of activeAssignments) if (a.course) courseMap.set(a.course.id, a.course);
  return {
    profile,
    today,
    centers,
    courses: [...courseMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    stats: {
      activeAssignments: activeAssignments.length,
      ongoing: batches.filter((b) => b.status === "ONGOING").length,
      upcoming: batches.filter((b) => b.status === "UPCOMING").length,
      completed: batches.filter((b) => b.status === "COMPLETED").length,
      students,
      classesToday: todayClasses.length,
      pendingAttendance: todayClasses.filter((c) => !c.attendanceMarked).length,
    },
    todayClasses,
    batches: batches.slice(0, 5),
    announcements,
    notifications,
  };
}

export async function weeklyTimetable(trainerId: string) {
  const today = utcToday();
  const batches = await db.batch.findMany({
    where: { ...myBatchWhere(trainerId), status: { in: ["ONGOING", "UPCOMING"] } },
    select: { id: true, code: true, name: true, days: true, startTime: true, endTime: true, room: true, status: true, startDate: true, endDate: true, course: { select: { name: true } }, center: { select: { name: true, code: true } } },
    orderBy: { startTime: "asc" },
  });
  const grid = WEEKDAYS.map((d) => ({ day: d, classes: batches.filter((b) => batchMeetsOn(b.days, d)) }));
  const upcomingAssessments = await db.assessment.findMany({
    where: { batch: myBatchWhere(trainerId), date: { gte: today } },
    orderBy: { date: "asc" },
    take: 10,
    include: { batch: { select: { id: true, code: true, name: true } } },
  });
  return { today, todayIndex: today.getUTCDay(), grid, upcomingAssessments };
}

// ───────────────────────────── Account security (settings page + /api/trainer/sessions) ─────────────────────────────

export async function trainerSessions(user: AuthUser) {
  const [sessions, loginHistory] = await Promise.all([
    db.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true } }),
    db.loginHistory.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, success: true, reason: true, ip: true, userAgent: true, createdAt: true } }),
  ]);
  return { currentSessionId: user.sessionId, sessions: sessions.map((s) => ({ ...s, current: s.id === user.sessionId })), loginHistory };
}

// ───────────────────────────── Announcements visible to me ─────────────────────────────

export async function visibleAnnouncements(trainerId: string, take?: number) {
  const [batchIds, centers] = await Promise.all([myBatchIds(trainerId), myCenters(trainerId)]);
  return db.announcement.findMany({
    where: {
      isPublished: true,
      OR: [
        { audience: "ALL" },
        { audience: "TRAINERS" },
        { audience: "CENTER", centerId: { in: centers.map((c) => c.id) } },
        { audience: "BATCH", batchId: { in: batchIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
    include: { batch: { select: { id: true, code: true, name: true } }, center: { select: { id: true, name: true, code: true } } },
  });
}

// ───────────────────────────── Batch detail (for /trainer/batches/[id]) ─────────────────────────────

export async function batchDetailForTrainer(trainerId: string, batchId: string) {
  const batch = await myBatch(trainerId, batchId);
  const [roster, report, assignments, assessments, materials, announcements] = await Promise.all([
    db.admission.findMany({
      where: { batchId, status: { in: ["ACTIVE", "ON_HOLD", "COMPLETED"] } },
      orderBy: { student: { name: "asc" } },
      include: {
        student: { select: { id: true, name: true, studentId: true, photoUrl: true, mobile: true } },
        progress: { select: { attendancePct: true, classesHeld: true, classesAttended: true, assignmentsCompleted: true, assignmentsTotal: true, completionPct: true } },
      },
    }),
    batchAttendanceReport(batchId),
    db.assignment.findMany({ where: { batchId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { submissions: true } } } }),
    db.assessment.findMany({ where: { batchId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], include: { _count: { select: { results: true } } } }),
    db.studyMaterial.findMany({ where: { batchId }, orderBy: { createdAt: "desc" } }),
    db.announcement.findMany({ where: { batchId, isPublished: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    batch,
    roster: roster.map((r) => ({
      admissionId: r.id,
      admissionNo: r.admissionNo,
      status: r.status,
      student: r.student,
      attendancePct: toNumber(r.progress?.attendancePct),
      classesHeld: r.progress?.classesHeld ?? 0,
      classesAttended: r.progress?.classesAttended ?? 0,
      assignmentsCompleted: r.progress?.assignmentsCompleted ?? 0,
      assignmentsTotal: r.progress?.assignmentsTotal ?? 0,
      completionPct: toNumber(r.progress?.completionPct),
    })),
    report,
    assignments,
    assessments,
    materials,
    announcements,
  };
}
