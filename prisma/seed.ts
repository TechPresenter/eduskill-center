/**
 * Database seed for EduSkill India Foundation.
 *
 *   npm run db:seed              → reference data + platform defaults + demo data
 *   SEED_DEMO=false npm run db:seed → reference data + platform defaults only (production)
 *
 * Safe to re-run: every record is upserted by its natural key.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { ALL_PERMISSIONS, DEFAULT_STAFF_ROLES } from "../src/lib/rbac/permissions";
import { slugify } from "../src/lib/utils";
import {
  generateAdmissionNo,
  generateApplicationNo,
  generateBatchCode,
  generateCenterCode,
  generateCertificateNo,
  generateEmployeeCode,
  generatePaymentNumbers,
  generateReceiptNo,
  generateStudentId,
  generateTrainerApplicationNo,
  generateTrainerId,
  generateCentreApplicationNo,
} from "../src/lib/ids";
import { CMS_SECTIONS } from "../src/lib/cms/sections";
import { STATES, DISTRICT_CODE_OVERRIDES, DEMO_BLOCKS, deriveDistrictCode } from "./seed-data/locations";
import { COURSE_CATEGORIES, CMS_PAGES, DOCUMENT_TYPES, FAQS, IMPACT_STATS, PROGRAMS, SCHOLARSHIP_PROGRAMS } from "./seed-data/content";
import {
  DEMO_CENTERS,
  DEMO_COURSES,
  DEMO_PASSWORD,
  DEMO_STAFF,
  DEMO_STUDENTS,
  DEMO_SUCCESS_STORIES,
  DEMO_TRAINERS,
  DEMO_TRAINER_APPLICATIONS_PENDING,
  DEMO_CENTRE_APPLICATIONS,
} from "./seed-data/demo";

const SEED_DEMO = process.env.SEED_DEMO !== "false" && !process.argv.includes("--no-demo");

function log(msg: string) {
  console.log(`[seed] ${msg}`);
}

/** True when DATABASE_URL points at this machine, so development-only defaults are safe to use. */
function isLocalDatabase() {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(process.env.DATABASE_URL ?? "").hostname);
  } catch {
    return false;
  }
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Rough word count and reading time for a markdown body, so the demo posts carry
 * real numbers instead of hard-coded ones. The blog service recomputes both
 * precisely on every save; this only has to be close enough that a seeded post
 * does not claim "1 min read" for a 1,200-word article.
 */
function readingStats(markdown: string) {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code is not prose
    .replace(/[#*_`>|]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return { wordCount: words, readingMinutes: Math.max(1, Math.ceil(words / 200)) };
}

// ───────────────────────────── Core ─────────────────────────────

async function seedPermissionsAndRoles() {
  for (const p of ALL_PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, module: p.module, label: p.label },
      update: { module: p.module, label: p.label },
    });
  }
  const perms = await db.permission.findMany({ select: { id: true, key: true } });
  const permId = new Map(perms.map((p) => [p.key, p.id]));

  await db.role.upsert({
    where: { slug: "super-admin" },
    create: { name: "Super Admin", slug: "super-admin", description: "Full control of the platform.", isSystem: true },
    update: {},
  });

  for (const role of DEFAULT_STAFF_ROLES) {
    const r = await db.role.upsert({
      where: { slug: role.slug },
      create: { name: role.name, slug: role.slug, description: role.description, isSystem: true },
      update: { description: role.description },
    });
    const existing = await db.rolePermission.count({ where: { roleId: r.id } });
    if (existing === 0) {
      await db.rolePermission.createMany({
        data: role.permissions.filter((k) => permId.has(k)).map((k) => ({ roleId: r.id, permissionId: permId.get(k)! })),
        skipDuplicates: true,
      });
    }
  }
  log(`permissions (${perms.length}) and roles ready`);
}

async function seedSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@eduskillindia.org";
  // The built-in password is a local-development convenience and is published in the README, so it
  // must never reach a real deployment. Against any non-local database, SEED_SUPER_ADMIN_PASSWORD
  // is required rather than defaulted.
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? (isLocalDatabase() ? "SuperAdmin@123" : "");
  if (!password) {
    throw new Error(
      "Refusing to create the Super Admin with the built-in development password against a non-local database. " +
        "Set SEED_SUPER_ADMIN_PASSWORD (and SEED_SUPER_ADMIN_EMAIL) before seeding."
    );
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    log(`super admin exists (${email})`);
    return existing;
  }
  const user = await db.user.create({
    data: { name: "EduSkill Super Admin", email, mobile: "9999999999", passwordHash: await hashPassword(password), role: "SUPER_ADMIN" },
  });
  await db.staff.create({
    data: { userId: user.id, employeeCode: await generateEmployeeCode(), designation: "Super Administrator", department: "Foundation" },
  });
  log(`super admin created: ${email} / ${password}`);
  return user;
}

async function seedLocations() {
  let districtCount = 0;
  for (const [i, s] of STATES.entries()) {
    const state = await db.state.upsert({
      where: { code: s.code },
      create: { name: s.name, code: s.code, slug: slugify(s.name), sortOrder: i + 1 },
      update: { name: s.name, slug: slugify(s.name), sortOrder: i + 1 },
    });
    const taken = new Set<string>(
      (await db.district.findMany({ where: { stateId: state.id }, select: { code: true } })).map((d) => d.code)
    );
    for (const [j, name] of s.districts.entries()) {
      const existing = await db.district.findUnique({ where: { stateId_name: { stateId: state.id, name } } });
      if (existing) continue;
      const override = DISTRICT_CODE_OVERRIDES[`${s.code}:${name}`];
      const code = override && !taken.has(override) ? override : deriveDistrictCode(name, taken);
      taken.add(code);
      await db.district.create({ data: { stateId: state.id, name, code, slug: slugify(name), sortOrder: j + 1 } });
      districtCount++;
    }
  }
  log(`states (${STATES.length}) and districts (+${districtCount}) ready`);
}

async function seedDemoBlocks() {
  let count = 0;
  for (const [key, blocks] of Object.entries(DEMO_BLOCKS)) {
    const [stateCode, districtName] = key.split(":");
    const state = await db.state.findUnique({ where: { code: stateCode! } });
    if (!state) continue;
    const district = await db.district.findUnique({ where: { stateId_name: { stateId: state.id, name: districtName! } } });
    if (!district) continue;
    for (const [i, name] of blocks.entries()) {
      await db.block.upsert({
        where: { districtId_name: { districtId: district.id, name } },
        create: { districtId: district.id, name, slug: slugify(name), sortOrder: i + 1 },
        update: {},
      });
      count++;
    }
  }
  log(`blocks (${count}) ready`);
}

async function seedPlatformContent() {
  for (const d of DOCUMENT_TYPES) {
    await db.documentType.upsert({
      where: { key: d.key },
      create: { key: d.key, name: d.name, appliesTo: d.appliesTo, isRequired: d.isRequired, sortOrder: d.sortOrder, description: "description" in d ? d.description : null },
      update: {},
    });
  }
  for (const [i, p] of PROGRAMS.entries()) {
    await db.program.upsert({
      where: { slug: slugify(p.title) },
      create: { title: p.title, slug: slugify(p.title), icon: p.icon, summary: p.summary, sortOrder: i + 1, content: `## ${p.title}\n\n${p.summary}\n\nEdit this program from Admin → CMS → Programs.` },
      update: {},
    });
  }
  for (const [i, f] of FAQS.entries()) {
    const exists = await db.faq.findFirst({ where: { question: f.question } });
    if (!exists) await db.faq.create({ data: { question: f.question, answer: f.answer, category: f.category, sortOrder: i + 1 } });
  }
  for (const p of CMS_PAGES) {
    await db.cmsPage.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, title: p.title, content: p.content, excerpt: p.excerpt, status: "PUBLISHED" },
      update: {},
    });
  }
  for (const s of CMS_SECTIONS) {
    await db.cmsSection.upsert({
      where: { key: s.key },
      create: { key: s.key, name: s.name, data: s.defaults as object },
      update: {},
    });
  }
  for (const s of IMPACT_STATS) {
    await db.impactStat.upsert({
      where: { key: s.key },
      create: { key: s.key, label: s.label, sortOrder: s.sortOrder, suffix: s.suffix, source: "AUTO" },
      update: {},
    });
  }
  for (const c of COURSE_CATEGORIES) {
    await db.courseCategory.upsert({
      where: { slug: slugify(c.name) },
      create: { name: c.name, slug: slugify(c.name), icon: c.icon, sortOrder: c.sortOrder },
      update: {},
    });
  }
  for (const s of SCHOLARSHIP_PROGRAMS) {
    await db.scholarshipProgram.upsert({
      where: { slug: s.slug },
      create: { name: s.name, slug: s.slug, type: s.type, percentage: s.percentage, description: s.description, eligibilityCriteria: s.eligibilityCriteria },
      update: {},
    });
  }
  log("platform content ready (document types, programs, FAQs, pages, sections, stats, categories, scholarships)");
}

// ───────────────────────────── Demo ─────────────────────────────

async function seedDemo(superAdminId: string) {
  const marker = await db.user.findUnique({ where: { email: DEMO_STUDENTS[0]!.email } });
  if (marker) {
    log("demo data already present – skipping");
    return;
  }
  const password = await hashPassword(DEMO_PASSWORD);

  // Courses
  const categories = await db.courseCategory.findMany();
  const catId = new Map(categories.map((c) => [c.name, c.id]));
  const courseByCode = new Map<string, { id: string; name: string; courseFee: number; registrationFee: number; examFee: number; certificateFee: number; durationText: string; totalClasses: number }>();
  for (const [i, c] of DEMO_COURSES.entries()) {
    const course = await db.course.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        slug: slugify(c.name),
        name: c.name,
        categoryId: catId.get(c.category) ?? null,
        shortDescription: c.shortDescription,
        description: `${c.shortDescription}\n\nThis course is delivered at EduSkill training centers by verified volunteer trainers. Students who meet the attendance and assessment requirements receive a verifiable EduSkill certificate.`,
        icon: c.icon,
        durationText: c.durationText,
        durationWeeks: c.durationWeeks,
        level: c.level,
        mode: c.mode,
        eligibility: c.eligibility,
        minAge: c.minAge,
        syllabus: c.syllabus.map((title, idx) => ({ module: idx + 1, title })),
        totalClasses: c.totalClasses,
        courseFee: c.courseFee,
        registrationFee: c.registrationFee,
        examFee: "examFee" in c ? c.examFee : 0,
        certificateFee: "certificateFee" in c ? c.certificateFee : 0,
        scholarshipAvailable: c.scholarshipAvailable,
        scholarshipNote: c.scholarshipAvailable ? "Need-based and merit scholarships available." : null,
        certificateEligibility: "Minimum 75% attendance and 40% in the final assessment.",
        requiredDocuments: [...c.requiredDocuments],
        status: "ACTIVE",
        isFeatured: c.isFeatured,
        sortOrder: i + 1,
      },
      update: {},
    });
    courseByCode.set(c.code, {
      id: course.id,
      name: course.name,
      courseFee: c.courseFee,
      registrationFee: c.registrationFee,
      examFee: "examFee" in c ? c.examFee : 0,
      certificateFee: "certificateFee" in c ? c.certificateFee : 0,
      durationText: c.durationText,
      totalClasses: c.totalClasses,
    });
  }
  log(`demo courses (${DEMO_COURSES.length})`);

  // Centers
  const centers: { id: string; code: string; name: string; stateId: string; districtId: string; blockId: string }[] = [];
  for (const c of DEMO_CENTERS) {
    const state = await db.state.findUniqueOrThrow({ where: { code: c.state } });
    const district = await db.district.findUniqueOrThrow({ where: { stateId_name: { stateId: state.id, name: c.district } } });
    const block = await db.block.findUniqueOrThrow({ where: { districtId_name: { districtId: district.id, name: c.block } } });
    const { code, sequence } = await generateCenterCode(state.code, district.code);
    const center = await db.center.create({
      data: {
        code,
        codeSequence: sequence,
        name: c.name,
        slug: slugify(c.name),
        stateId: state.id,
        districtId: district.id,
        blockId: block.id,
        address: c.address,
        villageTown: c.villageTown,
        pincode: c.pincode,
        latitude: c.lat,
        longitude: c.lng,
        phone: c.phone,
        whatsapp: c.phone,
        email: c.email,
        openingHours: { mon_sat: "9:00 AM – 7:00 PM", sun: "Closed" },
        capacity: c.capacity,
        facilities: c.facilities,
        description: c.description,
        isVerified: c.verified,
        status: c.verified ? "ACTIVE" : "PENDING",
        establishedOn: daysFromNow(-400),
        contactPerson: "Center Coordinator",
        createdById: superAdminId,
        courses: { create: c.courses.map((code) => ({ courseId: courseByCode.get(code)!.id })) },
      },
    });
    centers.push({ id: center.id, code: center.code, name: center.name, stateId: state.id, districtId: district.id, blockId: block.id });
  }
  log(`demo centers (${centers.length})`);

  // Staff
  const roles = await db.role.findMany();
  const roleBySlug = new Map(roles.map((r) => [r.slug, r.id]));
  for (const s of DEMO_STAFF) {
    const user = await db.user.create({ data: { name: s.name, email: s.email, mobile: s.mobile, passwordHash: password, role: "STAFF" } });
    await db.staff.create({
      data: { userId: user.id, employeeCode: await generateEmployeeCode(), designation: s.designation, department: s.department, roleId: roleBySlug.get(s.role) ?? null, createdById: superAdminId },
    });
  }
  log(`demo staff (${DEMO_STAFF.length})`);

  // Trainers (approved) with applications
  const trainers: { id: string; userId: string; centerIndex: number }[] = [];
  for (const t of DEMO_TRAINERS) {
    const state = await db.state.findUniqueOrThrow({ where: { code: t.state } });
    const district = t.district ? await db.district.findUniqueOrThrow({ where: { stateId_name: { stateId: state.id, name: t.district } } }) : null;
    const block = t.block && district ? await db.block.findUniqueOrThrow({ where: { districtId_name: { districtId: district.id, name: t.block } } }) : null;
    const user = await db.user.create({ data: { name: t.name, email: t.email, mobile: t.mobile, passwordHash: password, role: "TRAINER" } });
    const application = await db.trainerApplication.create({
      data: {
        applicationNo: await generateTrainerApplicationNo(),
        userId: user.id,
        name: t.name,
        mobile: t.mobile,
        whatsapp: t.mobile,
        email: t.email,
        dob: new Date(t.dob),
        gender: t.gender,
        level: t.level,
        stateId: state.id,
        districtId: district?.id ?? null,
        blockId: block?.id ?? null,
        address: t.address,
        pincode: t.pincode,
        qualification: t.qualification,
        skills: [...t.skills],
        experienceYears: t.experienceYears,
        teachingExperienceYears: t.teachingExperienceYears,
        preferredCourseIds: t.courses.map((c) => courseByCode.get(c)!.id),
        languages: [...t.languages],
        availability: "Weekdays evening, weekends",
        trainingMode: "OFFLINE",
        motivation: t.motivation,
        status: "APPROVED",
        reviewedById: superAdminId,
        submittedAt: daysFromNow(-90),
        statusHistory: {
          create: [
            { toStatus: "SUBMITTED", createdAt: daysFromNow(-90) },
            { fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", changedById: superAdminId, createdAt: daysFromNow(-85) },
            { fromStatus: "UNDER_REVIEW", toStatus: "VERIFIED", changedById: superAdminId, createdAt: daysFromNow(-80) },
            { fromStatus: "VERIFIED", toStatus: "APPROVED", changedById: superAdminId, note: "Approved after document verification.", createdAt: daysFromNow(-75) },
          ],
        },
      },
    });
    const trainer = await db.trainer.create({
      data: {
        trainerId: await generateTrainerId(),
        userId: user.id,
        applicationId: application.id,
        level: t.level,
        stateId: state.id,
        districtId: district?.id ?? null,
        blockId: block?.id ?? null,
        status: "ACTIVE",
        skills: [...t.skills],
        languages: [...t.languages],
        qualification: t.qualification,
        bio: t.motivation,
        joinedAt: daysFromNow(-75),
      },
    });
    const center = centers[t.center]!;
    await db.trainerAssignment.create({
      data: { trainerId: trainer.id, centerId: center.id, courseId: courseByCode.get(t.courses[0]!)!.id, assignedById: superAdminId, assignedAt: daysFromNow(-70) },
    });
    trainers.push({ id: trainer.id, userId: user.id, centerIndex: t.center });
  }
  log(`demo trainers (${trainers.length})`);

  // Pending trainer applications
  for (const t of DEMO_TRAINER_APPLICATIONS_PENDING) {
    const state = await db.state.findUniqueOrThrow({ where: { code: t.state } });
    const district = t.district ? await db.district.findUniqueOrThrow({ where: { stateId_name: { stateId: state.id, name: t.district } } }) : null;
    const block = t.block && district ? await db.block.findUniqueOrThrow({ where: { districtId_name: { districtId: district.id, name: t.block } } }) : null;
    await db.trainerApplication.create({
      data: {
        applicationNo: await generateTrainerApplicationNo(),
        name: t.name,
        mobile: t.mobile,
        whatsapp: t.mobile,
        email: t.email,
        dob: new Date(t.dob),
        gender: t.gender,
        level: t.level,
        stateId: state.id,
        districtId: district?.id ?? null,
        blockId: block?.id ?? null,
        address: t.address,
        pincode: t.pincode,
        qualification: t.qualification,
        skills: [...t.skills],
        experienceYears: t.experienceYears,
        teachingExperienceYears: t.teachingExperienceYears,
        languages: [...t.languages],
        availability: "Weekends",
        trainingMode: "OFFLINE",
        motivation: t.motivation,
        status: t.status,
        interviewAt: t.status === "INTERVIEW" ? daysFromNow(5) : null,
        interviewMode: t.status === "INTERVIEW" ? "Video call" : null,
        submittedAt: daysFromNow(-10),
        statusHistory: { create: [{ toStatus: "SUBMITTED", createdAt: daysFromNow(-10) }] },
      },
    });
  }
  log(`demo pending trainer applications (${DEMO_TRAINER_APPLICATIONS_PENDING.length})`);

  // Applications to open a Normal Education Centre, at four different points of the seven steps.
  // The statuses each application has already passed through are replayed into its history so the
  // admin timeline and the public tracker are not empty.
  const CENTRE_PATH = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "DOCUMENTS_REQUIRED",
    "DOCUMENTS_VERIFIED",
    "CENTRE_VERIFICATION",
    "SELECTED",
    "AGREEMENT_PENDING",
    "AGREEMENT_SIGNED",
    "ORIENTATION",
  ] as const;
  for (const c of DEMO_CENTRE_APPLICATIONS) {
    const state = await db.state.findUniqueOrThrow({ where: { code: c.state } });
    const district = await db.district.findUniqueOrThrow({ where: { stateId_name: { stateId: state.id, name: c.district } } });
    const block = await db.block.findUniqueOrThrow({ where: { districtId_name: { districtId: district.id, name: c.block } } });
    const submittedAt = daysFromNow(-c.submittedDaysAgo);

    // "Documents required" is a loop back, so it is only in the history of the one that sits there.
    const reached = CENTRE_PATH.slice(0, CENTRE_PATH.indexOf(c.status) + 1).filter(
      (st) => st !== "DOCUMENTS_REQUIRED" || c.status === "DOCUMENTS_REQUIRED",
    );
    const span = Math.max(1, Math.floor(c.submittedDaysAgo / Math.max(1, reached.length)));

    await db.centreApplication.create({
      data: {
        applicationNo: await generateCentreApplicationNo(),
        applicantName: c.applicantName,
        mobile: c.mobile,
        whatsapp: c.mobile,
        email: c.email,
        dob: new Date(c.dob),
        gender: c.gender,
        qualification: c.qualification,
        occupation: c.occupation,
        teachingExperienceYears: c.teachingExperienceYears,
        stateId: state.id,
        districtId: district.id,
        blockId: block.id,
        villageTown: c.villageTown,
        address: c.address,
        pincode: c.pincode,
        proposedName: c.proposedName,
        spaceType: c.spaceType,
        roomCount: c.roomCount,
        areaSqft: c.areaSqft,
        seatingCapacity: c.seatingCapacity,
        hasElectricity: c.hasElectricity,
        hasToilet: c.hasToilet,
        hasDrinkingWater: c.hasDrinkingWater,
        hasFurniture: c.hasFurniture,
        expectedStudents: c.expectedStudents,
        classes: [...c.classes],
        motivation: c.motivation,
        status: c.status,
        reviewNotes: "reviewNotes" in c ? c.reviewNotes : null,
        verificationAt: "verificationInDays" in c ? daysFromNow(c.verificationInDays) : null,
        orientationAt: "orientationInDays" in c ? daysFromNow(c.orientationInDays) : null,
        orientationMode: "orientationInDays" in c ? "At the district office" : null,
        agreementReference: "agreementReference" in c ? c.agreementReference : null,
        agreementSignedAt: "agreementReference" in c ? daysFromNow(-span) : null,
        submittedAt,
        statusHistory: {
          create: reached.map((toStatus, i) => ({
            fromStatus: i === 0 ? null : reached[i - 1],
            toStatus,
            createdAt: daysFromNow(-c.submittedDaysAgo + i * span),
          })),
        },
      },
    });
  }
  log(`demo centre applications (${DEMO_CENTRE_APPLICATIONS.length})`);

  // Batches: one ongoing + one upcoming per center; a completed one at center 0
  const batchesByCenterCourse = new Map<string, string>();
  const ongoingBatchByCenter = new Map<number, string>();
  let completedBatchId = "";
  for (const [i, center] of centers.entries()) {
    const centerCourses = DEMO_CENTERS[i]!.courses;
    const trainer = trainers.find((t) => t.centerIndex === i);
    for (const [j, courseCode] of centerCourses.slice(0, 2).entries()) {
      const course = courseByCode.get(courseCode)!;
      const ongoing = j === 0;
      const batch = await db.batch.create({
        data: {
          code: await generateBatchCode(center.code),
          name: `${course.name} – ${ongoing ? "Morning" : "Evening"} Batch`,
          centerId: center.id,
          courseId: course.id,
          trainerId: trainer?.id ?? null,
          startDate: ongoing ? daysFromNow(-30) : daysFromNow(20),
          endDate: ongoing ? daysFromNow(60) : daysFromNow(110),
          startTime: ongoing ? "10:00" : "17:00",
          endTime: ongoing ? "12:00" : "19:00",
          days: ongoing ? ["Mon", "Tue", "Wed", "Thu", "Fri"] : ["Mon", "Wed", "Fri", "Sat"],
          capacity: 25,
          room: ongoing ? "Room 1" : "Room 2",
          status: ongoing ? "ONGOING" : "UPCOMING",
          createdById: superAdminId,
        },
      });
      batchesByCenterCourse.set(`${i}:${courseCode}`, batch.id);
      if (ongoing) ongoingBatchByCenter.set(i, batch.id);
    }
  }
  {
    const center = centers[0]!;
    const course = courseByCode.get("DLF-101")!;
    const batch = await db.batch.create({
      data: {
        code: await generateBatchCode(center.code),
        name: `${course.name} – Completed Batch`,
        centerId: center.id,
        courseId: course.id,
        trainerId: trainers[0]!.id,
        startDate: daysFromNow(-150),
        endDate: daysFromNow(-100),
        startTime: "10:00",
        endTime: "12:00",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        capacity: 25,
        room: "Room 1",
        status: "COMPLETED",
        createdById: superAdminId,
      },
    });
    completedBatchId = batch.id;
    batchesByCenterCourse.set("0:DLF-101", batch.id);
  }
  log("demo batches");

  // Students & applications
  for (const s of DEMO_STUDENTS) {
    const state = await db.state.findUniqueOrThrow({ where: { code: s.state } });
    const district = await db.district.findUniqueOrThrow({ where: { stateId_name: { stateId: state.id, name: s.district } } });
    const block = await db.block.findUniqueOrThrow({ where: { districtId_name: { districtId: district.id, name: s.block } } });
    const user = await db.user.create({ data: { name: s.name, email: s.email, mobile: s.mobile, passwordHash: password, role: "STUDENT" } });
    const confirmed = s.status === "ADMISSION_CONFIRMED" || s.status === "COMPLETED";
    const student = await db.student.create({
      data: {
        userId: user.id,
        studentId: confirmed ? await generateStudentId() : null,
        name: s.name,
        guardianName: s.guardianName,
        guardianRelation: s.guardianRelation,
        dob: new Date(s.dob),
        gender: s.gender,
        mobile: s.mobile,
        whatsapp: s.mobile,
        email: s.email,
        stateId: state.id,
        districtId: district.id,
        blockId: block.id,
        villageTown: s.villageTown,
        address: s.address,
        pincode: s.pincode,
        qualification: s.qualification,
        institution: s.institution,
        passingYear: s.passingYear,
        familyIncome: s.familyIncome,
        occupation: s.occupation,
        areaType: s.areaType,
        trainingRequirement: "Looking for a job-oriented course near home.",
        scholarshipRequired: s.scholarshipRequired,
        profileCompleted: true,
      },
    });

    const center = centers[s.center]!;
    const course = courseByCode.get(s.course)!;
    const batchId = s.status === "COMPLETED" ? completedBatchId : (batchesByCenterCourse.get(`${s.center}:${s.course}`) ?? null);
    const originalFee = course.courseFee + course.registrationFee + course.examFee + course.certificateFee;
    const scholarship = s.scholarshipRequired && originalFee > 0 && ["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "COMPLETED"].includes(s.status) ? Math.round(originalFee * 0.5) : 0;
    const payable = originalFee - scholarship;
    const paid = ["PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "COMPLETED"].includes(s.status) ? payable : 0;

    const seq: string[] = ["DRAFT", "SUBMITTED"];
    if (s.status !== "SUBMITTED") seq.push("UNDER_REVIEW");
    if (["DOCUMENTS_REQUIRED"].includes(s.status)) seq.push("DOCUMENTS_REQUIRED");
    if (["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "COMPLETED"].includes(s.status)) seq.push("APPROVED");
    if (["PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "COMPLETED"].includes(s.status) && payable > 0) seq.push("PAYMENT_PENDING");
    if (["PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "COMPLETED"].includes(s.status) && payable > 0) seq.push("PAYMENT_COMPLETED");
    if (["ADMISSION_CONFIRMED", "COMPLETED"].includes(s.status)) seq.push("ADMISSION_CONFIRMED");
    if (s.status === "COMPLETED") seq.push("COMPLETED");
    if (["WAITLISTED", "REJECTED"].includes(s.status)) seq.push(s.status);

    const application = await db.application.create({
      data: {
        applicationNo: await generateApplicationNo(),
        studentId: student.id,
        centerId: center.id,
        courseId: course.id,
        batchId,
        status: s.status,
        originalFee,
        scholarshipAmount: scholarship,
        payableAmount: payable,
        paidAmount: paid,
        scholarshipRequested: s.scholarshipRequired,
        scholarshipReason: s.scholarshipRequired ? "Family income is low and I cannot afford the fee." : null,
        submittedAt: daysFromNow(-40),
        reviewedById: s.status === "SUBMITTED" ? null : superAdminId,
        rejectionReason: s.status === "REJECTED" ? "Does not meet the minimum eligibility for this course." : null,
        documentsRequestNote: s.status === "DOCUMENTS_REQUIRED" ? "Please upload a clear copy of your Class 12 marksheet." : null,
        waitlistPosition: s.status === "WAITLISTED" ? 1 : null,
        fees: {
          create: [
            ...(course.registrationFee ? [{ type: "REGISTRATION" as const, description: "Registration fee", amount: course.registrationFee }] : []),
            ...(course.courseFee ? [{ type: "COURSE" as const, description: "Course fee", amount: course.courseFee }] : []),
            ...(course.examFee ? [{ type: "EXAM" as const, description: "Exam fee", amount: course.examFee }] : []),
            ...(course.certificateFee ? [{ type: "CERTIFICATE" as const, description: "Certificate fee", amount: course.certificateFee }] : []),
          ],
        },
        statusHistory: {
          create: seq.slice(1).map((st, idx) => ({
            fromStatus: seq[idx] as never,
            toStatus: st as never,
            changedById: idx === 0 ? null : superAdminId,
            createdAt: daysFromNow(-40 + idx * 3),
          })),
        },
        documents: {
          create: [
            { studentId: student.id, type: "photo", name: "photo.jpg", url: "/api/files/private/demo/placeholder-photo.jpg", mimeType: "image/jpeg", size: 0, status: s.status === "SUBMITTED" ? "PENDING" : "VERIFIED" },
            { studentId: student.id, type: "id_proof", name: "aadhaar.pdf", url: "/api/files/private/demo/placeholder-id.pdf", mimeType: "application/pdf", size: 0, status: s.status === "SUBMITTED" ? "PENDING" : "VERIFIED" },
          ],
        },
      },
    });

    if (scholarship > 0) {
      const program = await db.scholarshipProgram.findUnique({ where: { slug: "merit-50" } });
      await db.scholarshipAward.create({
        data: { programId: program?.id ?? null, applicationId: application.id, studentId: student.id, courseId: course.id, originalFee, scholarshipAmount: scholarship, payableFee: payable, status: "APPROVED", approvedById: superAdminId, approvedAt: daysFromNow(-30), remarks: "50% merit scholarship approved (demo)." },
      });
    }

    if (paid > 0) {
      const nums = await generatePaymentNumbers();
      await db.payment.create({
        data: {
          paymentNo: nums.paymentNo,
          invoiceNo: nums.invoiceNo,
          receiptNo: await generateReceiptNo(),
          applicationId: application.id,
          studentId: student.id,
          amount: paid,
          method: s.status === "PAYMENT_COMPLETED" ? "ONLINE" : "UPI",
          gateway: "manual",
          status: "COMPLETED",
          description: `Fee payment for ${course.name}`,
          referenceNo: `UPI${Math.floor(100000000 + Math.random() * 900000000)}`,
          paidAt: daysFromNow(-25),
          verifiedById: superAdminId,
          verifiedAt: daysFromNow(-24),
        },
      });
    }

    if (confirmed && batchId) {
      const admission = await db.admission.create({
        data: {
          admissionNo: await generateAdmissionNo(),
          applicationId: application.id,
          studentId: student.id,
          centerId: center.id,
          courseId: course.id,
          batchId,
          trainerId: trainers.find((t) => t.centerIndex === s.center)?.id ?? null,
          status: s.status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
          admittedAt: s.status === "COMPLETED" ? daysFromNow(-150) : daysFromNow(-22),
          completedAt: s.status === "COMPLETED" ? daysFromNow(-100) : null,
          approvedById: superAdminId,
        },
      });

      // Attendance for past class days
      const start = s.status === "COMPLETED" ? -150 : -22;
      const end = s.status === "COMPLETED" ? -100 : -1;
      let held = 0;
      let attended = 0;
      for (let d = start; d <= end; d++) {
        const date = daysFromNow(d);
        const dow = date.getUTCDay();
        if (dow === 0 || dow === 6) continue;
        held++;
        const roll = (d * 7 + s.center) % 10;
        const status = roll === 0 ? "ABSENT" : roll === 1 ? "LATE" : roll === 2 ? "LEAVE" : "PRESENT";
        if (status === "PRESENT" || status === "LATE") attended++;
        await db.attendance.create({ data: { batchId, studentId: student.id, date, status, markedById: trainers.find((t) => t.centerIndex === s.center)?.userId ?? superAdminId } });
      }
      const attendancePct = held ? Math.round((attended / held) * 10000) / 100 : 0;
      await db.studentProgress.create({
        data: {
          admissionId: admission.id,
          totalClasses: course.totalClasses,
          classesHeld: held,
          classesAttended: attended,
          attendancePct,
          assignmentsTotal: 2,
          assignmentsCompleted: s.status === "COMPLETED" ? 2 : 1,
          assessmentAvgPct: s.status === "COMPLETED" ? 82 : 0,
          finalMarksPct: s.status === "COMPLETED" ? 82 : null,
          completionPct: s.status === "COMPLETED" ? 100 : Math.min(100, Math.round((held / course.totalClasses) * 100)),
          isCompleted: s.status === "COMPLETED",
          completedAt: s.status === "COMPLETED" ? daysFromNow(-100) : null,
          certificateEligible: s.status === "COMPLETED",
        },
      });

      if (s.status === "COMPLETED") {
        await db.certificate.create({
          data: {
            certificateNo: await generateCertificateNo(),
            admissionId: admission.id,
            studentId: student.id,
            courseId: course.id,
            centerId: center.id,
            studentName: s.name,
            courseName: course.name,
            centerName: center.name,
            centerCode: center.code,
            durationText: course.durationText,
            completionDate: daysFromNow(-100),
            issuedAt: daysFromNow(-95),
            grade: "A",
            signatoryName: "Authorised Signatory",
            signatoryTitle: "EduSkill India Foundation",
            issuedById: superAdminId,
          },
        });
      }
    }
  }
  log(`demo students (${DEMO_STUDENTS.length}) with applications, payments, admissions, attendance and a certificate`);

  // Assignments & assessments for the ongoing Kolkata batch
  const kolkataBatch = ongoingBatchByCenter.get(0);
  if (kolkataBatch) {
    await db.assignment.create({ data: { batchId: kolkataBatch, trainerId: trainers[0]!.id, title: "Create a formatted resume in MS Word", description: "Use headings, bullet points and a table. Submit as PDF.", dueDate: daysFromNow(7), maxMarks: 20, createdById: trainers[0]!.userId } });
    await db.assignment.create({ data: { batchId: kolkataBatch, trainerId: trainers[0]!.id, title: "Monthly budget in Excel", description: "Build a budget sheet with formulas and a chart.", dueDate: daysFromNow(14), maxMarks: 20, createdById: trainers[0]!.userId } });
    await db.assessment.create({ data: { batchId: kolkataBatch, title: "Mid-term practical", type: "MID_TERM", date: daysFromNow(10), maxMarks: 50, passingMarks: 20, weightage: 1, createdById: trainers[0]!.userId } });
    await db.studyMaterial.create({ data: { batchId: kolkataBatch, courseId: courseByCode.get("BCA-102")!.id, title: "MS Word Quick Reference (PDF)", description: "Shortcuts and formatting basics.", fileUrl: "/api/files/public/demo/ms-word-quick-reference.pdf", fileType: "pdf", uploadedById: trainers[0]!.userId } });
    await db.announcement.create({ data: { title: "Welcome to the Morning Batch!", body: "Classes run Monday to Friday, 10:00–12:00 in Room 1. Please carry your Student ID.", audience: "BATCH", batchId: kolkataBatch, centerId: centers[0]!.id, createdById: superAdminId } });
  }

  // Success stories (published, clearly marked demo)
  for (const [i, st] of DEMO_SUCCESS_STORIES.entries()) {
    const course = courseByCode.get(st.courseCode)!;
    const center = centers[st.center]!;
    await db.successStory.create({
      data: { studentName: st.studentName, courseId: course.id, courseName: course.name, centerId: center.id, centerName: center.name, location: st.location, story: st.story, achievement: st.achievement, isPublished: true, isFeatured: i < 3, sortOrder: i + 1 },
    });
  }

  // ── Blog: categories, authors, posts and the tag lookup ──
  // The demo set deliberately covers every state the blog UI has to render — live,
  // featured, scheduled, draft and archived. The scheduled row (PUBLISHED with a
  // future publishedAt) is the only way to confirm by inspection that scheduling
  // holds: it must appear in Admin → CMS → Blog and be absent from every public
  // surface. Covers are left null ON PURPOSE so the branded MediaPlaceholder
  // fallback is what reviewers see rather than stock photography.
  const blogCategoryIds = new Map<string, string>();
  for (const c of [
    { name: "Skill Development", icon: "GraduationCap", description: "Courses, curriculum and what employers are actually asking for." },
    { name: "Student Stories", icon: "Users", description: "Where our students were before the course, and where they are now." },
    { name: "Centre Updates", icon: "Building2", description: "New centres, new labs and news from the districts we work in." },
    { name: "Foundation News", icon: "Megaphone", description: "Announcements, partnerships and reports from the Foundation." },
  ].map((c, i) => ({ ...c, sortOrder: i + 1 }))) {
    const row = await db.blogCategory.create({
      data: { name: c.name, slug: slugify(c.name), description: c.description, icon: c.icon, sortOrder: c.sortOrder, isActive: true },
    });
    blogCategoryIds.set(c.name, row.id);
  }

  const blogAuthorIds = new Map<string, string>();
  for (const a of [
    { name: "EduSkill Team", role: "Foundation Desk", bio: "The Foundation's content desk writes up programme news, centre updates and guidance for students. Reach us through the contact form for anything you would like covered." },
    { name: "Ananya Deshmukh", role: "Programme Lead — Digital Skills", bio: "Ananya has run digital literacy and computer-application batches across Maharashtra and Bihar since 2019. She writes about what works inside a classroom of twenty shared machines." },
  ].map((a, i) => ({ ...a, sortOrder: i + 1 }))) {
    const row = await db.blogAuthor.create({
      data: { name: a.name, slug: slugify(a.name), role: a.role, bio: a.bio, isActive: true, sortOrder: a.sortOrder },
    });
    blogAuthorIds.set(a.name, row.id);
  }

  const demoPosts: {
    title: string;
    slug: string;
    category: string;
    author: string;
    excerpt: string;
    seoTitle: string;
    seoDescription: string;
    tags: string[];
    status: "PUBLISHED" | "DRAFT" | "ARCHIVED";
    publishedAt: Date | null;
    isFeatured?: boolean;
    content: string;
  }[] = [
    {
      title: "Why Digital Literacy Is the First Step to Employment",
      slug: "why-digital-literacy-first-step",
      category: "Skill Development",
      author: "EduSkill Team",
      excerpt: "How basic digital skills unlock access to jobs, government services and learning — and why we teach them before anything else.",
      seoTitle: "Why Digital Literacy Comes First in Skill Training",
      seoDescription: "Digital literacy is the gateway skill for employment in India. Here is what we teach, how we test it, and what changes for students afterwards.",
      tags: ["digital literacy", "employment"],
      status: "PUBLISHED",
      publishedAt: daysFromNow(-30),
      content: [
        "## The gateway skill",
        "Almost every job our students apply for now asks for the same three things before it asks about a trade: a phone number that reliably receives an OTP, an email address the employer can write to, and the confidence to fill in an online form without help. None of that is a computer course. All of it is digital literacy, and it is the reason we teach it before anything else.",
        "Across the last four batches at our Kolkata centre, students who cleared the digital literacy module in the first fortnight finished their main trade course roughly three weeks sooner than students who were still learning to type when the trade classes began.",
        "## What digital literacy actually means",
        "The phrase gets used loosely, so we made it concrete. A student has cleared the module when they can do all of the following unaided, on a shared machine, in front of a trainer who is not allowed to touch the mouse.",
        "### The four skills we test for",
        "1. **Operate the device.** Switch on a desktop, join the Wi-Fi, find a file they saved last week and use a pen drive without asking.\n2. **Communicate.** Create and use an email account, attach a document, and recognise a phishing message when one arrives.\n3. **Transact.** Use UPI safely, read an SMS receipt, and understand why an OTP is never read out to a caller.\n4. **Find and file.** Search for a government scheme, open the correct portal and complete an application with their own documents.",
        "The fourth one matters more than people expect. A student who can navigate a state skill portal will register themselves for the next scheme years after they have left us, with nobody standing behind them.",
        "## How we teach it",
        "Two hours a day for three weeks, on the same machines the student will use for the rest of the course, with no textbook. Every exercise produces something real — an email to the centre coordinator, a resume saved as a PDF, a scholarship form submitted to the district office. Trainers narrate instead of demonstrating, because a student who watches somebody else click has learned nothing they can repeat at home.",
        "Centres that run the module in the local language first and then repeat the identical tasks in English see fewer dropouts in week two. We now recommend that order everywhere.",
        "## What changes afterwards",
        "The visible change is employability: a candidate who can send a formatted resume by email is shortlisted more often than one who cannot, whatever their trade marks say. The quieter change is confidence. Students stop waiting for a cousin or a shopkeeper to fill in forms on their behalf, and that independence outlasts any single job.",
        "That is what we are actually training. The certificate at the end is only the receipt.",
        "_This is a demo article. Edit or delete it from Admin → CMS → Blog._",
      ].join("\n\n"),
    },
    {
      title: "From a Tailoring Batch in Nashik to Her Own Boutique",
      slug: "from-tailoring-batch-to-her-own-boutique",
      category: "Student Stories",
      author: "Ananya Deshmukh",
      excerpt: "Sunita joined a six-month tailoring course to find a factory job. Eighteen months later she employs four women from her own street.",
      seoTitle: "From a Tailoring Course to a Boutique in Nashik",
      seoDescription: "A student story from our Nashik centre: how a six-month tailoring course, a costing notebook and one borrowed machine turned into a four-person boutique.",
      tags: ["student stories", "entrepreneurship", "tailoring"],
      status: "PUBLISHED",
      publishedAt: daysFromNow(-15),
      content: [
        "## She came for a job, not a business",
        "When Sunita enrolled at our Nashik centre she wanted one thing: a supervisor's job at a garment unit on the highway. She had sewn at home for nine years and assumed the course would simply certify what she already knew. The first month proved otherwise, and not in the way she expected.",
        "## The skill she was missing was arithmetic",
        "Her stitching was better than most of the batch. What she had never done was cost a garment. Fabric at the running metre, lining, thread, buttons, the electricity the machine draws, and — the line almost everybody forgets — her own hours. Until a student writes those down, every order feels profitable and none of them are.",
        "### What the costing notebook changed",
        "By week six she was quoting from a notebook instead of from instinct. Three of her regular customers paid the higher, honest price without argument. One walked away. That ratio was the whole lesson: she had been subsidising her own work for nine years and had never seen it written down.",
        "## The first four months after the course",
        "She did not take the factory job. She took two alteration contracts from a local boutique, worked from her mother-in-law's front room on a borrowed machine, and bought her own machine in the fourth month out of retained earnings rather than a loan. Our centre coordinator helped her open a current account and register on the district's Udyam portal — exactly the online-form skill from the digital literacy module, applied for real.",
        "### Hiring, carefully",
        "The first woman she hired was a neighbour who had dropped out of the same course to care for a parent. The second and third came from the batch that followed hers. Sunita pays per piece, which she learned to calculate in the same costing class, and she keeps the rates on a board on the wall so nobody has to ask.",
        "## What we took from it",
        "Every trade course at EduSkill now carries a costing and pricing unit, not as an optional entrepreneurship add-on at the end but inside the trade module where the students are already holding the fabric. Sunita teaches that unit as a guest for the Nashik batches, two evenings per intake.",
        "_This is a demo article. Edit or delete it from Admin → CMS → Blog._",
      ].join("\n\n"),
    },
    {
      title: "Five New Training Centres Open Across Bihar and Jharkhand",
      slug: "five-new-centres-bihar-jharkhand",
      category: "Centre Updates",
      author: "EduSkill Team",
      excerpt: "Muzaffarpur, Gaya, Bhagalpur, Ranchi and Dhanbad now have EduSkill centres, adding 600 seats per intake.",
      seoTitle: "Five New EduSkill Training Centres in Bihar and Jharkhand",
      seoDescription: "EduSkill India Foundation has opened training centres in Muzaffarpur, Gaya, Bhagalpur, Ranchi and Dhanbad, adding 600 seats per intake.",
      tags: ["centres", "expansion"],
      status: "PUBLISHED",
      publishedAt: daysFromNow(-3),
      isFeatured: true,
      content: [
        "## Where the new centres are",
        "Five centres opened this quarter: Muzaffarpur, Gaya and Bhagalpur in Bihar, and Ranchi and Dhanbad in Jharkhand. Together they add roughly 600 seats per intake across digital literacy, computer applications, tailoring and electrical trades.",
        "## Why these districts",
        "Each location was chosen from block-level enquiry data rather than convenience. All five districts had sent us more than a hundred enquiries in the preceding year with no centre within reasonable travelling distance, which is the clearest signal we have that demand already exists.",
        "## Admissions",
        "Counselling has begun at all five. Walk in with an Aadhaar card, a passport photograph and your last mark sheet, or start the application online and finish the document upload at the centre.",
        "_This is a demo article. Edit or delete it from Admin → CMS → Blog._",
      ].join("\n\n"),
    },
    {
      title: "What the 2026 Skills Report Means for Rural Training",
      slug: "2026-skills-report-rural-training",
      category: "Foundation News",
      author: "Ananya Deshmukh",
      excerpt: "Our reading of the year's skills report, and the three changes we are making to the rural curriculum because of it.",
      seoTitle: "The 2026 Skills Report and Rural Vocational Training",
      seoDescription: "What the 2026 skills report says about rural employability, and the three curriculum changes EduSkill India Foundation is making in response.",
      tags: ["policy", "research"],
      // Scheduled: PUBLISHED with a future date. This row must stay invisible on
      // /blog, the archives, the sitemap and the feed until the date passes.
      status: "PUBLISHED",
      publishedAt: daysFromNow(3),
      content: [
        "## The headline finding",
        "The report's central claim is that rural placement rates track trainer retention far more closely than they track infrastructure spend. That matches what our own centre data has been saying for three years.",
        "## What we are changing",
        "Three things: a longer paid induction for new trainers, a shift of the costing unit into every trade module, and quarterly refreshers run by trainers rather than by external consultants.",
        "_This is a demo article, scheduled for a future date so you can confirm it does not appear on the public site yet._",
      ].join("\n\n"),
    },
    {
      title: "A Practical Guide to Choosing Your First Skill Course",
      slug: "choosing-your-first-skill-course",
      category: "Skill Development",
      author: "EduSkill Team",
      excerpt: "Four questions to answer before you enrol anywhere — including with us.",
      seoTitle: "How to Choose Your First Skill Development Course",
      seoDescription: "Four questions to answer before enrolling in any vocational course: travel time, entry requirements, what the certificate is worth, and who is hiring nearby.",
      tags: ["career guidance", "digital literacy"],
      status: "DRAFT",
      publishedAt: null,
      content: [
        "## Start with the commute, not the course",
        "A course you cannot reach six days a week is the wrong course, however good it looks in the brochure. Work out the travel first and choose from what is left.",
        "## Then check the entry requirement honestly",
        "If a course expects Class 10 mathematics and you left school in Class 8, ask the centre what bridging support exists before you enrol, not in week three.",
        "_This is a demo draft. It must never appear on the public site._",
      ].join("\n\n"),
    },
    {
      title: "Highlights from the 2024 Annual Skill Mela",
      slug: "highlights-2024-annual-skill-mela",
      category: "Foundation News",
      author: "EduSkill Team",
      excerpt: "Two days, eleven centres and 1,400 visitors. An archive of our 2024 open house.",
      seoTitle: "2024 Annual Skill Mela — Highlights",
      seoDescription: "An archived report from the 2024 EduSkill Annual Skill Mela: eleven participating centres, 1,400 visitors and on-the-spot counselling.",
      tags: ["events"],
      status: "ARCHIVED",
      publishedAt: daysFromNow(-400),
      content: [
        "## What happened",
        "Eleven centres opened their labs for two days of demonstrations, counselling and on-the-spot registration. Around 1,400 visitors came through.",
        "_This is a demo archived post, kept to show how an archived article behaves in the admin list._",
      ].join("\n\n"),
    },
  ];

  for (const p of demoPosts) {
    await db.blog.create({
      data: {
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        content: p.content,
        // coverImage stays null so the deterministic branded placeholder is exercised.
        authorName: p.author,
        authorId: blogAuthorIds.get(p.author)!,
        categoryId: blogCategoryIds.get(p.category)!,
        tags: p.tags,
        status: p.status,
        publishedAt: p.publishedAt,
        isFeatured: p.isFeatured ?? false,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        ...readingStats(p.content),
        createdById: superAdminId,
      },
    });
  }

  // The tag lookup mirrors the labels stored in Blog.tags. postCount counts LIVE
  // posts only — published AND past its date — so the scheduled, draft and archived
  // demo rows contribute nothing, which is what the public tag cloud must show.
  const tagPostCounts = new Map<string, number>();
  for (const p of demoPosts) {
    const isLive = p.status === "PUBLISHED" && p.publishedAt !== null && p.publishedAt.getTime() <= Date.now();
    for (const tag of p.tags) tagPostCounts.set(tag, (tagPostCounts.get(tag) ?? 0) + (isLive ? 1 : 0));
  }
  await db.blogTag.createMany({
    data: [...tagPostCounts].map(([name, postCount]) => ({ name, slug: slugify(name), postCount })),
  });

  await db.event.create({
    data: { title: "Skill Mela – Open House (Demo)", slug: "skill-mela-open-house-demo", summary: "Meet trainers, see the labs and register on the spot.", content: "Visit the EduSkill Kolkata Skill Center for a day of demos, counselling and instant registration. _Demo event – edit from Admin → CMS → Events._", startAt: daysFromNow(21), endAt: daysFromNow(21), location: "EduSkill Kolkata Skill Center", status: "PUBLISHED" },
  });

  // Enquiry & support ticket
  await db.enquiry.create({ data: { name: "Ravi Prakash", email: "ravi.enquiry@demo.eduskill.local", mobile: "9850000001", subject: "Course availability in Varanasi", message: "Do you have a training center in Varanasi for computer courses?", type: "ADMISSION" } });

  log("demo stories, blog, event and enquiry");
  log(`demo credentials → password for all demo accounts: ${DEMO_PASSWORD}`);
}

async function main() {
  await seedPermissionsAndRoles();
  const admin = await seedSuperAdmin();
  await seedLocations();
  await seedPlatformContent();
  if (SEED_DEMO) {
    await seedDemoBlocks();
    await seedDemo(admin.id);
  } else {
    log("demo data skipped (SEED_DEMO=false)");
  }

  // Project EduSkill Shiksha Mission is the live catalogue — real programme data, so it is
  // seeded in production too. It runs after the demo block so that the four classes and their
  // batches are attached to every centre that exists by now.
  try {
    const { applyShikshaMission } = await import("../scripts/apply-shiksha-mission");
    const r = await applyShikshaMission({ quiet: true });
    log(`Shiksha Mission catalogue ready (${r.courses} classes, ${r.centersLinked} centres, ${r.batches} batches)`);
  } catch (err) {
    log(`Shiksha Mission catalogue skipped: ${err instanceof Error ? err.message : String(err)} (run "npm run content:shiksha" later)`);
  }

  if (SEED_DEMO) {
    // Generates the branded cover art and the sample document files the demo rows point at,
    // so no demo screen ever shows a missing image or a broken "view document" link.
    // Imported lazily: it pulls in sharp/pdf-lib, which production seeding does not need.
    try {
      const { generateDemoMedia } = await import("../scripts/generate-demo-media");
      const count = await generateDemoMedia({ quiet: true });
      log(`demo media (${count} files) ready`);
    } catch (err) {
      log(`demo media skipped: ${err instanceof Error ? err.message : String(err)} (run "npm run media:demo" later)`);
    }
  }
  log("done");
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
