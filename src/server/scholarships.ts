import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { formatINR, toNumber } from "@/lib/utils";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Records the Foundation's scholarship decision for an application and recalculates the payable fee.
 * Allowed while the application is under review or awaiting payment (never after full payment / admission).
 */
export async function decideScholarship(
  applicationId: string,
  input: { programId?: string | null; status: "APPROVED" | "REJECTED"; scholarshipAmount?: number; percentage?: number; remarks?: string | null },
  ctx: Ctx
) {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: { student: { include: { user: true } }, course: true },
  });
  if (!app) throw Errors.notFound("Application");
  if (["PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "COMPLETED", "CANCELLED", "REJECTED"].includes(app.status)) {
    throw Errors.badRequest("Scholarship can only be decided before the fee is fully paid.");
  }
  const original = toNumber(app.originalFee);
  const discount = toNumber(app.discountAmount);
  let amount = 0;
  let program = null;
  if (input.status === "APPROVED") {
    if (input.programId) {
      program = await db.scholarshipProgram.findFirst({ where: { id: input.programId, isActive: true } });
      if (!program) throw Errors.notFound("Scholarship program");
    }
    if (input.scholarshipAmount !== undefined && input.scholarshipAmount !== null) amount = Number(input.scholarshipAmount);
    else if (input.percentage !== undefined) amount = (original * Number(input.percentage)) / 100;
    else if (program?.fixedAmount) amount = toNumber(program.fixedAmount);
    else if (program?.percentage) amount = (original * program.percentage) / 100;
    if (program?.maxAmount && amount > toNumber(program.maxAmount)) amount = toNumber(program.maxAmount);
    amount = Math.round(amount * 100) / 100;
    if (amount < 0 || amount + discount > original) throw Errors.validation("Please correct the highlighted fields.", { scholarshipAmount: "Scholarship plus discount cannot exceed the original fee" });
  }
  const payable = Math.max(0, original - amount - discount);
  const paid = toNumber(app.paidAmount);

  const award = await db.$transaction(async (tx) => {
    const a = await tx.scholarshipAward.upsert({
      where: { applicationId },
      create: { applicationId, programId: program?.id ?? null, studentId: app.studentId, courseId: app.courseId, originalFee: original, scholarshipAmount: amount, payableFee: payable, status: input.status, remarks: input.remarks ?? null, approvedById: ctx.user.id, approvedAt: new Date() },
      update: { programId: program?.id ?? null, scholarshipAmount: amount, payableFee: payable, status: input.status, remarks: input.remarks ?? null, approvedById: ctx.user.id, approvedAt: new Date() },
    });
    await tx.application.update({ where: { id: applicationId }, data: { scholarshipAmount: amount, payableAmount: payable } });
    // If the scholarship now covers everything that was pending, advance the payment status.
    if (paid + 0.005 >= payable && (app.status === "PAYMENT_PENDING" || app.status === "APPROVED") && payable > 0) {
      await tx.application.update({ where: { id: applicationId }, data: { status: "PAYMENT_COMPLETED" } });
      await tx.applicationStatusHistory.create({ data: { applicationId, fromStatus: app.status, toStatus: "PAYMENT_COMPLETED", note: "Scholarship covers the remaining fee", changedById: ctx.user.id } });
    }
    return a;
  });

  await audit({ user: ctx.user, action: input.status === "APPROVED" ? "approve_scholarship" : "reject_scholarship", module: "scholarships", recordType: "ScholarshipAward", recordId: award.id, description: `${ctx.user.name} ${input.status === "APPROVED" ? `approved a scholarship of ${formatINR(amount)}` : "rejected the scholarship request"} for ${app.applicationNo}`, oldValue: { scholarshipAmount: app.scholarshipAmount, payableAmount: app.payableAmount }, newValue: { scholarshipAmount: amount, payableAmount: payable, programId: program?.id }, ip: ctx.ip, userAgent: ctx.userAgent });
  const s = app.student;
  await notify({ userId: s.user.id, email: s.user.email ?? s.email, mobile: s.user.mobile ?? s.mobile, event: "SCHOLARSHIP_DECISION", data: { name: s.name, applicationNo: app.applicationNo, status: input.status === "APPROVED" ? "Approved" : "Not approved", scholarshipAmount: formatINR(amount), payableAmount: formatINR(payable) } });
  return { ...award, originalFee: original, scholarshipAmount: amount, payableFee: payable };
}
