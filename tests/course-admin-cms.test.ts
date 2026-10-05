import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { courseMediaSlotsSchema, setCourseMediaSlots } from "@/server/courses";
import { OFFER_STATE_META, offerState } from "@/components/admin/courses/offer-status";
import { ensureAdmin, makeCourse } from "./helpers";

/**
 * The admin Course CMS screens. Two things are worth testing here and nothing else is: the offer
 * state the list badges are derived from, and the media-slot writer the Media tab posts to. The
 * collection services themselves are covered by tests/course-cms.test.ts.
 */

// ───────────────────────────── Offer state badges ─────────────────────────────

const window = (over: Partial<Parameters<typeof offerState>[0]> = {}) => ({ id: "a", isActive: true, startsAt: null, endsAt: null, deletedAt: null, ...over });

describe("offerState", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("marks the offer the page actually shows as live, and other in-window offers as superseded", () => {
    expect(offerState(window({ id: "a" }), "a", now)).toBe("LIVE");
    // Inside its dates, but a lower sortOrder won — so the page is not showing this one.
    expect(offerState(window({ id: "b" }), "a", now)).toBe("SUPERSEDED");
  });

  it("tells a future offer apart from a past one", () => {
    expect(offerState(window({ startsAt: new Date("2026-07-01T00:00:00Z") }), null, now)).toBe("SCHEDULED");
    expect(offerState(window({ endsAt: new Date("2026-06-01T00:00:00Z") }), null, now)).toBe("EXPIRED");
  });

  it("reports an offer switched off by hand as off, whatever its dates say", () => {
    expect(offerState(window({ isActive: false }), null, now)).toBe("INACTIVE");
    expect(offerState(window({ isActive: false, startsAt: new Date("2026-01-01T00:00:00Z"), endsAt: new Date("2026-12-31T00:00:00Z") }), null, now)).toBe("INACTIVE");
  });

  it("treats an unbounded window as live and both bounds as inclusive", () => {
    expect(offerState(window({ id: "a" }), "a", now)).toBe("LIVE");
    expect(offerState(window({ id: "a", startsAt: now, endsAt: now }), "a", now)).toBe("LIVE");
  });

  it("never labels an offer live when it is not the effective one", () => {
    // The guard that keeps the admin badge honest: LIVE requires the id the service picked.
    expect(offerState(window({ id: "x" }), null, now)).toBe("SUPERSEDED");
  });

  it("has a label and an explanation for every state", () => {
    for (const state of ["LIVE", "SUPERSEDED", "SCHEDULED", "EXPIRED", "INACTIVE"] as const) {
      expect(OFFER_STATE_META[state].label.length).toBeGreaterThan(0);
      expect(OFFER_STATE_META[state].hint.length).toBeGreaterThan(0);
    }
  });
});

// ───────────────────────────── Course media slots ─────────────────────────────

describe("setCourseMediaSlots", () => {
  // `ensureAdmin` is find-then-create, so on a freshly truncated database the first callers can
  // collide on users_email_key. Creating the actor once up front keeps this file runnable on its own.
  beforeAll(async () => {
    await ensureAdmin();
  });

  it("writes all four slots and blanks them back to null", async () => {
    const admin = await ensureAdmin();
    const ctx = { user: admin };
    const course = await makeCourse();

    const saved = await setCourseMediaSlots(
      course.id,
      { bannerImage: "/api/files/courses/banner.jpg", instructorImage: "/api/files/courses/tutor.jpg", promoVideoUrl: "https://www.youtube.com/watch?v=abc", videoThumbnail: "/api/files/courses/thumb.jpg" },
      ctx
    );
    expect(saved.bannerImage).toBe("/api/files/courses/banner.jpg");
    expect(saved.promoVideoUrl).toBe("https://www.youtube.com/watch?v=abc");

    // An empty string from a cleared field means "no image", not the literal "".
    const cleared = await setCourseMediaSlots(course.id, { bannerImage: "", instructorImage: null, promoVideoUrl: "", videoThumbnail: "   " }, ctx);
    expect(cleared.bannerImage).toBeNull();
    expect(cleared.instructorImage).toBeNull();
    expect(cleared.promoVideoUrl).toBeNull();
    expect(cleared.videoThumbnail).toBeNull();

    const logs = await db.auditLog.count({ where: { module: "courses", recordType: "Course", recordId: course.id, action: "update" } });
    expect(logs).toBeGreaterThanOrEqual(2);
  });

  it("refuses a course that does not exist", async () => {
    const admin = await ensureAdmin();
    await expect(setCourseMediaSlots("01a0cd8e-0000-7000-8000-000000000000", { bannerImage: "" }, { user: admin })).rejects.toMatchObject({ status: 404 });
  });

  it("refuses inline data so an image can never bypass src/lib/storage", () => {
    expect(courseMediaSlotsSchema.safeParse({ bannerImage: "data:image/png;base64,iVBORw0KGgo=" }).success).toBe(false);
    expect(courseMediaSlotsSchema.safeParse({ bannerImage: "DATA:image/png;base64,iVBORw0KGgo=" }).success).toBe(false);
    expect(courseMediaSlotsSchema.safeParse({ bannerImage: "/api/files/courses/ok.png" }).success).toBe(true);
  });

  it("leaves the transactional fee columns alone", async () => {
    const admin = await ensureAdmin();
    const course = await makeCourse({ courseFee: 2500, registrationFee: 150 });
    await setCourseMediaSlots(course.id, { bannerImage: "/api/files/courses/b.jpg" }, { user: admin });
    const after = await db.course.findUniqueOrThrow({ where: { id: course.id }, select: { courseFee: true, registrationFee: true, status: true } });
    expect(Number(after.courseFee)).toBe(2500);
    expect(Number(after.registrationFee)).toBe(150);
    expect(after.status).toBe("ACTIVE");
  });
});
