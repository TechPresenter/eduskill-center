import { z } from "zod";
import { db, Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { toNumber } from "@/lib/utils";
import { dateRangeSchema, resolveDateRange } from "@/lib/api/query";

export const dashboardQuerySchema = dateRangeSchema;
export type DateRange = { from?: Date; to?: Date };

function inRange(field: string, r: DateRange) {
  return r.from || r.to ? { [field]: { gte: r.from, lt: r.to } } : {};
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(n: number) {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: monthKey(d), label: d.toLocaleString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }) });
  }
  return out;
}

function fillMonths<T extends Record<string, number>>(rows: { month: string; [k: string]: unknown }[], n: number, keys: (keyof T)[]) {
  const months = lastMonths(n);
  const map = new Map(rows.map((r) => [r.month, r]));
  return months.map((m) => {
    const r = map.get(m.key);
    const obj: Record<string, number | string> = { month: m.label, key: m.key };
    for (const k of keys) obj[k as string] = r ? toNumber(r[k as string]) : 0;
    return obj;
  });
}

// ───────────────────────────── KPIs ─────────────────────────────

export async function getDashboardKpis(range: DateRange) {
  const activeCenter = { deletedAt: null, status: "ACTIVE" as const };
  const [
    statesWithCenters,
    districtsWithCenters,
    blocksWithCenters,
    activeStates,
    activeDistricts,
    activeBlocks,
    centersTotal,
    centersActive,
    centersVerified,
    centersPending,
    studentsTotal,
    studentsRegistered,
    activeStudents,
    trainersTotal,
    trainersActive,
    trainersByLevel,
    coursesActive,
    coursesTotal,
    batchesByStatus,
    applicationsByStatus,
    applicationsInRange,
    admissionsTotal,
    admissionsInRange,
    pendingPayments,
    revenueTotal,
    revenueInRange,
    scholarshipsAwarded,
    scholarshipsInRange,
    certificatesIssued,
    certificatesInRange,
    trainerApplicationsInRange,
    trainerApplicationsPending,
  ] = await Promise.all([
    db.center.groupBy({ by: ["stateId"], where: activeCenter }).then((r) => r.length),
    db.center.groupBy({ by: ["districtId"], where: activeCenter }).then((r) => r.length),
    db.center.groupBy({ by: ["blockId"], where: activeCenter }).then((r) => r.length),
    db.state.count({ where: { isActive: true } }),
    db.district.count({ where: { isActive: true } }),
    db.block.count({ where: { isActive: true } }),
    db.center.count({ where: { deletedAt: null } }),
    db.center.count({ where: activeCenter }),
    db.center.count({ where: { deletedAt: null, isVerified: true } }),
    db.center.count({ where: { deletedAt: null, status: "PENDING" } }),
    db.student.count({ where: { deletedAt: null } }),
    db.student.count({ where: { deletedAt: null, studentId: { not: null } } }),
    db.admission.groupBy({ by: ["studentId"], where: { status: "ACTIVE" } }).then((r) => r.length),
    db.trainer.count({ where: { deletedAt: null } }),
    db.trainer.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.trainer.groupBy({ by: ["level"], where: { deletedAt: null }, _count: { _all: true } }),
    db.course.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.course.count({ where: { deletedAt: null } }),
    db.batch.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    db.application.groupBy({ by: ["status"], _count: { _all: true } }),
    db.application.count({ where: inRange("createdAt", range) }),
    db.admission.count(),
    db.admission.count({ where: inRange("admittedAt", range) }),
    db.application.aggregate({ where: { status: "PAYMENT_PENDING" }, _count: { _all: true }, _sum: { payableAmount: true, paidAmount: true } }),
    db.payment.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true }, _count: { _all: true } }),
    db.payment.aggregate({ where: { status: "COMPLETED", ...inRange("paidAt", range) }, _sum: { amount: true }, _count: { _all: true } }),
    db.scholarshipAward.aggregate({ where: { status: "APPROVED" }, _count: { _all: true }, _sum: { scholarshipAmount: true } }),
    db.scholarshipAward.aggregate({ where: { status: "APPROVED", ...inRange("approvedAt", range) }, _count: { _all: true }, _sum: { scholarshipAmount: true } }),
    db.certificate.count({ where: { status: "ISSUED" } }),
    db.certificate.count({ where: { status: "ISSUED", ...inRange("issuedAt", range) } }),
    db.trainerApplication.count({ where: inRange("submittedAt", range) }),
    db.trainerApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "SHORTLISTED", "INTERVIEW", "VERIFIED"] } } }),
  ]);

  const appStatus = Object.fromEntries(applicationsByStatus.map((a) => [a.status, a._count._all])) as Record<string, number>;
  const batchStatus = Object.fromEntries(batchesByStatus.map((b) => [b.status, b._count._all])) as Record<string, number>;
  const level = Object.fromEntries(trainersByLevel.map((t) => [t.level, t._count._all])) as Record<string, number>;

  return {
    locations: { statesWithCenters, districtsWithCenters, blocksWithCenters, activeStates, activeDistricts, activeBlocks },
    centers: { total: centersTotal, active: centersActive, verified: centersVerified, pending: centersPending },
    students: { total: studentsTotal, registered: studentsRegistered, active: activeStudents },
    trainers: { total: trainersTotal, active: trainersActive, block: level.BLOCK ?? 0, district: level.DISTRICT ?? 0, state: level.STATE ?? 0 },
    courses: { active: coursesActive, total: coursesTotal },
    batches: { ongoing: batchStatus.ONGOING ?? 0, upcoming: batchStatus.UPCOMING ?? 0, completed: batchStatus.COMPLETED ?? 0, cancelled: batchStatus.CANCELLED ?? 0, total: Object.values(batchStatus).reduce((a, b) => a + b, 0) },
    applications: {
      total: Object.values(appStatus).reduce((a, b) => a + b, 0),
      inRange: applicationsInRange,
      byStatus: appStatus,
      pendingReview: (appStatus.SUBMITTED ?? 0) + (appStatus.UNDER_REVIEW ?? 0) + (appStatus.DOCUMENTS_REQUIRED ?? 0),
    },
    admissions: { total: admissionsTotal, inRange: admissionsInRange },
    pendingPayments: { count: pendingPayments._count._all, amountDue: Math.max(0, toNumber(pendingPayments._sum.payableAmount) - toNumber(pendingPayments._sum.paidAmount)) },
    revenue: { total: toNumber(revenueTotal._sum.amount), totalCount: revenueTotal._count._all, inRange: toNumber(revenueInRange._sum.amount), inRangeCount: revenueInRange._count._all },
    scholarships: { count: scholarshipsAwarded._count._all, amount: toNumber(scholarshipsAwarded._sum.scholarshipAmount), inRangeCount: scholarshipsInRange._count._all, inRangeAmount: toNumber(scholarshipsInRange._sum.scholarshipAmount) },
    certificates: { issued: certificatesIssued, inRange: certificatesInRange },
    trainerApplications: { inRange: trainerApplicationsInRange, pending: trainerApplicationsPending },
  };
}

// ───────────────────────────── Charts ─────────────────────────────

export async function getDashboardCharts() {
  const [stateStudents, districtCenters, blockCenters, monthlyAdmissions, coursePopularity, attendanceByBatch, attendanceWeekly, revenueByMonth, scholarshipsByMonth, trainerLevel, trainerStatus, centerPerf] = await Promise.all([
    db.$queryRaw<{ name: string; code: string; students: number }[]>`
      SELECT s."name", s."code", COUNT(st."id")::int AS students
      FROM "students" st JOIN "states" s ON s."id" = st."state_id"
      WHERE st."deleted_at" IS NULL
      GROUP BY s."id", s."name", s."code" ORDER BY students DESC, s."name" ASC LIMIT 15`,
    db.$queryRaw<{ name: string; centers: number }[]>`
      SELECT d."name" || ', ' || s."code" AS name, COUNT(c."id")::int AS centers
      FROM "centers" c JOIN "districts" d ON d."id" = c."district_id" JOIN "states" s ON s."id" = d."state_id"
      WHERE c."deleted_at" IS NULL
      GROUP BY d."id", d."name", s."code" ORDER BY centers DESC, d."name" ASC LIMIT 15`,
    db.$queryRaw<{ name: string; centers: number }[]>`
      SELECT b."name" || ' (' || d."name" || ')' AS name, COUNT(c."id")::int AS centers
      FROM "centers" c JOIN "blocks" b ON b."id" = c."block_id" JOIN "districts" d ON d."id" = b."district_id"
      WHERE c."deleted_at" IS NULL
      GROUP BY b."id", b."name", d."name" ORDER BY centers DESC, b."name" ASC LIMIT 15`,
    db.$queryRaw<{ month: string; admissions: number }[]>`
      SELECT to_char(date_trunc('month', "admitted_at" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month, COUNT(*)::int AS admissions
      FROM "admissions" WHERE "admitted_at" >= (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '11 months')
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ name: string; code: string; applications: number }[]>`
      SELECT co."name", co."code", COUNT(a."id")::int AS applications
      FROM "applications" a JOIN "courses" co ON co."id" = a."course_id"
      GROUP BY co."id", co."name", co."code" ORDER BY applications DESC, co."name" ASC LIMIT 10`,
    db.$queryRaw<{ id: string; name: string; code: string; pct: number; marks: number }[]>`
      SELECT b."id", b."name", b."code",
        ROUND(100.0 * SUM(CASE WHEN at."status" IN ('PRESENT','LATE') THEN 1 ELSE 0 END) / NULLIF(COUNT(at."id"), 0), 1)::float AS pct,
        COUNT(at."id")::int AS marks
      FROM "attendance" at JOIN "batches" b ON b."id" = at."batch_id"
      WHERE b."deleted_at" IS NULL
      GROUP BY b."id", b."name", b."code" ORDER BY marks DESC LIMIT 10`,
    db.$queryRaw<{ week: string; pct: number; marks: number }[]>`
      SELECT to_char(date_trunc('week', "date"), 'YYYY-MM-DD') AS week,
        ROUND(100.0 * SUM(CASE WHEN "status" IN ('PRESENT','LATE') THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1)::float AS pct,
        COUNT(*)::int AS marks
      FROM "attendance" WHERE "date" >= (CURRENT_DATE - interval '12 weeks')
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ month: string; revenue: number; payments: number }[]>`
      SELECT to_char(date_trunc('month', COALESCE("paid_at", "created_at") AT TIME ZONE 'UTC'), 'YYYY-MM') AS month, SUM("amount")::float AS revenue, COUNT(*)::int AS payments
      FROM "payments" WHERE "status" = 'COMPLETED' AND COALESCE("paid_at", "created_at") >= (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '11 months')
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ month: string; amount: number; awards: number }[]>`
      SELECT to_char(date_trunc('month', COALESCE("approved_at", "created_at") AT TIME ZONE 'UTC'), 'YYYY-MM') AS month, SUM("scholarship_amount")::float AS amount, COUNT(*)::int AS awards
      FROM "scholarship_awards" WHERE "status" = 'APPROVED' AND COALESCE("approved_at", "created_at") >= (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '11 months')
      GROUP BY 1 ORDER BY 1`,
    db.trainer.groupBy({ by: ["level"], where: { deletedAt: null }, _count: { _all: true } }),
    db.trainer.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    db.$queryRaw<{ id: string; code: string; name: string; students: number; applications: number; completed: number; dropped: number; attendance: number | null; revenue: number }[]>`
      SELECT c."id", c."code", c."name",
        (SELECT COUNT(*) FROM "admissions" ad WHERE ad."center_id" = c."id" AND ad."status" IN ('ACTIVE','ON_HOLD'))::int AS students,
        (SELECT COUNT(*) FROM "applications" ap WHERE ap."center_id" = c."id")::int AS applications,
        (SELECT COUNT(*) FROM "admissions" ad WHERE ad."center_id" = c."id" AND ad."status" = 'COMPLETED')::int AS completed,
        (SELECT COUNT(*) FROM "admissions" ad WHERE ad."center_id" = c."id" AND ad."status" = 'DROPPED')::int AS dropped,
        (SELECT ROUND(100.0 * SUM(CASE WHEN at."status" IN ('PRESENT','LATE') THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1)::float
           FROM "attendance" at JOIN "batches" b ON b."id" = at."batch_id" WHERE b."center_id" = c."id") AS attendance,
        (SELECT COALESCE(SUM(p."amount"), 0)::float FROM "payments" p JOIN "applications" ap ON ap."id" = p."application_id" WHERE ap."center_id" = c."id" AND p."status" = 'COMPLETED') AS revenue
      FROM "centers" c WHERE c."deleted_at" IS NULL
      ORDER BY students DESC, applications DESC, c."name" ASC LIMIT 10`,
  ]);

  return {
    stateWiseStudents: stateStudents.map((r) => ({ name: r.name, code: r.code, students: toNumber(r.students) })),
    districtWiseCenters: districtCenters.map((r) => ({ name: r.name, centers: toNumber(r.centers) })),
    blockWiseCenters: blockCenters.map((r) => ({ name: r.name, centers: toNumber(r.centers) })),
    monthlyAdmissions: fillMonths(monthlyAdmissions, 12, ["admissions"]),
    coursePopularity: coursePopularity.map((r) => ({ name: r.name, code: r.code, applications: toNumber(r.applications) })),
    attendanceByBatch: attendanceByBatch.map((r) => ({ id: r.id, name: r.name, code: r.code, pct: toNumber(r.pct), marks: toNumber(r.marks) })),
    attendanceWeekly: attendanceWeekly.map((r) => ({ week: r.week, pct: toNumber(r.pct), marks: toNumber(r.marks) })),
    revenueByMonth: fillMonths(revenueByMonth, 12, ["revenue", "payments"]),
    scholarshipsByMonth: fillMonths(scholarshipsByMonth, 12, ["amount", "awards"]),
    trainerStats: {
      byLevel: trainerLevel.map((t) => ({ name: t.level, value: t._count._all })),
      byStatus: trainerStatus.map((t) => ({ name: t.status, value: t._count._all })),
    },
    centerPerformance: centerPerf.map((r) => {
      const finished = toNumber(r.completed) + toNumber(r.dropped);
      return { id: r.id, code: r.code, name: r.name, students: toNumber(r.students), applications: toNumber(r.applications), completionPct: finished ? Math.round((toNumber(r.completed) / finished) * 1000) / 10 : null, attendancePct: r.attendance === null ? null : toNumber(r.attendance), revenue: toNumber(r.revenue) };
    }),
  };
}

// ───────────────────────────── Website analytics ─────────────────────────────

export async function getWebsiteAnalytics(range: DateRange) {
  const where = inRange("createdAt", range);
  const [byType, visitors, pageViews] = await Promise.all([
    db.analyticsEvent.groupBy({ by: ["type"], where, _count: { _all: true } }),
    db.$queryRaw<{ visitors: number }[]>`
      SELECT COUNT(DISTINCT COALESCE("session_id", "ip_hash"))::int AS visitors FROM "analytics_events"
      WHERE "type" = 'PAGE_VIEW' AND ("session_id" IS NOT NULL OR "ip_hash" IS NOT NULL)
        ${range.from ? Prisma.sql`AND "created_at" >= ${range.from}` : Prisma.empty}
        ${range.to ? Prisma.sql`AND "created_at" < ${range.to}` : Prisma.empty}`,
    db.analyticsEvent.count({ where: { type: "PAGE_VIEW", ...where } }),
  ]);
  const count = (t: string) => byType.find((b) => b.type === t)?._count._all ?? 0;
  return {
    visitors: toNumber(visitors[0]?.visitors),
    pageViews,
    centerSearches: count("CENTER_SEARCH"),
    centerViews: count("CENTER_VIEW"),
    courseViews: count("COURSE_VIEW"),
    applicationsStarted: count("APPLICATION_STARTED"),
    trainerApplicationsStarted: count("TRAINER_APPLICATION_STARTED"),
    certificateVerifications: count("CERTIFICATE_VERIFIED"),
  };
}

export async function getRecentActivity(limit = 12) {
  return db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: { id: true, actorName: true, actorRole: true, action: true, module: true, recordType: true, recordId: true, description: true, createdAt: true } });
}

export async function getDashboard(input: z.infer<typeof dashboardQuerySchema>) {
  const range = resolveDateRange(input);
  const [kpis, charts, analytics, activity] = await Promise.all([getDashboardKpis(range), getDashboardCharts(), getWebsiteAnalytics(range), getRecentActivity()]);
  return { range: { from: range.from ?? null, to: range.to ?? null, preset: input.range ?? null }, kpis, charts, analytics, activity };
}

// ───────────────────────────── Drill-down explorer ─────────────────────────────

export const EXPLORE_LEVELS = ["india", "state", "district", "block", "center", "course", "batch", "trainer"] as const;
export type ExploreLevel = (typeof EXPLORE_LEVELS)[number];

export const exploreQuerySchema = z.object({
  level: z.enum(EXPLORE_LEVELS).default("india"),
  id: z.string().uuid().optional(),
  /** Center context when exploring a course's batches. */
  centerId: z.string().uuid().optional(),
});

export interface ExploreRow {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
  centers?: number;
  trainers?: number;
  students?: number;
  applications?: number;
  admissions?: number;
  batches?: number;
  /** Explorer link to the next level (null when this level is a leaf). */
  nextHref: string | null;
  /** Detail page for the record when one exists. */
  detailHref: string | null;
}

export interface ExploreResult {
  level: ExploreLevel;
  title: string;
  breadcrumb: { label: string; href: string }[];
  childLabel: string;
  rows: ExploreRow[];
}

async function stateRows(): Promise<ExploreRow[]> {
  const rows = await db.$queryRaw<{ id: string; name: string; code: string; centers: number; trainers: number; students: number; applications: number; admissions: number }[]>`
    SELECT s."id", s."name", s."code",
      (SELECT COUNT(*) FROM "centers" c WHERE c."state_id" = s."id" AND c."deleted_at" IS NULL)::int AS centers,
      (SELECT COUNT(*) FROM "trainers" t WHERE t."state_id" = s."id" AND t."deleted_at" IS NULL)::int AS trainers,
      (SELECT COUNT(*) FROM "students" st WHERE st."state_id" = s."id" AND st."deleted_at" IS NULL)::int AS students,
      (SELECT COUNT(*) FROM "applications" a JOIN "centers" c ON c."id" = a."center_id" WHERE c."state_id" = s."id")::int AS applications,
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."state_id" = s."id")::int AS admissions
    FROM "states" s WHERE s."is_active" = true ORDER BY centers DESC, s."name" ASC`;
  return rows.map((r) => ({ ...r, centers: toNumber(r.centers), trainers: toNumber(r.trainers), students: toNumber(r.students), applications: toNumber(r.applications), admissions: toNumber(r.admissions), nextHref: `/admin/dashboard/explore?level=state&id=${r.id}`, detailHref: `/admin/districts?stateId=${r.id}` }));
}

async function districtRows(stateId: string): Promise<ExploreRow[]> {
  const rows = await db.$queryRaw<{ id: string; name: string; code: string; centers: number; trainers: number; students: number; applications: number; admissions: number }[]>`
    SELECT d."id", d."name", d."code",
      (SELECT COUNT(*) FROM "centers" c WHERE c."district_id" = d."id" AND c."deleted_at" IS NULL)::int AS centers,
      (SELECT COUNT(*) FROM "trainers" t WHERE t."district_id" = d."id" AND t."deleted_at" IS NULL)::int AS trainers,
      (SELECT COUNT(*) FROM "students" st WHERE st."district_id" = d."id" AND st."deleted_at" IS NULL)::int AS students,
      (SELECT COUNT(*) FROM "applications" a JOIN "centers" c ON c."id" = a."center_id" WHERE c."district_id" = d."id")::int AS applications,
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."district_id" = d."id")::int AS admissions
    FROM "districts" d WHERE d."state_id" = ${stateId}::uuid ORDER BY centers DESC, d."name" ASC`;
  return rows.map((r) => ({ ...r, centers: toNumber(r.centers), trainers: toNumber(r.trainers), students: toNumber(r.students), applications: toNumber(r.applications), admissions: toNumber(r.admissions), nextHref: `/admin/dashboard/explore?level=district&id=${r.id}`, detailHref: `/admin/blocks?districtId=${r.id}` }));
}

async function blockRows(districtId: string): Promise<ExploreRow[]> {
  const rows = await db.$queryRaw<{ id: string; name: string; code: string | null; centers: number; trainers: number; students: number; applications: number; admissions: number }[]>`
    SELECT b."id", b."name", b."code",
      (SELECT COUNT(*) FROM "centers" c WHERE c."block_id" = b."id" AND c."deleted_at" IS NULL)::int AS centers,
      (SELECT COUNT(*) FROM "trainers" t WHERE t."block_id" = b."id" AND t."deleted_at" IS NULL)::int AS trainers,
      (SELECT COUNT(*) FROM "students" st WHERE st."block_id" = b."id" AND st."deleted_at" IS NULL)::int AS students,
      (SELECT COUNT(*) FROM "applications" a JOIN "centers" c ON c."id" = a."center_id" WHERE c."block_id" = b."id")::int AS applications,
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."block_id" = b."id")::int AS admissions
    FROM "blocks" b WHERE b."district_id" = ${districtId}::uuid ORDER BY centers DESC, b."name" ASC`;
  return rows.map((r) => ({ ...r, centers: toNumber(r.centers), trainers: toNumber(r.trainers), students: toNumber(r.students), applications: toNumber(r.applications), admissions: toNumber(r.admissions), nextHref: `/admin/dashboard/explore?level=block&id=${r.id}`, detailHref: `/admin/centers?blockId=${r.id}` }));
}

async function centerRows(blockId: string): Promise<ExploreRow[]> {
  const centers = await db.center.findMany({
    where: { blockId, deletedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { batches: { where: { deletedAt: null } }, applications: true, admissions: true } } },
  });
  const out: ExploreRow[] = [];
  for (const c of centers) {
    const [trainers, students] = await Promise.all([
      db.trainerAssignment.groupBy({ by: ["trainerId"], where: { centerId: c.id, isActive: true } }).then((r) => r.length),
      db.admission.count({ where: { centerId: c.id, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
    ]);
    out.push({ id: c.id, name: c.name, code: c.code, status: c.status, trainers, students, applications: c._count.applications, admissions: c._count.admissions, batches: c._count.batches, nextHref: `/admin/dashboard/explore?level=center&id=${c.id}`, detailHref: `/admin/centers/${c.id}` });
  }
  return out;
}

async function courseRows(centerId: string): Promise<ExploreRow[]> {
  const offered = await db.centerCourse.findMany({ where: { centerId }, include: { course: { select: { id: true, name: true, code: true, status: true } } }, orderBy: { course: { name: "asc" } } });
  const out: ExploreRow[] = [];
  for (const o of offered) {
    const [batches, trainers, students, applications, admissions] = await Promise.all([
      db.batch.count({ where: { centerId, courseId: o.courseId, deletedAt: null } }),
      db.trainerAssignment.groupBy({ by: ["trainerId"], where: { centerId, courseId: o.courseId, isActive: true } }).then((r) => r.length),
      db.admission.count({ where: { centerId, courseId: o.courseId, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
      db.application.count({ where: { centerId, courseId: o.courseId } }),
      db.admission.count({ where: { centerId, courseId: o.courseId } }),
    ]);
    out.push({ id: o.course.id, name: o.course.name, code: o.course.code, status: o.course.status, batches, trainers, students, applications, admissions, nextHref: `/admin/dashboard/explore?level=course&id=${o.course.id}&centerId=${centerId}`, detailHref: `/admin/courses/${o.course.id}` });
  }
  return out;
}

async function batchRows(courseId: string, centerId?: string): Promise<ExploreRow[]> {
  const batches = await db.batch.findMany({
    where: { courseId, centerId, deletedAt: null },
    orderBy: { startDate: "desc" },
    include: { trainer: { include: { user: { select: { name: true } } } }, _count: { select: { applications: true, admissions: true } } },
  });
  const out: ExploreRow[] = [];
  for (const b of batches) {
    const students = await db.admission.count({ where: { batchId: b.id, status: { in: ["ACTIVE", "ON_HOLD"] } } });
    out.push({ id: b.id, name: `${b.name}${b.trainer ? ` · ${b.trainer.user.name}` : ""}`, code: b.code, status: b.status, trainers: b.trainerId ? 1 : 0, students, applications: b._count.applications, admissions: b._count.admissions, nextHref: `/admin/dashboard/explore?level=batch&id=${b.id}`, detailHref: `/admin/batches/${b.id}` });
  }
  return out;
}

async function trainerRows(batchId: string): Promise<ExploreRow[]> {
  const assignments = await db.trainerAssignment.findMany({ where: { batchId }, include: { trainer: { include: { user: { select: { name: true } } } } }, orderBy: [{ isActive: "desc" }, { assignedAt: "desc" }] });
  const batch = await db.batch.findUnique({ where: { id: batchId }, include: { trainer: { include: { user: { select: { name: true } } } } } });
  const seen = new Set<string>();
  const trainers = [...(batch?.trainer ? [{ trainer: batch.trainer, isActive: true }] : []), ...assignments].filter((a) => {
    if (seen.has(a.trainer.id)) return false;
    seen.add(a.trainer.id);
    return true;
  });
  const out: ExploreRow[] = [];
  for (const a of trainers) {
    const [students, admissions] = await Promise.all([
      db.admission.count({ where: { batchId, trainerId: a.trainer.id, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
      db.admission.count({ where: { batchId, trainerId: a.trainer.id } }),
    ]);
    out.push({ id: a.trainer.id, name: a.trainer.user.name, code: a.trainer.trainerId, status: a.isActive ? a.trainer.status : "ENDED", students, admissions, nextHref: `/admin/dashboard/explore?level=trainer&id=${a.trainer.id}&centerId=${batchId}`, detailHref: `/admin/trainers/${a.trainer.id}` });
  }
  return out;
}

async function studentRows(trainerId: string, batchId?: string): Promise<ExploreRow[]> {
  const admissions = await db.admission.findMany({
    where: { trainerId, ...(batchId ? { batchId } : {}) },
    orderBy: { admittedAt: "desc" },
    include: { student: { select: { id: true, name: true, studentId: true } }, batch: { select: { name: true, code: true } }, progress: { select: { attendancePct: true, completionPct: true } } },
  });
  return admissions.map((a) => ({ id: a.student.id, name: `${a.student.name} · ${a.batch.code}`, code: a.student.studentId, status: a.status, admissions: 1, nextHref: null, detailHref: `/admin/students/${a.student.id}` }));
}

export async function exploreHierarchy(q: z.infer<typeof exploreQuerySchema>): Promise<ExploreResult> {
  const root = { label: "India", href: "/admin/dashboard/explore" };
  const crumbsFor = async (level: ExploreLevel, id?: string, centerId?: string) => {
    const crumb: { label: string; href: string }[] = [root];
    if (level === "india" || !id) return crumb;
    if (level === "state") {
      const s = await db.state.findUnique({ where: { id } });
      if (!s) throw Errors.notFound("State");
      crumb.push({ label: s.name, href: `/admin/dashboard/explore?level=state&id=${s.id}` });
      return crumb;
    }
    if (level === "district") {
      const d = await db.district.findUnique({ where: { id }, include: { state: true } });
      if (!d) throw Errors.notFound("District");
      crumb.push({ label: d.state.name, href: `/admin/dashboard/explore?level=state&id=${d.stateId}` }, { label: d.name, href: `/admin/dashboard/explore?level=district&id=${d.id}` });
      return crumb;
    }
    if (level === "block") {
      const b = await db.block.findUnique({ where: { id }, include: { district: { include: { state: true } } } });
      if (!b) throw Errors.notFound("Block");
      crumb.push({ label: b.district.state.name, href: `/admin/dashboard/explore?level=state&id=${b.district.stateId}` }, { label: b.district.name, href: `/admin/dashboard/explore?level=district&id=${b.districtId}` }, { label: b.name, href: `/admin/dashboard/explore?level=block&id=${b.id}` });
      return crumb;
    }
    const centerCrumbs = async (cid: string) => {
      const c = await db.center.findUnique({ where: { id: cid }, include: { state: true, district: true, block: true } });
      if (!c) throw Errors.notFound("Training center");
      return [
        { label: c.state.name, href: `/admin/dashboard/explore?level=state&id=${c.stateId}` },
        { label: c.district.name, href: `/admin/dashboard/explore?level=district&id=${c.districtId}` },
        { label: c.block.name, href: `/admin/dashboard/explore?level=block&id=${c.blockId}` },
        { label: `${c.name} (${c.code})`, href: `/admin/dashboard/explore?level=center&id=${c.id}` },
      ];
    };
    if (level === "center") {
      crumb.push(...(await centerCrumbs(id)));
      return crumb;
    }
    if (level === "course") {
      const course = await db.course.findUnique({ where: { id } });
      if (!course) throw Errors.notFound("Course");
      if (centerId) crumb.push(...(await centerCrumbs(centerId)));
      crumb.push({ label: course.name, href: `/admin/dashboard/explore?level=course&id=${course.id}${centerId ? `&centerId=${centerId}` : ""}` });
      return crumb;
    }
    if (level === "batch") {
      const b = await db.batch.findUnique({ where: { id }, include: { course: true } });
      if (!b) throw Errors.notFound("Batch");
      crumb.push(...(await centerCrumbs(b.centerId)), { label: b.course.name, href: `/admin/dashboard/explore?level=course&id=${b.courseId}&centerId=${b.centerId}` }, { label: b.name, href: `/admin/dashboard/explore?level=batch&id=${b.id}` });
      return crumb;
    }
    if (level === "trainer") {
      const t = await db.trainer.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
      if (!t) throw Errors.notFound("Trainer");
      if (centerId) {
        const b = await db.batch.findUnique({ where: { id: centerId }, include: { course: true } });
        if (b) crumb.push(...(await centerCrumbs(b.centerId)), { label: b.course.name, href: `/admin/dashboard/explore?level=course&id=${b.courseId}&centerId=${b.centerId}` }, { label: b.name, href: `/admin/dashboard/explore?level=batch&id=${b.id}` });
      }
      crumb.push({ label: t.user.name, href: `/admin/dashboard/explore?level=trainer&id=${t.id}${centerId ? `&centerId=${centerId}` : ""}` });
      return crumb;
    }
    return crumb;
  };

  const breadcrumb = await crumbsFor(q.level, q.id, q.centerId);
  const title = breadcrumb[breadcrumb.length - 1]!.label;
  switch (q.level) {
    case "india":
      return { level: q.level, title: "India", breadcrumb, childLabel: "States", rows: await stateRows() };
    case "state":
      return { level: q.level, title, breadcrumb, childLabel: "Districts", rows: await districtRows(q.id!) };
    case "district":
      return { level: q.level, title, breadcrumb, childLabel: "Blocks", rows: await blockRows(q.id!) };
    case "block":
      return { level: q.level, title, breadcrumb, childLabel: "Training centers", rows: await centerRows(q.id!) };
    case "center":
      return { level: q.level, title, breadcrumb, childLabel: "Courses offered", rows: await courseRows(q.id!) };
    case "course":
      return { level: q.level, title, breadcrumb, childLabel: "Batches", rows: await batchRows(q.id!, q.centerId) };
    case "batch":
      return { level: q.level, title, breadcrumb, childLabel: "Trainers", rows: await trainerRows(q.id!) };
    case "trainer":
      return { level: q.level, title, breadcrumb, childLabel: "Students", rows: await studentRows(q.id!, q.centerId) };
  }
}
