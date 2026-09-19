import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { ALL_PERMISSIONS } from "@/lib/rbac/permissions";
import { createCenter } from "@/server/centers";
import { createBatch } from "@/server/batches";
import type { AuditActor } from "@/lib/audit";

let counter = 0;
export function uid(prefix = "t") {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export function daysFromNow(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function ensureAdmin(): Promise<AuditActor> {
  const email = "test-superadmin@eduskill.test";
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { id: existing.id, name: existing.name, role: existing.role };
  const user = await db.user.create({ data: { name: "Test Super Admin", email, mobile: "9000000001", passwordHash: await hashPassword("Admin@12345"), role: "SUPER_ADMIN" } });
  return { id: user.id, name: user.name, role: user.role };
}

export async function ensurePermissions() {
  for (const p of ALL_PERMISSIONS) {
    await db.permission.upsert({ where: { key: p.key }, create: { key: p.key, module: p.module, label: p.label }, update: {} });
  }
}

export async function makeLocation() {
  const tag = uid("").slice(-4).toUpperCase();
  const state = await db.state.create({ data: { name: `State ${tag}`, code: `S${tag}`.slice(0, 5), slug: `state-${tag.toLowerCase()}` } });
  const district = await db.district.create({ data: { stateId: state.id, name: `District ${tag}`, code: `D${tag}`.slice(0, 4), slug: `district-${tag.toLowerCase()}` } });
  const block = await db.block.create({ data: { districtId: district.id, name: `Block ${tag}`, slug: `block-${tag.toLowerCase()}` } });
  return { state, district, block };
}

export async function makeCourse(overrides: Partial<{ courseFee: number; registrationFee: number; scholarshipAvailable: boolean; totalClasses: number; requiredDocuments: string[]; minAttendancePct: number }> = {}) {
  const tag = uid("C").toUpperCase();
  return db.course.create({
    data: {
      code: tag,
      slug: tag.toLowerCase(),
      name: `Course ${tag}`,
      durationText: "4 Weeks",
      durationWeeks: 4,
      totalClasses: overrides.totalClasses ?? 10,
      courseFee: overrides.courseFee ?? 2000,
      registrationFee: overrides.registrationFee ?? 100,
      scholarshipAvailable: overrides.scholarshipAvailable ?? true,
      requiredDocuments: overrides.requiredDocuments ?? [],
      minAttendancePct: overrides.minAttendancePct ?? 75,
      status: "ACTIVE",
    },
  });
}

export async function makeCenter(admin: AuditActor, loc: Awaited<ReturnType<typeof makeLocation>>, courseIds: string[]) {
  return createCenter(
    {
      name: `Center ${uid("")}`,
      stateId: loc.state.id,
      districtId: loc.district.id,
      blockId: loc.block.id,
      address: "1 Test Road",
      pincode: "700001",
      capacity: 50,
      facilities: [],
      status: "ACTIVE",
      isVerified: true,
      courseIds,
    },
    { user: admin }
  );
}

export async function makeBatch(admin: AuditActor, centerId: string, courseId: string, capacity = 10, status: "UPCOMING" | "ONGOING" = "ONGOING") {
  return createBatch(
    { name: `Batch ${uid("")}`, centerId, courseId, startDate: daysFromNow(-10), endDate: daysFromNow(20), startTime: "10:00", endTime: "12:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], capacity, status },
    { user: admin }
  );
}

export async function makeStudent(loc: Awaited<ReturnType<typeof makeLocation>>, opts: { profileCompleted?: boolean; withDocuments?: boolean } = {}) {
  const tag = uid("s");
  const mobile = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
  const user = await db.user.create({ data: { name: `Student ${tag}`, email: `${tag}@student.test`, mobile, passwordHash: await hashPassword("Student@123"), role: "STUDENT" } });
  const student = await db.student.create({
    data: {
      userId: user.id,
      name: user.name,
      mobile,
      email: user.email,
      guardianName: "Guardian",
      guardianRelation: "Father",
      dob: new Date("2003-01-01"),
      gender: "FEMALE",
      stateId: loc.state.id,
      districtId: loc.district.id,
      blockId: loc.block.id,
      address: "Test address",
      pincode: "700001",
      qualification: "Class 12",
      profileCompleted: opts.profileCompleted ?? true,
    },
  });
  if (opts.withDocuments !== false) await addStudentDocuments(student.id, ["photo", "id_proof"]);
  return { user, student };
}

export async function ensureDocumentTypes() {
  await db.documentType.upsert({ where: { key: "photo" }, create: { key: "photo", name: "Photo", appliesTo: "STUDENT", isRequired: true, sortOrder: 1 }, update: {} });
  await db.documentType.upsert({ where: { key: "id_proof" }, create: { key: "id_proof", name: "ID proof", appliesTo: "STUDENT", isRequired: true, sortOrder: 2 }, update: {} });
  await db.documentType.upsert({ where: { key: "resume" }, create: { key: "resume", name: "Resume", appliesTo: "TRAINER", isRequired: true, sortOrder: 1 }, update: {} });
}

export async function addStudentDocuments(studentId: string, types: string[]) {
  for (const type of types) {
    await db.studentDocument.create({ data: { studentId, type, name: `${type}.pdf`, url: `/api/files/private/students/${studentId}/${type}.pdf`, mimeType: "application/pdf", size: 10 } });
  }
}
