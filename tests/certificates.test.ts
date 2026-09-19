import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveApplication, startApplication, submitApplication } from "@/server/applications";
import { completeBatch, recomputeProgress } from "@/server/progress";
import { issueCertificate, revokeCertificate, verifyCertificate, getCertificatePdf } from "@/server/certificates";
import { renderPaymentDocument } from "@/server/receipts";
import { recordManualPayment } from "@/server/payments";
import { ensureAdmin, makeBatch, makeCenter, makeCourse, makeLocation, makeStudent, daysFromNow } from "./helpers";

describe("attendance, progress and certificates", () => {
  it("computes eligibility from attendance, issues a verifiable certificate and supports revocation", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const course = await makeCourse({ courseFee: 500, registrationFee: 0, totalClasses: 10, minAttendancePct: 75, requiredDocuments: [] });
    const center = await makeCenter(admin, loc, [course.id]);
    const batch = await makeBatch(admin, center.id, course.id, 5);
    const good = await makeStudent(loc);
    const poor = await makeStudent(loc);

    for (const s of [good, poor]) {
      const app = await startApplication({ studentId: s.student.id, centerId: center.id, courseId: course.id, batchId: batch.id });
      await submitApplication(app.id, s.student.id);
      await approveApplication(app.id, { batchId: batch.id }, { user: admin });
      await recordManualPayment({ applicationId: app.id, amount: 500, method: "UPI" }, { user: admin });
    }
    const admissions = await db.admission.findMany({ where: { batchId: batch.id } });
    expect(admissions.length).toBe(2);

    // 10 class days: good student attends all, poor student attends 5
    for (let d = 0; d < 10; d++) {
      const date = daysFromNow(-d - 1);
      await db.attendance.create({ data: { batchId: batch.id, studentId: good.student.id, date, status: "PRESENT" } });
      await db.attendance.create({ data: { batchId: batch.id, studentId: poor.student.id, date, status: d < 5 ? "PRESENT" : "ABSENT" } });
    }
    const goodAdm = admissions.find((a) => a.studentId === good.student.id)!;
    const poorAdm = admissions.find((a) => a.studentId === poor.student.id)!;

    let p = await recomputeProgress(goodAdm.id);
    expect(Number(p.attendancePct)).toBe(100);
    expect(p.certificateEligible).toBe(false); // training not yet over

    await expect(issueCertificate(goodAdm.id, { user: admin })).rejects.toMatchObject({ status: 400 });

    const result = await completeBatch(batch.id, { user: admin });
    expect(result.completed).toBe(2);
    p = await recomputeProgress(goodAdm.id);
    expect(p.certificateEligible).toBe(true);
    const pp = await recomputeProgress(poorAdm.id);
    expect(Number(pp.attendancePct)).toBe(50);
    expect(pp.certificateEligible).toBe(false);

    const cert = await issueCertificate(goodAdm.id, { user: admin });
    expect(cert.certificateNo).toMatch(/^ESK-CERT-\d{4}-\d{6}$/);
    await expect(issueCertificate(goodAdm.id, { user: admin })).rejects.toMatchObject({ status: 409 });
    await expect(issueCertificate(poorAdm.id, { user: admin })).rejects.toMatchObject({ status: 400 });

    const pdf = await getCertificatePdf(cert.id);
    expect(pdf.buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");

    const verified = await verifyCertificate(cert.certificateNo.toLowerCase());
    expect(verified?.status).toBe("ISSUED");
    expect(verified?.studentName).toBe(good.student.name);
    expect(verified?.centerCode).toBe(center.code);
    expect(await verifyCertificate("ESK-CERT-0000-000000")).toBeNull();

    await revokeCertificate(cert.id, "Issued in error", { user: admin });
    const revoked = await verifyCertificate(cert.certificateNo);
    expect(revoked?.status).toBe("REVOKED");
    expect(revoked?.revokedReason).toBe("Issued in error");

    const payment = await db.payment.findFirstOrThrow({ where: { studentId: good.student.id } });
    const receipt = await renderPaymentDocument(payment.id, { studentId: good.student.id });
    expect(receipt.buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    await expect(renderPaymentDocument(payment.id, { studentId: poor.student.id })).rejects.toMatchObject({ status: 404 });
  });
});
