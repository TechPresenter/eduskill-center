import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { formatDate, toNumber } from "@/lib/utils";
import { dateRangeSchema, resolveDateRange, optionalUuid } from "@/lib/api/query";

// ───────────────────────────── Definitions ─────────────────────────────

export const REPORT_TYPES = [
  { key: "students", label: "Student Summary", description: "Registered students with location, active course and admission status.", filters: ["location", "center", "course", "date"] },
  { key: "trainers", label: "Trainer Summary", description: "Volunteer trainers by level, location, status and active assignments.", filters: ["location", "center", "status", "date"] },
  { key: "centers", label: "Center Summary", description: "Training centers with capacity, batches, trainers, students and revenue.", filters: ["location", "status"] },
  { key: "courses", label: "Course Summary", description: "Courses with centers offering them, batches, applications and admissions.", filters: ["status"] },
  { key: "batches", label: "Batch Summary", description: "Batches with schedule, trainer, capacity and seat occupancy.", filters: ["location", "center", "course", "status", "date"] },
  { key: "admissions", label: "Admission Summary", description: "Admissions with student, center, course, batch and completion status.", filters: ["location", "center", "course", "batch", "status", "date"] },
  { key: "payments", label: "Payment Summary", description: "Fee payments with method, status, receipt and verification details.", filters: ["location", "center", "course", "status", "date"] },
  { key: "scholarships", label: "Scholarship Summary", description: "Scholarship awards with original fee, award amount and payable fee.", filters: ["course", "status", "date"] },
  { key: "attendance", label: "Attendance Summary", description: "Per-student attendance percentages by batch.", filters: ["location", "center", "course", "batch", "date"] },
  { key: "certificates", label: "Certificate Summary", description: "Issued and revoked certificates with verification counts.", filters: ["location", "center", "course", "status", "date"] },
  { key: "states", label: "State Summary", description: "Centers, trainers, students, applications and admissions by state.", filters: [] },
  { key: "districts", label: "District Summary", description: "Centers, trainers, students, applications and admissions by district.", filters: ["state"] },
  { key: "blocks", label: "Block Summary", description: "Centers, trainers, students, applications and admissions by block.", filters: ["state", "district"] },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["key"];
export const REPORT_KEYS = REPORT_TYPES.map((r) => r.key) as [ReportType, ...ReportType[]];

export function reportDef(type: string) {
  return REPORT_TYPES.find((r) => r.key === type) ?? null;
}

export const reportFilterSchema = dateRangeSchema.extend({
  stateId: optionalUuid,
  districtId: optionalUuid,
  blockId: optionalUuid,
  centerId: optionalUuid,
  courseId: optionalUuid,
  batchId: optionalUuid,
  status: z.string().trim().max(60).optional(),
  q: z.string().trim().max(120).optional(),
});
export type ReportFilters = z.infer<typeof reportFilterSchema>;

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  type?: "text" | "number" | "money" | "percent" | "date";
}

export type ReportRow = Record<string, string | number | null>;

export interface ReportResult {
  type: ReportType;
  title: string;
  generatedAt: Date;
  columns: ReportColumn[];
  rows: ReportRow[];
  total: number;
  truncated: boolean;
}

const MAX_ROWS = 5000;

function d(v: unknown) {
  return v ? formatDate(v) : "";
}

function locWhere(f: ReportFilters): Prisma.CenterWhereInput {
  return { ...(f.stateId ? { stateId: f.stateId } : {}), ...(f.districtId ? { districtId: f.districtId } : {}), ...(f.blockId ? { blockId: f.blockId } : {}) };
}

function hasLoc(f: ReportFilters) {
  return !!(f.stateId || f.districtId || f.blockId);
}

// ───────────────────────────── Report builders ─────────────────────────────

async function studentsReport(f: ReportFilters, limit: number, range: { from?: Date; to?: Date }) {
  const where: Prisma.StudentWhereInput = { deletedAt: null };
  if (f.stateId) where.stateId = f.stateId;
  if (f.districtId) where.districtId = f.districtId;
  if (f.blockId) where.blockId = f.blockId;
  if (f.centerId || f.courseId) where.admissions = { some: { centerId: f.centerId, courseId: f.courseId } };
  if (range.from || range.to) where.createdAt = { gte: range.from, lt: range.to };
  if (f.q) where.OR = [{ name: { contains: f.q, mode: "insensitive" } }, { studentId: { contains: f.q, mode: "insensitive" } }, { mobile: { contains: f.q } }];
  const [rows, total] = await Promise.all([
    db.student.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, include: { state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } }, admissions: { orderBy: { admittedAt: "desc" }, take: 1, include: { course: { select: { name: true } }, center: { select: { code: true, name: true } }, batch: { select: { code: true } } } }, _count: { select: { applications: true, certificates: true } } } }),
    db.student.count({ where }),
  ]);
  const columns: ReportColumn[] = [
    { key: "studentId", label: "Student ID" },
    { key: "name", label: "Name" },
    { key: "gender", label: "Gender" },
    { key: "mobile", label: "Mobile" },
    { key: "state", label: "State" },
    { key: "district", label: "District" },
    { key: "block", label: "Block" },
    { key: "center", label: "Center" },
    { key: "course", label: "Latest course" },
    { key: "batch", label: "Batch" },
    { key: "admissionStatus", label: "Admission" },
    { key: "applications", label: "Applications", type: "number" },
    { key: "certificates", label: "Certificates", type: "number" },
    { key: "registeredOn", label: "Registered", type: "date" },
  ];
  return {
    columns,
    total,
    rows: rows.map((s) => {
      const a = s.admissions[0];
      return { studentId: s.studentId ?? "", name: s.name, gender: s.gender ?? "", mobile: s.mobile, state: s.state?.name ?? "", district: s.district?.name ?? "", block: s.block?.name ?? "", center: a ? `${a.center.code} · ${a.center.name}` : "", course: a?.course.name ?? "", batch: a?.batch.code ?? "", admissionStatus: a?.status ?? "", applications: s._count.applications, certificates: s._count.certificates, registeredOn: d(s.createdAt) };
    }),
  };
}

async function trainersReport(f: ReportFilters, limit: number, range: { from?: Date; to?: Date }) {
  const where: Prisma.TrainerWhereInput = { deletedAt: null };
  if (f.stateId) where.stateId = f.stateId;
  if (f.districtId) where.districtId = f.districtId;
  if (f.blockId) where.blockId = f.blockId;
  if (f.centerId) where.assignments = { some: { centerId: f.centerId, isActive: true } };
  if (f.status) where.status = f.status as Prisma.TrainerWhereInput["status"];
  if (range.from || range.to) where.joinedAt = { gte: range.from, lt: range.to };
  if (f.q) where.OR = [{ trainerId: { contains: f.q, mode: "insensitive" } }, { user: { name: { contains: f.q, mode: "insensitive" } } }];
  const [rows, total] = await Promise.all([
    db.trainer.findMany({ where, orderBy: { joinedAt: "desc" }, take: limit, include: { user: { select: { name: true, email: true, mobile: true } }, state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } }, assignments: { where: { isActive: true }, include: { center: { select: { code: true } } } }, _count: { select: { batches: true, admissions: true } } } }),
    db.trainer.count({ where }),
  ]);
  const columns: ReportColumn[] = [
    { key: "trainerId", label: "Trainer ID" },
    { key: "name", label: "Name" },
    { key: "level", label: "Level" },
    { key: "status", label: "Status" },
    { key: "state", label: "State" },
    { key: "district", label: "District" },
    { key: "block", label: "Block" },
    { key: "skills", label: "Skills" },
    { key: "centers", label: "Active centers" },
    { key: "batches", label: "Batches", type: "number" },
    { key: "students", label: "Students", type: "number" },
    { key: "mobile", label: "Mobile" },
    { key: "email", label: "Email" },
    { key: "joinedAt", label: "Joined", type: "date" },
  ];
  return {
    columns,
    total,
    rows: rows.map((t) => ({ trainerId: t.trainerId, name: t.user.name, level: t.level, status: t.status, state: t.state.name, district: t.district?.name ?? "", block: t.block?.name ?? "", skills: t.skills.join(", "), centers: Array.from(new Set(t.assignments.map((a) => a.center.code))).join(", "), batches: t._count.batches, students: t._count.admissions, mobile: t.user.mobile ?? "", email: t.user.email ?? "", joinedAt: d(t.joinedAt) })),
  };
}

async function centersReport(f: ReportFilters, limit: number) {
  const where: Prisma.CenterWhereInput = { deletedAt: null, ...locWhere(f) };
  if (f.status) where.status = f.status as Prisma.CenterWhereInput["status"];
  if (f.q) where.OR = [{ name: { contains: f.q, mode: "insensitive" } }, { code: { contains: f.q, mode: "insensitive" } }];
  const [rows, total] = await Promise.all([
    db.center.findMany({ where, orderBy: { name: "asc" }, take: limit, include: { state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } }, _count: { select: { courses: true, batches: { where: { deletedAt: null } }, applications: true, admissions: { where: { status: { in: ["ACTIVE", "ON_HOLD"] } } }, certificates: true } } } }),
    db.center.count({ where }),
  ]);
  const out: ReportRow[] = [];
  for (const c of rows) {
    const [trainers, revenue, completed] = await Promise.all([
      db.trainerAssignment.groupBy({ by: ["trainerId"], where: { centerId: c.id, isActive: true } }).then((r) => r.length),
      db.payment.aggregate({ where: { status: "COMPLETED", application: { centerId: c.id } }, _sum: { amount: true } }),
      db.admission.count({ where: { centerId: c.id, status: "COMPLETED" } }),
    ]);
    out.push({ code: c.code, name: c.name, state: c.state.name, district: c.district.name, block: c.block.name, pincode: c.pincode, status: c.status, verified: c.isVerified ? "Yes" : "No", capacity: c.capacity, courses: c._count.courses, batches: c._count.batches, trainers, students: c._count.admissions, applications: c._count.applications, completed, certificates: c._count.certificates, revenue: toNumber(revenue._sum.amount), phone: c.phone ?? "", email: c.email ?? "" });
  }
  const columns: ReportColumn[] = [
    { key: "code", label: "Code" },
    { key: "name", label: "Center" },
    { key: "state", label: "State" },
    { key: "district", label: "District" },
    { key: "block", label: "Block" },
    { key: "pincode", label: "PIN" },
    { key: "status", label: "Status" },
    { key: "verified", label: "Verified" },
    { key: "capacity", label: "Capacity", type: "number" },
    { key: "courses", label: "Courses", type: "number" },
    { key: "batches", label: "Batches", type: "number" },
    { key: "trainers", label: "Trainers", type: "number" },
    { key: "students", label: "Active students", type: "number" },
    { key: "applications", label: "Applications", type: "number" },
    { key: "completed", label: "Completed", type: "number" },
    { key: "certificates", label: "Certificates", type: "number" },
    { key: "revenue", label: "Revenue (₹)", type: "money" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
  ];
  return { columns, rows: out, total };
}

async function coursesReport(f: ReportFilters, limit: number) {
  const where: Prisma.CourseWhereInput = { deletedAt: null };
  if (f.status) where.status = f.status as Prisma.CourseWhereInput["status"];
  if (f.q) where.OR = [{ name: { contains: f.q, mode: "insensitive" } }, { code: { contains: f.q, mode: "insensitive" } }];
  const [rows, total] = await Promise.all([
    db.course.findMany({ where, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], take: limit, include: { category: { select: { name: true } }, _count: { select: { centers: true, batches: { where: { deletedAt: null } }, applications: true, admissions: true, certificates: true } } } }),
    db.course.count({ where }),
  ]);
  const out: ReportRow[] = [];
  for (const c of rows) {
    const [active, completed, revenue] = await Promise.all([
      db.admission.count({ where: { courseId: c.id, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
      db.admission.count({ where: { courseId: c.id, status: "COMPLETED" } }),
      db.payment.aggregate({ where: { status: "COMPLETED", application: { courseId: c.id } }, _sum: { amount: true } }),
    ]);
    out.push({ code: c.code, name: c.name, category: c.category?.name ?? "", level: c.level, mode: c.mode, duration: c.durationText, status: c.status, courseFee: toNumber(c.courseFee), totalFee: toNumber(c.courseFee) + toNumber(c.registrationFee) + toNumber(c.examFee) + toNumber(c.certificateFee), scholarship: c.scholarshipAvailable ? "Yes" : "No", centers: c._count.centers, batches: c._count.batches, applications: c._count.applications, admissions: c._count.admissions, active, completed, certificates: c._count.certificates, revenue: toNumber(revenue._sum.amount) });
  }
  const columns: ReportColumn[] = [
    { key: "code", label: "Code" },
    { key: "name", label: "Course" },
    { key: "category", label: "Category" },
    { key: "level", label: "Level" },
    { key: "mode", label: "Mode" },
    { key: "duration", label: "Duration" },
    { key: "status", label: "Status" },
    { key: "courseFee", label: "Course fee (₹)", type: "money" },
    { key: "totalFee", label: "Total fee (₹)", type: "money" },
    { key: "scholarship", label: "Scholarship" },
    { key: "centers", label: "Centers", type: "number" },
    { key: "batches", label: "Batches", type: "number" },
    { key: "applications", label: "Applications", type: "number" },
    { key: "admissions", label: "Admissions", type: "number" },
    { key: "active", label: "Active", type: "number" },
    { key: "completed", label: "Completed", type: "number" },
    { key: "certificates", label: "Certificates", type: "number" },
    { key: "revenue", label: "Revenue (₹)", type: "money" },
  ];
  return { columns, rows: out, total };
}

async function batchesReport(f: ReportFilters, limit: number, range: { from?: Date; to?: Date }) {
  const where: Prisma.BatchWhereInput = { deletedAt: null };
  if (f.centerId) where.centerId = f.centerId;
  else if (hasLoc(f)) where.center = locWhere(f);
  if (f.courseId) where.courseId = f.courseId;
  if (f.status) where.status = f.status as Prisma.BatchWhereInput["status"];
  if (range.from || range.to) where.startDate = { gte: range.from, lt: range.to };
  if (f.q) where.OR = [{ name: { contains: f.q, mode: "insensitive" } }, { code: { contains: f.q, mode: "insensitive" } }];
  const [rows, total] = await Promise.all([
    db.batch.findMany({ where, orderBy: { startDate: "desc" }, take: limit, include: { center: { select: { code: true, name: true, state: { select: { name: true } }, district: { select: { name: true } } } }, course: { select: { name: true, code: true } }, trainer: { include: { user: { select: { name: true } } } } } }),
    db.batch.count({ where }),
  ]);
  const out: ReportRow[] = [];
  for (const b of rows) {
    const [admitted, reserved, completed] = await Promise.all([
      db.admission.count({ where: { batchId: b.id, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
      db.application.count({ where: { batchId: b.id, status: { in: ["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED"] } } }),
      db.admission.count({ where: { batchId: b.id, status: "COMPLETED" } }),
    ]);
    out.push({ code: b.code, name: b.name, center: `${b.center.code} · ${b.center.name}`, state: b.center.state.name, district: b.center.district.name, course: b.course.name, trainer: b.trainer?.user.name ?? "", startDate: d(b.startDate), endDate: d(b.endDate), schedule: `${b.days.join(", ")} ${b.startTime}–${b.endTime}`, status: b.status, capacity: b.capacity, admitted, reserved, available: Math.max(0, b.capacity - admitted - reserved), completed });
  }
  const columns: ReportColumn[] = [
    { key: "code", label: "Batch code" },
    { key: "name", label: "Batch" },
    { key: "center", label: "Center" },
    { key: "state", label: "State" },
    { key: "district", label: "District" },
    { key: "course", label: "Course" },
    { key: "trainer", label: "Trainer" },
    { key: "startDate", label: "Start", type: "date" },
    { key: "endDate", label: "End", type: "date" },
    { key: "schedule", label: "Schedule" },
    { key: "status", label: "Status" },
    { key: "capacity", label: "Capacity", type: "number" },
    { key: "admitted", label: "Admitted", type: "number" },
    { key: "reserved", label: "Reserved", type: "number" },
    { key: "available", label: "Available", type: "number" },
    { key: "completed", label: "Completed", type: "number" },
  ];
  return { columns, rows: out, total };
}

async function admissionsReport(f: ReportFilters, limit: number, range: { from?: Date; to?: Date }) {
  const where: Prisma.AdmissionWhereInput = {};
  if (f.centerId) where.centerId = f.centerId;
  else if (hasLoc(f)) where.center = locWhere(f);
  if (f.courseId) where.courseId = f.courseId;
  if (f.batchId) where.batchId = f.batchId;
  if (f.status) where.status = f.status as Prisma.AdmissionWhereInput["status"];
  if (range.from || range.to) where.admittedAt = { gte: range.from, lt: range.to };
  if (f.q) where.OR = [{ admissionNo: { contains: f.q, mode: "insensitive" } }, { student: { name: { contains: f.q, mode: "insensitive" } } }, { student: { studentId: { contains: f.q, mode: "insensitive" } } }];
  const [rows, total] = await Promise.all([
    db.admission.findMany({ where, orderBy: { admittedAt: "desc" }, take: limit, include: { student: { select: { name: true, studentId: true, mobile: true, gender: true } }, center: { select: { code: true, name: true, state: { select: { name: true } }, district: { select: { name: true } } } }, course: { select: { name: true } }, batch: { select: { code: true, name: true } }, trainer: { include: { user: { select: { name: true } } } }, application: { select: { applicationNo: true, payableAmount: true, paidAmount: true, scholarshipAmount: true } }, progress: { select: { attendancePct: true, completionPct: true, certificateEligible: true } }, certificate: { select: { certificateNo: true } } } }),
    db.admission.count({ where }),
  ]);
  const columns: ReportColumn[] = [
    { key: "admissionNo", label: "Admission No" },
    { key: "applicationNo", label: "Application No" },
    { key: "studentId", label: "Student ID" },
    { key: "student", label: "Student" },
    { key: "gender", label: "Gender" },
    { key: "mobile", label: "Mobile" },
    { key: "center", label: "Center" },
    { key: "state", label: "State" },
    { key: "district", label: "District" },
    { key: "course", label: "Course" },
    { key: "batch", label: "Batch" },
    { key: "trainer", label: "Trainer" },
    { key: "status", label: "Status" },
    { key: "admittedAt", label: "Admitted", type: "date" },
    { key: "completedAt", label: "Completed", type: "date" },
    { key: "attendancePct", label: "Attendance %", type: "percent" },
    { key: "completionPct", label: "Completion %", type: "percent" },
    { key: "payable", label: "Payable (₹)", type: "money" },
    { key: "paid", label: "Paid (₹)", type: "money" },
    { key: "scholarship", label: "Scholarship (₹)", type: "money" },
    { key: "certificateNo", label: "Certificate" },
  ];
  return {
    columns,
    total,
    rows: rows.map((a) => ({ admissionNo: a.admissionNo, applicationNo: a.application.applicationNo, studentId: a.student.studentId ?? "", student: a.student.name, gender: a.student.gender ?? "", mobile: a.student.mobile, center: `${a.center.code} · ${a.center.name}`, state: a.center.state.name, district: a.center.district.name, course: a.course.name, batch: a.batch.code, trainer: a.trainer?.user.name ?? "", status: a.status, admittedAt: d(a.admittedAt), completedAt: d(a.completedAt), attendancePct: a.progress ? toNumber(a.progress.attendancePct) : null, completionPct: a.progress ? toNumber(a.progress.completionPct) : null, payable: toNumber(a.application.payableAmount), paid: toNumber(a.application.paidAmount), scholarship: toNumber(a.application.scholarshipAmount), certificateNo: a.certificate?.certificateNo ?? "" })),
  };
}

async function paymentsReport(f: ReportFilters, limit: number, range: { from?: Date; to?: Date }) {
  const where: Prisma.PaymentWhereInput = {};
  const app: Prisma.ApplicationWhereInput = {};
  if (f.centerId) app.centerId = f.centerId;
  else if (hasLoc(f)) app.center = locWhere(f);
  if (f.courseId) app.courseId = f.courseId;
  if (Object.keys(app).length) where.application = app;
  if (f.status) where.status = f.status as Prisma.PaymentWhereInput["status"];
  if (range.from || range.to) where.createdAt = { gte: range.from, lt: range.to };
  if (f.q) where.OR = [{ paymentNo: { contains: f.q, mode: "insensitive" } }, { receiptNo: { contains: f.q, mode: "insensitive" } }, { student: { name: { contains: f.q, mode: "insensitive" } } }];
  const [rows, total, sum] = await Promise.all([
    db.payment.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, include: { student: { select: { name: true, studentId: true } }, application: { select: { applicationNo: true, center: { select: { code: true, name: true } }, course: { select: { name: true } } } } } }),
    db.payment.count({ where }),
    db.payment.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { amount: true } }),
  ]);
  const columns: ReportColumn[] = [
    { key: "paymentNo", label: "Payment No" },
    { key: "invoiceNo", label: "Invoice" },
    { key: "receiptNo", label: "Receipt" },
    { key: "applicationNo", label: "Application" },
    { key: "studentId", label: "Student ID" },
    { key: "student", label: "Student" },
    { key: "center", label: "Center" },
    { key: "course", label: "Course" },
    { key: "amount", label: "Amount (₹)", type: "money" },
    { key: "method", label: "Method" },
    { key: "gateway", label: "Gateway" },
    { key: "status", label: "Status" },
    { key: "referenceNo", label: "Reference" },
    { key: "paidAt", label: "Paid on", type: "date" },
    { key: "verifiedAt", label: "Verified on", type: "date" },
    { key: "createdAt", label: "Created", type: "date" },
  ];
  const out: ReportRow[] = rows.map((p) => ({ paymentNo: p.paymentNo, invoiceNo: p.invoiceNo, receiptNo: p.receiptNo ?? "", applicationNo: p.application.applicationNo, studentId: p.student.studentId ?? "", student: p.student.name, center: `${p.application.center.code} · ${p.application.center.name}`, course: p.application.course.name, amount: toNumber(p.amount), method: p.method, gateway: p.gateway, status: p.status, referenceNo: p.referenceNo ?? "", paidAt: d(p.paidAt), verifiedAt: d(p.verifiedAt), createdAt: d(p.createdAt) }));
  return { columns, rows: out, total, summary: { completedAmount: toNumber(sum._sum.amount) } };
}

async function scholarshipsReport(f: ReportFilters, limit: number, range: { from?: Date; to?: Date }) {
  const where: Prisma.ScholarshipAwardWhereInput = {};
  if (f.courseId) where.courseId = f.courseId;
  if (f.status) where.status = f.status as Prisma.ScholarshipAwardWhereInput["status"];
  if (range.from || range.to) where.createdAt = { gte: range.from, lt: range.to };
  if (f.q) where.OR = [{ student: { name: { contains: f.q, mode: "insensitive" } } }, { application: { applicationNo: { contains: f.q, mode: "insensitive" } } }];
  const [rows, total] = await Promise.all([
    db.scholarshipAward.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, include: { student: { select: { name: true, studentId: true } }, course: { select: { name: true } }, program: { select: { name: true, type: true } }, application: { select: { applicationNo: true, center: { select: { code: true, name: true } } } } } }),
    db.scholarshipAward.count({ where }),
  ]);
  const columns: ReportColumn[] = [
    { key: "applicationNo", label: "Application" },
    { key: "studentId", label: "Student ID" },
    { key: "student", label: "Student" },
    { key: "center", label: "Center" },
    { key: "course", label: "Course" },
    { key: "program", label: "Program" },
    { key: "type", label: "Type" },
    { key: "originalFee", label: "Original fee (₹)", type: "money" },
    { key: "scholarshipAmount", label: "Scholarship (₹)", type: "money" },
    { key: "payableFee", label: "Payable (₹)", type: "money" },
    { key: "status", label: "Status" },
    { key: "approvedAt", label: "Approved", type: "date" },
    { key: "createdAt", label: "Requested", type: "date" },
  ];
  return {
    columns,
    total,
    rows: rows.map((s) => ({ applicationNo: s.application.applicationNo, studentId: s.student.studentId ?? "", student: s.student.name, center: `${s.application.center.code} · ${s.application.center.name}`, course: s.course.name, program: s.program?.name ?? "", type: s.program?.type ?? "", originalFee: toNumber(s.originalFee), scholarshipAmount: toNumber(s.scholarshipAmount), payableFee: toNumber(s.payableFee), status: s.status, approvedAt: d(s.approvedAt), createdAt: d(s.createdAt) })),
  };
}

async function attendanceReport(f: ReportFilters, limit: number, range: { from?: Date; to?: Date }) {
  const where: Prisma.AdmissionWhereInput = { status: { in: ["ACTIVE", "ON_HOLD", "COMPLETED"] } };
  if (f.centerId) where.centerId = f.centerId;
  else if (hasLoc(f)) where.center = locWhere(f);
  if (f.courseId) where.courseId = f.courseId;
  if (f.batchId) where.batchId = f.batchId;
  if (f.q) where.student = { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { studentId: { contains: f.q, mode: "insensitive" } }] };
  const [rows, total] = await Promise.all([
    db.admission.findMany({ where, orderBy: [{ batch: { code: "asc" } }, { student: { name: "asc" } }], take: limit, include: { student: { select: { id: true, name: true, studentId: true } }, batch: { select: { id: true, code: true, name: true } }, center: { select: { code: true, name: true } }, course: { select: { name: true, minAttendancePct: true } } } }),
    db.admission.count({ where }),
  ]);
  const dateFilter = range.from || range.to ? { gte: range.from, lt: range.to } : undefined;
  const out: ReportRow[] = [];
  for (const a of rows) {
    const [held, marks] = await Promise.all([
      db.attendance.groupBy({ by: ["date"], where: { batchId: a.batchId, ...(dateFilter ? { date: dateFilter } : {}) } }).then((r) => r.length),
      db.attendance.groupBy({ by: ["status"], where: { batchId: a.batchId, studentId: a.studentId, ...(dateFilter ? { date: dateFilter } : {}) }, _count: { _all: true } }),
    ]);
    const get = (s: string) => marks.find((m) => m.status === s)?._count._all ?? 0;
    const present = get("PRESENT");
    const late = get("LATE");
    const pct = held ? Math.round(((present + late) / held) * 1000) / 10 : 0;
    out.push({ studentId: a.student.studentId ?? "", student: a.student.name, center: `${a.center.code} · ${a.center.name}`, course: a.course.name, batch: a.batch.code, admissionStatus: a.status, held, present, late, absent: get("ABSENT"), leave: get("LEAVE"), pct, required: a.course.minAttendancePct, meets: held ? (pct >= a.course.minAttendancePct ? "Yes" : "No") : "" });
  }
  const columns: ReportColumn[] = [
    { key: "studentId", label: "Student ID" },
    { key: "student", label: "Student" },
    { key: "center", label: "Center" },
    { key: "course", label: "Course" },
    { key: "batch", label: "Batch" },
    { key: "admissionStatus", label: "Admission" },
    { key: "held", label: "Classes held", type: "number" },
    { key: "present", label: "Present", type: "number" },
    { key: "late", label: "Late", type: "number" },
    { key: "absent", label: "Absent", type: "number" },
    { key: "leave", label: "Leave", type: "number" },
    { key: "pct", label: "Attendance %", type: "percent" },
    { key: "required", label: "Required %", type: "percent" },
    { key: "meets", label: "Meets minimum" },
  ];
  return { columns, rows: out, total };
}

async function certificatesReport(f: ReportFilters, limit: number, range: { from?: Date; to?: Date }) {
  const where: Prisma.CertificateWhereInput = {};
  if (f.centerId) where.centerId = f.centerId;
  else if (hasLoc(f)) where.center = locWhere(f);
  if (f.courseId) where.courseId = f.courseId;
  if (f.status) where.status = f.status as Prisma.CertificateWhereInput["status"];
  if (range.from || range.to) where.issuedAt = { gte: range.from, lt: range.to };
  if (f.q) where.OR = [{ certificateNo: { contains: f.q, mode: "insensitive" } }, { studentName: { contains: f.q, mode: "insensitive" } }];
  const [rows, total] = await Promise.all([
    db.certificate.findMany({ where, orderBy: { issuedAt: "desc" }, take: limit, include: { student: { select: { studentId: true } }, admission: { select: { admissionNo: true, batch: { select: { code: true } } } } } }),
    db.certificate.count({ where }),
  ]);
  const columns: ReportColumn[] = [
    { key: "certificateNo", label: "Certificate No" },
    { key: "studentId", label: "Student ID" },
    { key: "studentName", label: "Student" },
    { key: "courseName", label: "Course" },
    { key: "centerCode", label: "Center code" },
    { key: "centerName", label: "Center" },
    { key: "batch", label: "Batch" },
    { key: "admissionNo", label: "Admission" },
    { key: "grade", label: "Grade" },
    { key: "completionDate", label: "Completed", type: "date" },
    { key: "issuedAt", label: "Issued", type: "date" },
    { key: "status", label: "Status" },
    { key: "verifications", label: "Verifications", type: "number" },
    { key: "revokedAt", label: "Revoked", type: "date" },
  ];
  return {
    columns,
    total,
    rows: rows.map((c) => ({ certificateNo: c.certificateNo, studentId: c.student.studentId ?? "", studentName: c.studentName, courseName: c.courseName, centerCode: c.centerCode, centerName: c.centerName, batch: c.admission.batch.code, admissionNo: c.admission.admissionNo, grade: c.grade ?? "", completionDate: d(c.completionDate), issuedAt: d(c.issuedAt), status: c.status, verifications: c.verificationCount, revokedAt: d(c.revokedAt) })),
  };
}

const locationColumns: ReportColumn[] = [
  { key: "name", label: "Name" },
  { key: "code", label: "Code" },
  { key: "active", label: "Active" },
  { key: "centers", label: "Centers", type: "number" },
  { key: "activeCenters", label: "Active centers", type: "number" },
  { key: "trainers", label: "Trainers", type: "number" },
  { key: "students", label: "Students", type: "number" },
  { key: "applications", label: "Applications", type: "number" },
  { key: "admissions", label: "Admissions", type: "number" },
  { key: "activeStudents", label: "Active students", type: "number" },
  { key: "completed", label: "Completed", type: "number" },
];

type LocRow = { id: string; name: string; code: string | null; active: boolean; centers: number; activeCenters: number; trainers: number; students: number; applications: number; admissions: number; activeStudents: number; completed: number; parent?: string };

function mapLoc(rows: LocRow[]): ReportRow[] {
  return rows.map((r) => ({ ...(r.parent !== undefined ? { parent: r.parent } : {}), name: r.name, code: r.code ?? "", active: r.active ? "Yes" : "No", centers: toNumber(r.centers), activeCenters: toNumber(r.activeCenters), trainers: toNumber(r.trainers), students: toNumber(r.students), applications: toNumber(r.applications), admissions: toNumber(r.admissions), activeStudents: toNumber(r.activeStudents), completed: toNumber(r.completed) }));
}

async function statesReport() {
  const rows = await db.$queryRaw<LocRow[]>`
    SELECT s."id", s."name", s."code", s."is_active" AS active,
      (SELECT COUNT(*) FROM "centers" c WHERE c."state_id" = s."id" AND c."deleted_at" IS NULL)::int AS centers,
      (SELECT COUNT(*) FROM "centers" c WHERE c."state_id" = s."id" AND c."deleted_at" IS NULL AND c."status" = 'ACTIVE')::int AS "activeCenters",
      (SELECT COUNT(*) FROM "trainers" t WHERE t."state_id" = s."id" AND t."deleted_at" IS NULL)::int AS trainers,
      (SELECT COUNT(*) FROM "students" st WHERE st."state_id" = s."id" AND st."deleted_at" IS NULL)::int AS students,
      (SELECT COUNT(*) FROM "applications" a JOIN "centers" c ON c."id" = a."center_id" WHERE c."state_id" = s."id")::int AS applications,
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."state_id" = s."id")::int AS admissions,
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."state_id" = s."id" AND ad."status" IN ('ACTIVE','ON_HOLD'))::int AS "activeStudents",
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."state_id" = s."id" AND ad."status" = 'COMPLETED')::int AS completed
    FROM "states" s ORDER BY centers DESC, s."name" ASC`;
  return { columns: locationColumns, rows: mapLoc(rows), total: rows.length };
}

async function districtsReport(f: ReportFilters) {
  const rows = await db.$queryRaw<LocRow[]>`
    SELECT d."id", d."name", d."code", d."is_active" AS active, s."name" AS parent,
      (SELECT COUNT(*) FROM "centers" c WHERE c."district_id" = d."id" AND c."deleted_at" IS NULL)::int AS centers,
      (SELECT COUNT(*) FROM "centers" c WHERE c."district_id" = d."id" AND c."deleted_at" IS NULL AND c."status" = 'ACTIVE')::int AS "activeCenters",
      (SELECT COUNT(*) FROM "trainers" t WHERE t."district_id" = d."id" AND t."deleted_at" IS NULL)::int AS trainers,
      (SELECT COUNT(*) FROM "students" st WHERE st."district_id" = d."id" AND st."deleted_at" IS NULL)::int AS students,
      (SELECT COUNT(*) FROM "applications" a JOIN "centers" c ON c."id" = a."center_id" WHERE c."district_id" = d."id")::int AS applications,
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."district_id" = d."id")::int AS admissions,
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."district_id" = d."id" AND ad."status" IN ('ACTIVE','ON_HOLD'))::int AS "activeStudents",
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."district_id" = d."id" AND ad."status" = 'COMPLETED')::int AS completed
    FROM "districts" d JOIN "states" s ON s."id" = d."state_id"
    WHERE (${f.stateId ?? null}::uuid IS NULL OR d."state_id" = ${f.stateId ?? null}::uuid)
    ORDER BY centers DESC, s."name" ASC, d."name" ASC LIMIT ${MAX_ROWS}`;
  return { columns: [{ key: "parent", label: "State" }, ...locationColumns], rows: mapLoc(rows), total: rows.length };
}

async function blocksReport(f: ReportFilters) {
  const rows = await db.$queryRaw<LocRow[]>`
    SELECT b."id", b."name", b."code", b."is_active" AS active, d."name" || ', ' || s."code" AS parent,
      (SELECT COUNT(*) FROM "centers" c WHERE c."block_id" = b."id" AND c."deleted_at" IS NULL)::int AS centers,
      (SELECT COUNT(*) FROM "centers" c WHERE c."block_id" = b."id" AND c."deleted_at" IS NULL AND c."status" = 'ACTIVE')::int AS "activeCenters",
      (SELECT COUNT(*) FROM "trainers" t WHERE t."block_id" = b."id" AND t."deleted_at" IS NULL)::int AS trainers,
      (SELECT COUNT(*) FROM "students" st WHERE st."block_id" = b."id" AND st."deleted_at" IS NULL)::int AS students,
      (SELECT COUNT(*) FROM "applications" a JOIN "centers" c ON c."id" = a."center_id" WHERE c."block_id" = b."id")::int AS applications,
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."block_id" = b."id")::int AS admissions,
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."block_id" = b."id" AND ad."status" IN ('ACTIVE','ON_HOLD'))::int AS "activeStudents",
      (SELECT COUNT(*) FROM "admissions" ad JOIN "centers" c ON c."id" = ad."center_id" WHERE c."block_id" = b."id" AND ad."status" = 'COMPLETED')::int AS completed
    FROM "blocks" b JOIN "districts" d ON d."id" = b."district_id" JOIN "states" s ON s."id" = d."state_id"
    WHERE (${f.districtId ?? null}::uuid IS NULL OR b."district_id" = ${f.districtId ?? null}::uuid)
      AND (${f.stateId ?? null}::uuid IS NULL OR d."state_id" = ${f.stateId ?? null}::uuid)
    ORDER BY centers DESC, s."name" ASC, d."name" ASC, b."name" ASC LIMIT ${MAX_ROWS}`;
  return { columns: [{ key: "parent", label: "District" }, ...locationColumns], rows: mapLoc(rows), total: rows.length };
}

// ───────────────────────────── Runner ─────────────────────────────

export async function runReport(type: string, filters: ReportFilters, opts: { limit?: number } = {}): Promise<ReportResult> {
  const def = reportDef(type);
  if (!def) throw Errors.notFound("Report");
  const limit = Math.min(opts.limit ?? MAX_ROWS, MAX_ROWS);
  const range = resolveDateRange(filters);
  let r: { columns: ReportColumn[]; rows: ReportRow[]; total: number };
  switch (def.key) {
    case "students":
      r = await studentsReport(filters, limit, range);
      break;
    case "trainers":
      r = await trainersReport(filters, limit, range);
      break;
    case "centers":
      r = await centersReport(filters, limit);
      break;
    case "courses":
      r = await coursesReport(filters, limit);
      break;
    case "batches":
      r = await batchesReport(filters, limit, range);
      break;
    case "admissions":
      r = await admissionsReport(filters, limit, range);
      break;
    case "payments":
      r = await paymentsReport(filters, limit, range);
      break;
    case "scholarships":
      r = await scholarshipsReport(filters, limit, range);
      break;
    case "attendance":
      r = await attendanceReport(filters, limit, range);
      break;
    case "certificates":
      r = await certificatesReport(filters, limit, range);
      break;
    case "states":
      r = await statesReport();
      break;
    case "districts":
      r = await districtsReport(filters);
      break;
    case "blocks":
      r = await blocksReport(filters);
      break;
  }
  return { type: def.key, title: def.label, generatedAt: new Date(), columns: r.columns, rows: r.rows, total: r.total, truncated: r.rows.length < r.total };
}

// ───────────────────────────── Exporters ─────────────────────────────

function cellText(col: ReportColumn, v: string | number | null): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (col.type === "money") return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (col.type === "percent") return `${v}%`;
    return String(v);
  }
  return v;
}

export function reportToCsv(result: ReportResult): string {
  const esc = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [result.columns.map((c) => esc(c.label)).join(",")];
  for (const row of result.rows) lines.push(result.columns.map((c) => esc(typeof row[c.key] === "number" ? String(row[c.key]) : cellText(c, row[c.key] ?? null))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export async function reportToXlsx(result: ReportResult, meta: { orgName: string; filtersLabel?: string }): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.orgName;
  wb.created = result.generatedAt;
  const ws = wb.addWorksheet(result.title.slice(0, 31), { views: [{ state: "frozen", ySplit: 3 }] });
  ws.mergeCells(1, 1, 1, Math.max(1, result.columns.length));
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${meta.orgName} — ${result.title}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF12357A" } };
  ws.getCell(2, 1).value = `Generated ${result.generatedAt.toLocaleString("en-IN")} · ${result.total} record(s)${meta.filtersLabel ? ` · ${meta.filtersLabel}` : ""}`;
  ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: "FF667085" } };
  const header = ws.getRow(3);
  header.values = result.columns.map((c) => c.label);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  result.columns.forEach((_, i) => {
    const cell = header.getCell(i + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12357A" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFE8520A" } } };
  });
  for (const row of result.rows) {
    const r = ws.addRow(result.columns.map((c) => (row[c.key] === null || row[c.key] === undefined ? "" : row[c.key])));
    result.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      if (c.type === "money") cell.numFmt = "#,##0.00";
      if (c.type === "percent") cell.numFmt = '0.0"%"';
      if (c.type === "number" || c.type === "money" || c.type === "percent") cell.alignment = { horizontal: "right" };
    });
  }
  ws.columns.forEach((col, i) => {
    const def = result.columns[i];
    let width = (def?.label.length ?? 10) + 2;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len + 2 > width) width = len + 2;
    });
    col.width = Math.min(48, Math.max(8, width));
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: Math.max(1, result.columns.length) } };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export async function reportToPdf(result: ReportResult, meta: { orgName: string; filtersLabel?: string }): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${result.title} — ${meta.orgName}`);
  pdf.setAuthor(meta.orgName);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0x12 / 255, 0x35 / 255, 0x7a / 255);
  const orange = rgb(0xe8 / 255, 0x52 / 255, 0x0a / 255);
  const ink = rgb(0x17 / 255, 0x20 / 255, 0x33 / 255);
  const muted = rgb(0x66 / 255, 0x70 / 255, 0x85 / 255);
  const line = rgb(0xe4 / 255, 0xe7 / 255, 0xec / 255);
  const zebra = rgb(0xf8 / 255, 0xf8 / 255, 0xfc / 255);

  const pageW = 841.89; // A4 landscape
  const pageH = 595.28;
  const margin = 28;
  const fontSize = 7.5;
  const rowH = 14;
  const headerH = 18;
  const usableW = pageW - margin * 2;

  // Column widths proportional to content, capped.
  const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ₹]/g, "").replace(/₹/g, "Rs.");
  const widthOf = (s: string, f = font, size = fontSize) => f.widthOfTextAtSize(safe(s), size);
  const raw = result.columns.map((c) => {
    let w = widthOf(c.label, bold) + 8;
    for (const row of result.rows.slice(0, 200)) w = Math.max(w, widthOf(cellText(c, row[c.key] ?? null)) + 8);
    return Math.min(w, 150);
  });
  const rawTotal = raw.reduce((a, b) => a + b, 0);
  const widths = raw.map((w) => (w / rawTotal) * usableW);

  const truncateToWidth = (s: string, w: number, f = font) => {
    const t = safe(s);
    if (widthOf(t, f) <= w - 6) return t;
    let out = t;
    while (out.length > 1 && widthOf(out + "…", f) > w - 6) out = out.slice(0, -1);
    return out + "…";
  };

  const rowsPerPage = Math.floor((pageH - margin * 2 - 60 - headerH - 20) / rowH);
  const chunks: ReportRow[][] = [];
  for (let i = 0; i < result.rows.length; i += rowsPerPage) chunks.push(result.rows.slice(i, i + rowsPerPage));
  if (chunks.length === 0) chunks.push([]);
  const totalPages = chunks.length;

  chunks.forEach((rows, pageIndex) => {
    const page = pdf.addPage([pageW, pageH]);
    let y = pageH - margin;
    page.drawText(safe(meta.orgName), { x: margin, y: y - 12, size: 12, font: bold, color: navy });
    page.drawText(safe(result.title), { x: margin, y: y - 28, size: 10, font: bold, color: ink });
    const metaText = safe(`Generated ${result.generatedAt.toLocaleString("en-IN")} · ${result.total} record(s)${meta.filtersLabel ? ` · ${meta.filtersLabel}` : ""}`);
    page.drawText(metaText, { x: margin, y: y - 41, size: 7, font, color: muted });
    page.drawLine({ start: { x: margin, y: y - 48 }, end: { x: pageW - margin, y: y - 48 }, thickness: 1.5, color: orange });
    y -= 60;

    // Header
    page.drawRectangle({ x: margin, y: y - headerH, width: usableW, height: headerH, color: navy });
    let x = margin;
    result.columns.forEach((c, i) => {
      const w = widths[i]!;
      const label = truncateToWidth(c.label, w, bold);
      const tx = c.type && c.type !== "text" && c.type !== "date" ? x + w - 3 - widthOf(label, bold) : x + 3;
      page.drawText(label, { x: tx, y: y - headerH + 5.5, size: fontSize, font: bold, color: rgb(1, 1, 1) });
      x += w;
    });
    y -= headerH;

    if (rows.length === 0) {
      page.drawText("No records match the selected filters.", { x: margin + 4, y: y - 12, size: 8, font, color: muted });
    }
    rows.forEach((row, ri) => {
      if (ri % 2 === 1) page.drawRectangle({ x: margin, y: y - rowH, width: usableW, height: rowH, color: zebra });
      let cx = margin;
      result.columns.forEach((c, i) => {
        const w = widths[i]!;
        const text = truncateToWidth(cellText(c, row[c.key] ?? null), w);
        const right = c.type && c.type !== "text" && c.type !== "date";
        const tx = right ? cx + w - 3 - widthOf(text) : cx + 3;
        page.drawText(text, { x: tx, y: y - rowH + 4, size: fontSize, font, color: ink });
        cx += w;
      });
      page.drawLine({ start: { x: margin, y: y - rowH }, end: { x: pageW - margin, y: y - rowH }, thickness: 0.4, color: line });
      y -= rowH;
    });

    const footer = `Page ${pageIndex + 1} of ${totalPages}`;
    page.drawText(footer, { x: pageW - margin - widthOf(footer, font, 8), y: margin - 8, size: 8, font, color: muted });
    page.drawText(safe(`${meta.orgName} · ${result.title}`), { x: margin, y: margin - 8, size: 8, font, color: muted });
  });

  return pdf.save();
}

/** Human readable filter summary for export headers. */
export async function describeFilters(f: ReportFilters): Promise<string> {
  const parts: string[] = [];
  const [state, district, block, center, course, batch] = await Promise.all([
    f.stateId ? db.state.findUnique({ where: { id: f.stateId }, select: { name: true } }) : null,
    f.districtId ? db.district.findUnique({ where: { id: f.districtId }, select: { name: true } }) : null,
    f.blockId ? db.block.findUnique({ where: { id: f.blockId }, select: { name: true } }) : null,
    f.centerId ? db.center.findUnique({ where: { id: f.centerId }, select: { code: true } }) : null,
    f.courseId ? db.course.findUnique({ where: { id: f.courseId }, select: { name: true } }) : null,
    f.batchId ? db.batch.findUnique({ where: { id: f.batchId }, select: { code: true } }) : null,
  ]);
  if (state) parts.push(`State: ${state.name}`);
  if (district) parts.push(`District: ${district.name}`);
  if (block) parts.push(`Block: ${block.name}`);
  if (center) parts.push(`Center: ${center.code}`);
  if (course) parts.push(`Course: ${course.name}`);
  if (batch) parts.push(`Batch: ${batch.code}`);
  if (f.status) parts.push(`Status: ${f.status}`);
  const range = resolveDateRange(f);
  if (f.range && f.range !== "all" && f.range !== "custom") parts.push(`Period: ${f.range}`);
  else if (range.from || range.to) parts.push(`Period: ${range.from ? formatDate(range.from) : "…"} – ${f.to ? formatDate(f.to) : "…"}`);
  if (f.q) parts.push(`Search: "${f.q}"`);
  return parts.join(" · ");
}
