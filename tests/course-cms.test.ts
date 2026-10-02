import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  CUSTOM_FALLBACK_LABEL,
  FREE_LABEL,
  feePeriodOf,
  feePlanFromCourse,
  formatCourseFee,
  formatFeeAmount,
  isOfferEffective,
  pickEffectiveOffer,
} from "@/lib/course-pricing";
import {
  activeOfferWhere,
  createCourseFaq,
  createCourseMedia,
  createCourseNode,
  createCourseOffer,
  deleteCourseNode,
  getCourseCmsBundle,
  getCoursePageData,
  getEffectiveOffer,
  listCourseFaqs,
  listCourseMedia,
  listCourseNodes,
  reorderCourseFaqs,
  reorderCourseMedia,
  reorderCourseNodes,
  upsertCourseFeePlan,
} from "@/server/course-cms";
import { ensureAdmin, makeCourse } from "./helpers";

// ───────────────────────────── The one fee formatter ─────────────────────────────

describe("formatCourseFee", () => {
  it("renders a no-fee course without the word free", () => {
    const d = formatCourseFee({ feeType: "FREE", baseFee: 0 });
    expect(FREE_LABEL).toBe("No fee");
    expect(d.text).toBe(FREE_LABEL);
    expect(d.priceText).toBe(FREE_LABEL);
    expect(d.isFree).toBe(true);
    expect(d.paymentRequired).toBe(false);
    expect(d.amount).toBe(0);
    expect(d.originalAmount).toBeNull();
  });

  it("renders a one-time fee", () => {
    const d = formatCourseFee({ feeType: "ONE_TIME", baseFee: 999 });
    expect(d.text).toBe("₹999 One Time");
    expect(d.priceText).toBe("₹999");
    expect(d.suffix).toBe("One Time");
    expect(d.amount).toBe(999);
    expect(d.isFree).toBe(false);
  });

  it("renders a monthly fee", () => {
    const d = formatCourseFee({ feeType: "MONTHLY", baseFee: 499 });
    expect(d.text).toBe("₹499 / Month");
    expect(d.priceText).toBe("₹499");
    expect(d.suffix).toBe("/ Month");
  });

  it("renders a custom fee as its label, and falls back when the label is blank", () => {
    const d = formatCourseFee({ feeType: "CUSTOM", baseFee: 0, customLabel: "Fee decided per batch" });
    expect(d.text).toBe("Fee decided per batch");
    expect(d.amount).toBeNull();
    expect(d.suffix).toBeNull();
    expect(formatCourseFee({ feeType: "CUSTOM", baseFee: 0 }).text).toBe(CUSTOM_FALLBACK_LABEL);
  });

  it("renders a discounted fee as original -> discounted", () => {
    const d = formatCourseFee({ feeType: "ONE_TIME", baseFee: 1999, discountedFee: 999 });
    expect(d.priceText).toBe("₹1,999 → ₹999");
    expect(d.text).toBe("₹1,999 → ₹999 One Time");
    expect(d.amount).toBe(999);
    expect(d.originalAmount).toBe(1999);
    expect(d.discountPercent).toBe(50);
  });

  it("lets a live offer beat the plan's own discount and ignores a discount above the base fee", () => {
    const plan = { feeType: "ONE_TIME" as const, baseFee: 2000, discountedFee: 1500 };
    expect(formatCourseFee(plan, { offerPrice: 1000 }).amount).toBe(1000);
    // A percentage-only offer derives the price from the base fee.
    expect(formatCourseFee({ feeType: "ONE_TIME", baseFee: 2000 }, { discountPercent: 25 }).amount).toBe(1500);
    // Bad data (a "discount" above the base) degrades to the plain base price, never a markup.
    expect(formatCourseFee({ feeType: "ONE_TIME", baseFee: 500, discountedFee: 900 }).priceText).toBe("₹500");
  });

  it("treats a zero effective amount as no fee and derives a plan from a legacy course", () => {
    expect(formatCourseFee({ feeType: "ONE_TIME", baseFee: 1200, discountedFee: 0 }).text).toBe(FREE_LABEL);
    expect(formatCourseFee(feePlanFromCourse({ courseFee: 3500, registrationFee: 100 })).text).toBe("₹3,500 One Time");
    expect(formatCourseFee(feePlanFromCourse({ courseFee: 3500, registrationFee: 100 })).enrolmentFee).toBe(100);
    expect(formatCourseFee(feePlanFromCourse({ courseFee: 0 })).text).toBe(FREE_LABEL);
    // No plan at all still produces a renderable result rather than throwing.
    expect(formatCourseFee(null).text).toBe(FREE_LABEL);
  });
});

describe("fee period", () => {
  it("is monthly only for a live MONTHLY plan", () => {
    expect(feePeriodOf({ feeType: "MONTHLY" })).toBe("month");
    expect(feePeriodOf({ feeType: "MONTHLY", deletedAt: new Date() })).toBeNull();
    expect(feePeriodOf({ feeType: "ONE_TIME" })).toBeNull();
    expect(feePeriodOf(null)).toBeNull();
  });

  it("formats the amount with its period", () => {
    expect(formatFeeAmount(50, "month")).toBe("₹50 / month");
    expect(formatFeeAmount(2500, null)).toBe("₹2,500");
    expect(formatFeeAmount(0, "month")).toBe(FREE_LABEL);
  });
});

// ───────────────────────────── Offer windows ─────────────────────────────

describe("effective offer date logic", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");
  const base = { isActive: true, startsAt: new Date("2026-06-10T00:00:00.000Z"), endsAt: new Date("2026-06-20T00:00:00.000Z") };

  it("is not effective before it starts", () => {
    expect(isOfferEffective(base, new Date("2026-06-09T23:59:59.000Z"))).toBe(false);
  });

  it("is effective inside the window, including both bounds", () => {
    expect(isOfferEffective(base, now)).toBe(true);
    expect(isOfferEffective(base, base.startsAt)).toBe(true);
    expect(isOfferEffective(base, base.endsAt)).toBe(true);
  });

  it("is not effective after it ends", () => {
    expect(isOfferEffective(base, new Date("2026-06-20T00:00:01.000Z"))).toBe(false);
  });

  it("is not effective when inactive or soft-deleted, whatever the dates say", () => {
    expect(isOfferEffective({ ...base, isActive: false }, now)).toBe(false);
    expect(isOfferEffective({ ...base, deletedAt: new Date("2026-06-11T00:00:00.000Z") }, now)).toBe(false);
  });

  it("treats null bounds as unbounded", () => {
    expect(isOfferEffective({ isActive: true, startsAt: null, endsAt: null }, now)).toBe(true);
    expect(isOfferEffective({ isActive: true, startsAt: null, endsAt: new Date("2026-06-01T00:00:00.000Z") }, now)).toBe(false);
    expect(isOfferEffective({ isActive: true, startsAt: new Date("2026-12-01T00:00:00.000Z"), endsAt: null }, now)).toBe(false);
  });

  it("picks the lowest sortOrder among the live offers", () => {
    const offers = [
      { id: "expired", ...base, endsAt: new Date("2026-06-11T00:00:00.000Z"), sortOrder: 1 },
      { id: "second", ...base, sortOrder: 3 },
      { id: "first", ...base, sortOrder: 2 },
    ];
    expect(pickEffectiveOffer(offers, now)?.id).toBe("first");
    expect(pickEffectiveOffer([offers[0]], now)).toBeNull();
  });

  it("builds a SQL window that bounds both dates and excludes soft-deleted rows", () => {
    const w = activeOfferWhere(now);
    expect(w.deletedAt).toBeNull();
    expect(w.isActive).toBe(true);
    expect(Array.isArray(w.AND) ? w.AND.length : 0).toBe(2);
  });
});

// ───────────────────────────── DB-backed services ─────────────────────────────

describe("course CMS services", () => {
  it("stores a recursive curriculum, reorders one level in a single transaction and soft-deletes subtrees", async () => {
    const admin = await ensureAdmin();
    const ctx = { user: admin };
    const course = await makeCourse();

    const m1 = await createCourseNode(course.id, { kind: "MODULE", title: "Module One", isFreePreview: false, isActive: true }, ctx);
    const m2 = await createCourseNode(course.id, { kind: "MODULE", title: "Module Two", isFreePreview: false, isActive: true }, ctx);
    const m3 = await createCourseNode(course.id, { kind: "MODULE", title: "Module Three", isFreePreview: false, isActive: true }, ctx);
    expect([m1.sortOrder, m2.sortOrder, m3.sortOrder]).toEqual([1, 2, 3]);

    const chapter = await createCourseNode(course.id, { parentId: m1.id, kind: "CHAPTER", title: "Chapter A", isFreePreview: false, isActive: true }, ctx);
    const topic = await createCourseNode(course.id, { parentId: chapter.id, kind: "TOPIC", title: "Topic A1", isFreePreview: false, isActive: true }, ctx);
    const lesson = await createCourseNode(
      course.id,
      { parentId: topic.id, kind: "LESSON", title: "Lesson A1a", videoUrl: "/api/files/public/courses/intro.mp4", durationMinutes: 12, isFreePreview: true, isActive: true },
      ctx
    );
    expect(lesson.videoUrl).toBe("/api/files/public/courses/intro.mp4");
    expect(lesson.isFreePreview).toBe(true);

    // Hierarchy guards: nothing may sit inside a lesson, and a module may not sit inside a topic.
    await expect(createCourseNode(course.id, { parentId: lesson.id, kind: "TOPIC", title: "Nope", isFreePreview: false, isActive: true }, ctx)).rejects.toThrow();
    await expect(createCourseNode(course.id, { parentId: topic.id, kind: "MODULE", title: "Nope", isFreePreview: false, isActive: true }, ctx)).rejects.toThrow();

    // Reorder must receive the complete set for that level.
    await expect(reorderCourseNodes(course.id, null, [m3.id, m1.id], ctx)).rejects.toThrow();
    await expect(reorderCourseNodes(course.id, null, [m3.id, m3.id, m1.id], ctx)).rejects.toThrow();
    await reorderCourseNodes(course.id, null, [m3.id, m1.id, m2.id], ctx);
    const roots = (await listCourseNodes(course.id)).filter((n) => n.parentId === null);
    expect(roots.map((n) => n.id)).toEqual([m3.id, m1.id, m2.id]);
    expect(roots.map((n) => n.sortOrder)).toEqual([1, 2, 3]);

    // Deleting the module soft-deletes chapter, topic and lesson with it.
    const { removed } = await deleteCourseNode(m1.id, ctx);
    expect(removed).toBe(4);
    const left = await listCourseNodes(course.id);
    expect(left.map((n) => n.id).sort()).toEqual([m2.id, m3.id].sort());
    expect(await db.courseNode.count({ where: { courseId: course.id, deletedAt: { not: null } } })).toBe(4);
  });

  it("keeps the fee plan separate from the transactional fees and formats it the same way everywhere", async () => {
    const admin = await ensureAdmin();
    const ctx = { user: admin };
    const course = await makeCourse({ courseFee: 2000, registrationFee: 100 });

    // No plan yet: the site falls back to the course's own fee. Nothing was backfilled.
    const before = await getCoursePageData(course.slug);
    expect(before).not.toBeNull();
    expect(before!.feePlan).toBeNull();
    expect(before!.fee.text).toBe("₹2,000 One Time");

    const plan = await upsertCourseFeePlan(course.id, { feeType: "MONTHLY", currency: "INR", baseFee: 499, enrolmentFee: 250, paymentRequired: true }, ctx);
    expect(plan.baseFee).toBe(499);
    expect(typeof plan.baseFee).toBe("number");

    const after = await getCoursePageData(course.slug);
    expect(after!.fee.text).toBe("₹499 / Month");
    // The transactional fees the apply wizard, payments and admissions read are untouched.
    const row = await db.course.findUniqueOrThrow({ where: { id: course.id }, select: { courseFee: true, registrationFee: true } });
    expect(Number(row.courseFee)).toBe(2000);
    expect(Number(row.registrationFee)).toBe(100);
    expect(after!.course.courseFee).toBe(2000);

    // The admin preview runs through the same formatter, so it cannot drift from the site.
    const bundle = await getCourseCmsBundle(course.id);
    expect(bundle.feePreview.text).toBe(after!.fee.text);
  });

  it("stops showing an expired offer at query time, with no cron and no flag to flip", async () => {
    const admin = await ensureAdmin();
    const ctx = { user: admin };
    const course = await makeCourse({ courseFee: 1999 });
    await upsertCourseFeePlan(course.id, { feeType: "ONE_TIME", currency: "INR", baseFee: 1999, enrolmentFee: 0, paymentRequired: true }, ctx);

    const past = new Date(Date.now() - 30 * 86_400_000);
    const recentlyEnded = new Date(Date.now() - 86_400_000);
    const future = new Date(Date.now() + 30 * 86_400_000);

    await createCourseOffer(course.id, { title: "Expired sale", offerPrice: 499, startsAt: past, endsAt: recentlyEnded, isActive: true }, ctx);
    const live = await createCourseOffer(course.id, { title: "Festive offer", offerPrice: 999, couponCode: "FEST", startsAt: past, endsAt: future, isActive: true }, ctx);
    await createCourseOffer(course.id, { title: "Next month", offerPrice: 299, startsAt: future, endsAt: null, isActive: true }, ctx);

    const effective = await getEffectiveOffer(course.id);
    expect(effective?.id).toBe(live.id);
    expect(effective?.offerPrice).toBe(999);
    expect(effective?.couponCode).toBe("FEST");

    const page = await getCoursePageData(course.slug);
    expect(page!.offer?.id).toBe(live.id);
    expect(page!.fee.priceText).toBe("₹1,999 → ₹999");

    // A moment after the festive offer ends, the scheduled one takes over by itself: no cron run,
    // no row was touched, the dates alone decided it.
    const later = new Date(future.getTime() + 1000);
    expect((await getEffectiveOffer(course.id, later))?.title).toBe("Next month");
    expect((await getCoursePageData(course.slug, { now: later }))!.fee.priceText).toBe("₹1,999 → ₹299");

    // A course whose only offer has expired shows no offer and the plain price again.
    const solo = await makeCourse({ courseFee: 1999 });
    await upsertCourseFeePlan(solo.id, { feeType: "ONE_TIME", currency: "INR", baseFee: 1999, enrolmentFee: 0, paymentRequired: true }, ctx);
    await createCourseOffer(solo.id, { title: "One week only", offerPrice: 499, startsAt: past, endsAt: recentlyEnded, isActive: true }, ctx);
    expect(await getEffectiveOffer(solo.id)).toBeNull();
    const soloPage = await getCoursePageData(solo.slug);
    expect(soloPage!.offer).toBeNull();
    expect(soloPage!.fee.priceText).toBe("₹1,999");
    // …yet it was live while its window was open, and it is still there for the admin to see.
    expect((await getEffectiveOffer(solo.id, new Date(recentlyEnded.getTime() - 1000)))?.title).toBe("One week only");
    expect(await db.courseOffer.count({ where: { courseId: solo.id, deletedAt: null, isActive: true } })).toBe(1);
  });

  it("keeps per-course FAQs and media out of the site-wide tables and reorders each set", async () => {
    const admin = await ensureAdmin();
    const ctx = { user: admin };
    const course = await makeCourse();
    const siteFaqsBefore = await db.faq.count();

    const q1 = await createCourseFaq(course.id, { question: "Is a laptop required?", answer: "No, the centre provides one.", isActive: true }, ctx);
    const q2 = await createCourseFaq(course.id, { question: "Is there a placement?", answer: "Placement support is included.", isActive: true }, ctx);
    await reorderCourseFaqs(course.id, [q2.id, q1.id], ctx);
    expect((await listCourseFaqs(course.id)).map((f) => f.id)).toEqual([q2.id, q1.id]);
    expect(await db.faq.count()).toBe(siteFaqsBefore); // the site-wide FAQ table was not repurposed

    const g1 = await createCourseMedia(course.id, { kind: "GALLERY", url: "/api/files/public/courses/g1.jpg", alt: "Lab", isActive: true }, ctx);
    const g2 = await createCourseMedia(course.id, { kind: "GALLERY", url: "/api/files/public/courses/g2.jpg", alt: "Class", isActive: true }, ctx);
    const p1 = await createCourseMedia(course.id, { kind: "PROMOTIONAL", url: "/api/files/public/courses/p1.jpg", isActive: true }, ctx);
    await reorderCourseMedia(course.id, "GALLERY", [g2.id, g1.id], ctx);
    expect((await listCourseMedia(course.id, { kind: "GALLERY" })).map((m) => m.id)).toEqual([g2.id, g1.id]);
    // Reordering the gallery left the promotional set alone.
    expect((await listCourseMedia(course.id, { kind: "PROMOTIONAL" })).map((m) => m.sortOrder)).toEqual([1]);

    const page = await getCoursePageData(course.slug);
    expect(page!.faqs.map((f) => f.id)).toEqual([q2.id, q1.id]);
    expect(page!.gallery.map((m) => m.id)).toEqual([g2.id, g1.id]);
    expect(page!.promotional.map((m) => m.id)).toEqual([p1.id]);
  });

  it("assembles the whole public page in one call and writes an audit trail", async () => {
    const admin = await ensureAdmin();
    const ctx = { user: admin };
    const course = await makeCourse({ courseFee: 1500, registrationFee: 50 });
    await createCourseNode(course.id, { kind: "MODULE", title: "Foundations", isFreePreview: false, isActive: true }, ctx);
    await createCourseNode(course.id, { kind: "MODULE", title: "Hidden draft", isFreePreview: false, isActive: false }, ctx);

    const page = await getCoursePageData(course.slug);
    expect(page!.course.slug).toBe(course.slug);
    expect(page!.curriculum.map((n) => n.title)).toEqual(["Foundations"]); // inactive rows never reach the site
    expect(page!.course.totalFee).toBe(1550);
    expect(JSON.parse(JSON.stringify(page))).toBeTruthy(); // fully serialisable: no Decimals leak out

    const logs = await db.auditLog.count({ where: { module: "courses", recordType: "CourseNode" } });
    expect(logs).toBeGreaterThanOrEqual(2);
  });
});
