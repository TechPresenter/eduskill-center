import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveApplication, getApplicationDetail, rejectApplication, requestDocuments, startApplication, submitApplication, waitlistApplication } from "@/server/applications";
import { recordManualPayment } from "@/server/payments";
import { decideScholarship } from "@/server/scholarships";
import { getBatchSeatInfo } from "@/server/batches";
import { addStudentDocuments, ensureAdmin, ensureDocumentTypes, makeBatch, makeCenter, makeCourse, makeLocation, makeStudent } from "./helpers";

describe("student admission workflow", () => {
  it("runs apply → submit → review → approve → pay → auto-confirm with Student ID", async () => {
    const admin = await ensureAdmin();
    await ensureDocumentTypes();
    const loc = await makeLocation();
    const course = await makeCourse({ courseFee: 2000, registrationFee: 100, requiredDocuments: ["photo", "id_proof"] });
    const center = await makeCenter(admin, loc, [course.id]);
    const batch = await makeBatch(admin, center.id, course.id, 5);
    const { student } = await makeStudent(loc, { withDocuments: false });

    const app = await startApplication({ studentId: student.id, centerId: center.id, courseId: course.id, batchId: batch.id, scholarshipRequested: true, scholarshipReason: "Low income" });
    expect(app.status).toBe("DRAFT");
    expect(Number(app.originalFee)).toBe(2100);
    expect(app.applicationNo).toMatch(/^APP-\d{4}-\d{6}$/);

    // Cannot submit without required documents
    await expect(submitApplication(app.id, student.id)).rejects.toMatchObject({ status: 422 });
    await addStudentDocuments(student.id, ["photo", "id_proof"]);
    const submitted = await submitApplication(app.id, student.id);
    expect(["SUBMITTED", "UNDER_REVIEW"]).toContain(submitted.status);

    // Duplicate open application for the same course is blocked
    await expect(startApplication({ studentId: student.id, centerId: center.id, courseId: course.id })).rejects.toMatchObject({ status: 409 });

    // Scholarship decision reduces payable
    const award = await decideScholarship(app.id, { status: "APPROVED", percentage: 50, remarks: "Merit" }, { user: admin });
    expect(award.scholarshipAmount).toBe(1050);
    expect(award.payableFee).toBe(1050);

    // Approve → payment pending (fee due) and seat reserved
    const approved = await approveApplication(app.id, { batchId: batch.id, note: "ok" }, { user: admin });
    expect(approved.status).toBe("PAYMENT_PENDING");
    expect((await getBatchSeatInfo(batch.id)).occupied).toBe(1);

    // Manual payment of the full due amount completes and auto-confirms admission
    const payment = await recordManualPayment({ applicationId: app.id, amount: 1050, method: "CASH", referenceNo: "CASH-1" }, { user: admin });
    expect(payment.status).toBe("COMPLETED");
    expect(payment.receiptNo).toMatch(/^RCP-/);

    const detail = await getApplicationDetail(app.id);
    expect(detail.status).toBe("ADMISSION_CONFIRMED");
    expect(detail.paidAmount).toBe(1050);
    expect(detail.admission?.admissionNo).toMatch(/^ADM-/);
    const refreshed = await db.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(refreshed.studentId).toMatch(/^ESK-ST-\d{4}-\d{5}$/);
    expect((await getBatchSeatInfo(batch.id)).occupied).toBe(1);
    expect(detail.statusHistory.map((h) => h.toStatus)).toEqual(expect.arrayContaining(["DRAFT", "SUBMITTED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED"]));
    const notifications = await db.notification.count({ where: { userId: detail.student.user.id, channel: "IN_APP" } });
    expect(notifications).toBeGreaterThanOrEqual(3);
  });

  it("enforces batch capacity, including under concurrent approvals", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const course = await makeCourse({ courseFee: 0, registrationFee: 0, requiredDocuments: [] });
    const center = await makeCenter(admin, loc, [course.id]);
    const batch = await makeBatch(admin, center.id, course.id, 1);
    const s1 = await makeStudent(loc);
    const s2 = await makeStudent(loc);
    const s3 = await makeStudent(loc);
    const a1 = await startApplication({ studentId: s1.student.id, centerId: center.id, courseId: course.id });
    const a2 = await startApplication({ studentId: s2.student.id, centerId: center.id, courseId: course.id });
    await submitApplication(a1.id, s1.student.id);
    await submitApplication(a2.id, s2.student.id);

    const results = await Promise.allSettled([
      approveApplication(a1.id, { batchId: batch.id }, { user: admin }),
      approveApplication(a2.id, { batchId: batch.id }, { user: admin }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok.length).toBe(1);
    expect(failed.length).toBe(1);
    expect((failed[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    expect((await getBatchSeatInfo(batch.id)).available).toBe(0);
    // Free course → admission auto-confirmed straight after approval
    const winner = results.findIndex((r) => r.status === "fulfilled") === 0 ? a1 : a2;
    const winnerDetail = await getApplicationDetail(winner.id);
    expect(winnerDetail.status).toBe("ADMISSION_CONFIRMED");

    // A third applicant cannot even select the full batch
    await expect(startApplication({ studentId: s3.student.id, centerId: center.id, courseId: course.id, batchId: batch.id })).rejects.toMatchObject({ status: 409 });
    // …but can be waitlisted without a batch
    const a3 = await startApplication({ studentId: s3.student.id, centerId: center.id, courseId: course.id });
    await submitApplication(a3.id, s3.student.id);
    await waitlistApplication(a3.id, "Batch full", { user: admin });
    expect((await getApplicationDetail(a3.id)).status).toBe("WAITLISTED");
  });

  it("supports documents-required and rejection paths with history and reasons", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const course = await makeCourse({ requiredDocuments: [] });
    const center = await makeCenter(admin, loc, [course.id]);
    const { student } = await makeStudent(loc);
    const app = await startApplication({ studentId: student.id, centerId: center.id, courseId: course.id });
    await submitApplication(app.id, student.id);
    await requestDocuments(app.id, "Upload marksheet", { user: admin });
    expect((await getApplicationDetail(app.id)).status).toBe("DOCUMENTS_REQUIRED");
    await rejectApplication(app.id, "Not eligible", { user: admin });
    const detail = await getApplicationDetail(app.id);
    expect(detail.status).toBe("REJECTED");
    expect(detail.rejectionReason).toBe("Not eligible");
    expect(detail.allowedTransitions).toEqual(["UNDER_REVIEW"]);
    // Cannot approve a rejected application directly
    await expect(approveApplication(app.id, {}, { user: admin })).rejects.toMatchObject({ status: 400 });
  });

  it("blocks applications when the student profile is incomplete", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const course = await makeCourse();
    const center = await makeCenter(admin, loc, [course.id]);
    const { student } = await makeStudent(loc, { profileCompleted: false });
    await expect(startApplication({ studentId: student.id, centerId: center.id, courseId: course.id })).rejects.toMatchObject({ status: 400 });
  });
});
