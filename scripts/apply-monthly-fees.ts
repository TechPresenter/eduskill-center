/**
 * Moves an existing database onto the Foundation's monthly course fees and removes the "free" /
 * "no fee" claims the database itself holds (October 2026). The code-side defaults were changed
 * in the same release; this script is the matching data change for a database that was seeded
 * before it.
 *
 *  1. Course fees — every course in prisma/seed-data/course-fees.ts that still has a ZERO course
 *     fee gets its monthly fee and a MONTHLY fee plan with the same amount, so the site prints
 *     "₹50 / month". A course the Foundation has already priced keeps its fee and its saved plan
 *     (it only gets a MONTHLY plan at its current fee when it has no plan at all).
 *  2. Course descriptions — the old "…and there is no course fee." sentence is replaced.
 *  3. Homepage CMS sections saved from Admin → CMS — the default free / no-fee lines are replaced
 *     wherever they still read word for word as shipped. Anything the Foundation wrote itself is
 *     never rewritten; if it still mentions "free" the script names the section so it can be
 *     edited by hand.
 *  4. The "Are the courses free?" FAQ is rewritten to state the fees.
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
import { MONTHLY_COURSE_FEES } from "../prisma/seed-data/course-fees";
import { FAQS } from "../prisma/seed-data/content";

/** Exact shipped strings → their replacement. Matched against whole string values only. */
const CMS_REPLACEMENTS: Readonly<Record<string, string>> = {
  // home.hero
  // The first slide now has no emphasis line at all; an empty string renders nothing.
  "Every class is free — no course fee, no exam fee, no certificate fee.": "",
  "No fees": "Low monthly fee",
  "Registration, training and certification at no cost": "From ₹50 a month for Class 1 to 4",
  "No fee to study": "Fees from ₹50/month",
  // home.about
  "Low-cost and free courses designed for first-generation learners.": "Low-cost courses designed for first-generation learners.",
  // home.fees
  "Most EduSkill courses are free or heavily subsidised. Need-based and merit scholarships reduce the payable fee further, and installments are available for paid courses.":
    "Monthly fees start at just ₹50 and stay low for every class. Need-based and merit scholarships reduce the payable fee further, and installments are available.",
  // home.why
  "Free and low-cost courses for every background.": "Low monthly fees for learners of every background.",
};

const OLD_DESCRIPTION_SENTENCE = "Classes are held at the EduSkill training centre offering the course, and there is no course fee.";
const NEW_DESCRIPTION_SENTENCE = "Classes are held at the EduSkill training centre offering the course, for the monthly fee shown on this page.";

const OLD_FAQ_QUESTION = "Are the courses free?";

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
  const result: ApplyMonthlyFeesResult = { feesSet: 0, plansCreated: 0, descriptions: 0, sections: 0, faqs: 0, leftovers: [] };

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
  const oldFaqs = await db.faq.findMany({ where: { question: OLD_FAQ_QUESTION }, select: { id: true, question: true, answer: true } });
  for (const faq of oldFaqs) {
    log(`faq      "${faq.question}" → "${faqSeed.question}"`);
    if (!dry) {
      await db.faq.update({ where: { id: faq.id }, data: { question: faqSeed.question, answer: faqSeed.answer } });
      await audit({ action: "update", module: "cms", recordType: "Faq", recordId: faq.id, description: `System rewrote the FAQ "${OLD_FAQ_QUESTION}" to state the monthly fees`, oldValue: faq, newValue: { question: faqSeed.question, answer: faqSeed.answer } });
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
        `\n${dryRun ? "DRY RUN — nothing written. Would change" : "Done. Changed"}: ${r.feesSet} course fee(s), ${r.plansCreated} fee plan(s), ${r.descriptions} description(s), ${r.sections} CMS section(s), ${r.faqs} FAQ(s).` +
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
