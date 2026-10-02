/**
 * Moves an existing database onto the Foundation's course fees and removes the "free" / "no fee"
 * claims the database itself holds (October 2026). The code-side defaults were changed in the same
 * releases; this script is the matching data change for a database that was seeded before them.
 *
 *  1. Monthly courses (Class 5 and above, EXAM-PREP) — every course in MONTHLY_COURSE_FEES that
 *     still has a ZERO course fee gets its monthly fee and a MONTHLY fee plan with the same amount,
 *     so the site prints "₹100 / month". A course the Foundation has already priced keeps its fee
 *     and its saved plan (it only gets a MONTHLY plan at its current fee when it has no plan).
 *  1b. Registration-only courses (Class 1–4) — courseFee 0 and the registration fee from
 *     REGISTRATION_ONLY_FEES, with no monthly plan. Moved there from an unpriced course or from the
 *     earlier "₹50 a month" state this script itself produced; any other fee is left alone and named.
 *  2. Course descriptions — the old "…and there is no course fee." sentence is replaced.
 *  3. Homepage CMS sections saved from Admin → CMS — the default free / no-fee lines are replaced
 *     wherever they still read word for word as shipped. Anything the Foundation wrote itself is
 *     never rewritten; if it still mentions "free" the script names the section so it can be
 *     edited by hand.
 *  4. The "Are the courses free?" FAQ — and the fees FAQ as an earlier run wrote it — is rewritten
 *     to state the current fees.
 *
 * Every change is written to the audit log as a System action. Idempotent: a second run finds
 * nothing to change.
 *
 *   npx tsx scripts/apply-monthly-fees.ts            # apply
 *   npx tsx scripts/apply-monthly-fees.ts --dry-run  # only report what would change
 *   npm run content:fees
 */
import "dotenv/config";
import path from "node:path";
import { db, type Prisma } from "../src/lib/db";
import { audit } from "../src/lib/audit";
import { formatINR } from "../src/lib/utils";
import { MONTHLY_COURSE_FEES, REGISTRATION_ONLY_FEES } from "../prisma/seed-data/course-fees";
import { FAQS } from "../prisma/seed-data/content";

const HOME_FEES_TEXT =
  "Fees stay low for every class: only a ₹50 registration fee for Class 1 to 4, and small monthly fees from Class 5. Need-based and merit scholarships reduce the payable fee further, and installments are available.";

/**
 * Exact shipped strings → their replacement, matched against whole string values only. Each line
 * maps both the original default and the wording an earlier release of this script wrote.
 */
const CMS_REPLACEMENTS: Readonly<Record<string, string>> = {
  // home.hero — the first slide has no emphasis line at all; an empty string renders nothing.
  "Every class is free — no course fee, no exam fee, no certificate fee.": "",
  "Monthly fee: Class 1–4 ₹50 · Class 5–10 ₹100 · Class 11–12 & Competitive ₹300": "",
  "No fees": "Low fees",
  "Low monthly fee": "Low fees",
  "Registration, training and certification at no cost": "Only a ₹50 registration fee for Class 1 to 4",
  "From ₹50 a month for Class 1 to 4": "Only a ₹50 registration fee for Class 1 to 4",
  "No fee to study": "₹50 registration fee",
  "Fees from ₹50/month": "₹50 registration fee",
  // home.about
  "Low-cost and free courses designed for first-generation learners.": "Low-cost courses designed for first-generation learners.",
  // home.fees
  "Most EduSkill courses are free or heavily subsidised. Need-based and merit scholarships reduce the payable fee further, and installments are available for paid courses.": HOME_FEES_TEXT,
  "Monthly fees start at just ₹50 and stay low for every class. Need-based and merit scholarships reduce the payable fee further, and installments are available.": HOME_FEES_TEXT,
  // home.why
  "Free and low-cost courses for every background.": "Low fees for learners of every background.",
  "Low monthly fees for learners of every background.": "Low fees for learners of every background.",
};

const OLD_DESCRIPTION_SENTENCE = "Classes are held at the EduSkill training centre offering the course, and there is no course fee.";
const NEW_DESCRIPTION_SENTENCE = "Classes are held at the EduSkill training centre offering the course, for the monthly fee shown on this page.";

const OLD_FAQ_QUESTION = "Are the courses free?";
/** The fees FAQ answer an earlier release wrote ("…₹50 for Class 1–4…" a month), rewritten too. */
const EARLIER_FAQ_ANSWER =
  "Fees are charged every month: ₹50 for Class 1–4, ₹100 for Class 5–10, and ₹300 for Class 11–12 and competitive exam training. The first month's fee is paid at admission, after your application is approved. Each course page shows its fee, and scholarship support is available on courses that offer it.";

/** Words that must not survive in public copy. Used only to REPORT leftovers, never to rewrite. */
const FREE_CLAIM = /\bfree\b|no fee to study|at no cost|no course fee|free of (cost|charge)|निःशुल्क|नि:शुल्क|निशुल्क|मुफ़्त|मुफ्त/i;

/** Replaces whole string values found in CMS_REPLACEMENTS, anywhere in a JSON value. */
function replaceStrings(value: unknown): { value: unknown; changed: number } {
  if (typeof value === "string") {
    const next = CMS_REPLACEMENTS[value];
    return next === undefined ? { value, changed: 0 } : { value: next, changed: 1 };
  }
  if (Array.isArray(value)) {
    let changed = 0;
    const out = value.map((v) => {
      const r = replaceStrings(v);
      changed += r.changed;
      return r.value;
    });
    return { value: out, changed };
  }
  if (value && typeof value === "object") {
    let changed = 0;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const r = replaceStrings(v);
      changed += r.changed;
      out[k] = r.value;
    }
    return { value: out, changed };
  }
  return { value, changed: 0 };
}

/** Every string value in a JSON value that still makes a free claim, with its path. */
function findFreeClaims(value: unknown, at = ""): string[] {
  if (typeof value === "string") return FREE_CLAIM.test(value) ? [`${at || "(root)"}: "${value}"`] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findFreeClaims(v, `${at}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => findFreeClaims(v, at ? `${at}.${k}` : k));
  return [];
}

export interface ApplyMonthlyFeesOptions {
  dryRun?: boolean;
  quiet?: boolean;
}

export interface ApplyMonthlyFeesResult {
  feesSet: number;
  plansCreated: number;
  /** Class 1–4 moved to (or given) their registration-only fee. */
  registrationSet: number;
  /** MONTHLY plans withdrawn from registration-only courses. */
  plansRemoved: number;
  descriptions: number;
  sections: number;
  faqs: number;
  /** Section keys that still mention "free" in text this script does not own. */
  leftovers: string[];
}

export async function applyMonthlyFees(opts: ApplyMonthlyFeesOptions = {}): Promise<ApplyMonthlyFeesResult> {
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };
  const dry = !!opts.dryRun;
  const result: ApplyMonthlyFeesResult = { feesSet: 0, plansCreated: 0, registrationSet: 0, plansRemoved: 0, descriptions: 0, sections: 0, faqs: 0, leftovers: [] };

  // 1 + 2. Courses: fee, fee plan, description
  const codes = Object.keys(MONTHLY_COURSE_FEES);
  const courses = await db.course.findMany({
    where: { code: { in: codes }, deletedAt: null },
    select: { id: true, code: true, name: true, courseFee: true, description: true, feePlan: { select: { id: true, feeType: true, baseFee: true, deletedAt: true } } },
    orderBy: { code: "asc" },
  });
  const missing = codes.filter((c) => !courses.some((row) => row.code === c));
  if (missing.length) log(`not in this database (skipped): ${missing.join(", ")}`);

  for (const course of courses) {
    const fee = MONTHLY_COURSE_FEES[course.code]!;
    const current = Number(course.courseFee);

    if (current === 0) {
      log(`fee      ${course.code.padEnd(9)} ${formatINR(0)} → ${formatINR(fee)} / month`);
      if (!dry) {
        await db.course.update({ where: { id: course.id }, data: { courseFee: fee } });
        await audit({ action: "update", module: "courses", recordType: "Course", recordId: course.id, description: `System set the monthly course fee of ${course.code} to ${formatINR(fee)}`, oldValue: { courseFee: current }, newValue: { courseFee: fee } });
      }
      result.feesSet++;
    } else if (current !== fee) {
      log(`fee      ${course.code.padEnd(9)} already ${formatINR(current)} — left as the Foundation set it`);
    }

    // The plan only labels the fee; it must mirror what the course actually bills. A course this run
    // prices (it was at zero) gets a MONTHLY plan at that fee even if a plan already existed — a plan
    // on an unpriced course cannot describe a fee that never existed. A course the Foundation had
    // already priced keeps its plan; it only gets a MONTHLY one when it has none at all.
    const livePlan = course.feePlan && !course.feePlan.deletedAt ? course.feePlan : null;
    const baseFee = current === 0 ? fee : current;
    const planMatches = !!livePlan && livePlan.feeType === "MONTHLY" && Number(livePlan.baseFee) === baseFee;
    if (!planMatches && (current === 0 || !livePlan)) {
      const was = livePlan ? `${livePlan.feeType} ${formatINR(Number(livePlan.baseFee))}` : course.feePlan ? "a deleted plan" : "no plan";
      log(`plan     ${course.code.padEnd(9)} MONTHLY ${formatINR(baseFee)} (was ${was})`);
      if (!dry) {
        const data = { feeType: "MONTHLY" as const, baseFee, discountedFee: null, offerPrice: null, enrolmentFee: 0, paymentRequired: true, customLabel: null, note: null, deletedAt: null };
        const plan = await db.courseFeePlan.upsert({ where: { courseId: course.id }, create: { courseId: course.id, ...data }, update: data });
        await audit({ action: "update", module: "courses", recordType: "CourseFeePlan", recordId: plan.id, description: `System set a monthly fee plan of ${formatINR(baseFee)} on ${course.code}`, oldValue: livePlan ? { feeType: livePlan.feeType, baseFee: Number(livePlan.baseFee) } : undefined, newValue: { feeType: "MONTHLY", baseFee } });
      }
      result.plansCreated++;
    }

    if (course.description?.includes(OLD_DESCRIPTION_SENTENCE)) {
      log(`text     ${course.code.padEnd(9)} description: "no course fee" sentence replaced`);
      if (!dry) {
        const description = course.description.split(OLD_DESCRIPTION_SENTENCE).join(NEW_DESCRIPTION_SENTENCE);
        await db.course.update({ where: { id: course.id }, data: { description } });
        await audit({ action: "update", module: "courses", recordType: "Course", recordId: course.id, description: `System replaced the "no course fee" sentence in the description of ${course.code}`, oldValue: { sentence: OLD_DESCRIPTION_SENTENCE }, newValue: { sentence: NEW_DESCRIPTION_SENTENCE } });
      }
      result.descriptions++;
    }
  }

  // 1b. Registration-only courses (Class 1–4): courseFee 0, registrationFee X, no monthly plan.
  const regCodes = Object.keys(REGISTRATION_ONLY_FEES);
  const regCourses = await db.course.findMany({
    where: { code: { in: regCodes }, deletedAt: null },
    select: { id: true, code: true, courseFee: true, registrationFee: true, feePlan: { select: { id: true, feeType: true, baseFee: true, deletedAt: true } } },
    orderBy: { code: "asc" },
  });
  for (const course of regCourses) {
    const fee = REGISTRATION_ONLY_FEES[course.code]!;
    const courseFee = Number(course.courseFee);
    const registrationFee = Number(course.registrationFee);
    const livePlan = course.feePlan && !course.feePlan.deletedAt ? course.feePlan : null;
    const atTarget = courseFee === 0 && registrationFee === fee;
    // Unpriced, or exactly the "₹X a month" state an earlier run of this script left behind.
    const movable = registrationFee === 0 && (courseFee === 0 || courseFee === fee);
    if (movable) {
      log(`regfee   ${course.code.padEnd(9)} course fee ${formatINR(courseFee)} → ${formatINR(0)}, registration fee → ${formatINR(fee)} (no monthly fee)`);
      if (!dry) {
        await db.course.update({ where: { id: course.id }, data: { courseFee: 0, registrationFee: fee } });
        await audit({ action: "update", module: "courses", recordType: "Course", recordId: course.id, description: `System set ${course.code} to a one-time registration fee of ${formatINR(fee)} with no monthly fee`, oldValue: { courseFee, registrationFee }, newValue: { courseFee: 0, registrationFee: fee } });
      }
      result.registrationSet++;
    } else if (!atTarget) {
      log(`regfee   ${course.code.padEnd(9)} course fee ${formatINR(courseFee)}, registration ${formatINR(registrationFee)} — left as the Foundation set it`);
    }
    // A MONTHLY plan at the registration amount is the earlier run's; withdraw it so no "/ month" shows.
    if (livePlan && livePlan.feeType === "MONTHLY" && Number(livePlan.baseFee) === fee && (movable || atTarget)) {
      log(`plan     ${course.code.padEnd(9)} MONTHLY ${formatINR(fee)} withdrawn`);
      if (!dry) {
        await db.courseFeePlan.update({ where: { id: livePlan.id }, data: { deletedAt: new Date() } });
        await audit({ action: "delete", module: "courses", recordType: "CourseFeePlan", recordId: livePlan.id, description: `System withdrew the monthly fee plan of ${course.code}: Class 1–4 charge only a registration fee`, oldValue: { feeType: livePlan.feeType, baseFee: Number(livePlan.baseFee) } });
      }
      result.plansRemoved++;
    }
  }

  // 3. CMS sections saved from Admin → CMS
  const sections = await db.cmsSection.findMany({ select: { id: true, key: true, data: true }, orderBy: { key: "asc" } });
  for (const section of sections) {
    const { value, changed } = replaceStrings(section.data);
    if (changed > 0) {
      log(`cms      ${section.key}: ${changed} line(s) replaced`);
      if (!dry) {
        await db.cmsSection.update({ where: { id: section.id }, data: { data: value as Prisma.InputJsonValue } });
        await audit({ action: "update", module: "cms", recordType: "CmsSection", recordId: section.id, description: `System replaced ${changed} free / no-fee line(s) in CMS section ${section.key}`, oldValue: section.data, newValue: value });
      }
      result.sections++;
    }
    const leftovers = findFreeClaims(changed > 0 ? value : section.data);
    if (leftovers.length) {
      result.leftovers.push(section.key);
      log(`!! cms   ${section.key} still mentions "free" in text this script does not own — edit it in Admin → CMS:`);
      for (const l of leftovers) log(`           ${l}`);
    }
  }

  // 4. FAQ
  const faqSeed = FAQS.find((f) => f.category === "Fees" && f.question === "What are the course fees?");
  if (!faqSeed) throw new Error("prisma/seed-data/content.ts no longer has the course-fees FAQ this script writes");
  const oldFaqs = await db.faq.findMany({
    where: { OR: [{ question: OLD_FAQ_QUESTION }, { question: faqSeed.question, answer: EARLIER_FAQ_ANSWER }] },
    select: { id: true, question: true, answer: true },
  });
  for (const faq of oldFaqs) {
    log(`faq      "${faq.question}" → "${faqSeed.question}"`);
    if (!dry) {
      await db.faq.update({ where: { id: faq.id }, data: { question: faqSeed.question, answer: faqSeed.answer } });
      await audit({ action: "update", module: "cms", recordType: "Faq", recordId: faq.id, description: `System rewrote the FAQ "${faq.question}" to state the current fees`, oldValue: faq, newValue: { question: faqSeed.question, answer: faqSeed.answer } });
    }
    result.faqs++;
  }

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "apply-monthly-fees.ts"))) {
  const dryRun = process.argv.includes("--dry-run");
  applyMonthlyFees({ dryRun })
    .then(async (r) => {
      console.log(
        `\n${dryRun ? "DRY RUN — nothing written. Would change" : "Done. Changed"}: ${r.feesSet} course fee(s), ${r.plansCreated} fee plan(s), ${r.registrationSet} registration fee(s), ${r.plansRemoved} plan(s) withdrawn, ${r.descriptions} description(s), ${r.sections} CMS section(s), ${r.faqs} FAQ(s).` +
          (r.leftovers.length ? `\nStill mentions "free" (edit by hand): ${r.leftovers.join(", ")}` : "")
      );
      await db.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await db.$disconnect();
      process.exit(1);
    });
}
