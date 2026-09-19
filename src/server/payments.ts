import { db, type Prisma } from "@/lib/db";
import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { notify, notifyStaff } from "@/lib/notifications";
import { generatePaymentNumbers, generateReceiptNo } from "@/lib/ids";
import { getSetting } from "@/lib/settings";
import { createGatewayOrder, getGatewayConfig, verifyRazorpayCheckoutSignature, verifyRazorpayWebhookSignature } from "@/lib/payments";
import { formatINR, toNumber } from "@/lib/utils";
import { confirmAdmission, syncPaymentStatus } from "@/server/applications";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

const PAYABLE_STATUSES = ["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED"] as const;

async function loadPayableApplication(applicationId: string, studentId?: string) {
  const app = await db.application.findFirst({
    where: { id: applicationId, ...(studentId ? { studentId } : {}) },
    include: { student: { include: { user: { select: { id: true, name: true, email: true, mobile: true } } } }, course: true, batch: true },
  });
  if (!app) throw Errors.notFound("Application");
  if (!(PAYABLE_STATUSES as readonly string[]).includes(app.status)) throw Errors.badRequest("This application is not ready for payment.");
  const due = Math.max(0, toNumber(app.payableAmount) - toNumber(app.paidAmount));
  return { app, due };
}

export async function getPaymentSummary(applicationId: string, studentId?: string) {
  const { app, due } = await loadPayableApplication(applicationId, studentId);
  const cfg = await getGatewayConfig();
  const pending = await db.payment.findFirst({ where: { applicationId, status: { in: ["PENDING", "PROCESSING"] } }, orderBy: { createdAt: "desc" } });
  return {
    applicationId,
    applicationNo: app.applicationNo,
    course: app.course.name,
    originalFee: toNumber(app.originalFee),
    scholarshipAmount: toNumber(app.scholarshipAmount),
    discountAmount: toNumber(app.discountAmount),
    payableAmount: toNumber(app.payableAmount),
    paidAmount: toNumber(app.paidAmount),
    due,
    installmentsAllowed: app.installmentsAllowed && cfg.installmentsEnabled,
    gateway: cfg.gateway,
    allowOffline: cfg.allowOffline,
    bankDetails: cfg.bankDetails,
    razorpayKeyId: cfg.gateway === "razorpay" ? cfg.razorpay.keyId : null,
    pendingPayment: pending ? { id: pending.id, paymentNo: pending.paymentNo, amount: toNumber(pending.amount), status: pending.status, method: pending.method } : null,
  };
}

/** Student initiates a payment (online order or offline declaration). */
export async function initiatePayment(input: { applicationId: string; studentId: string; amount?: number; method: PaymentMethod; referenceNo?: string | null; notes?: string | null }, meta: { ip?: string | null } = {}) {
  const { app, due } = await loadPayableApplication(input.applicationId, input.studentId);
  if (due <= 0) throw Errors.badRequest("No fee is due for this application.");
  const cfg = await getGatewayConfig();
  const amount = input.amount === undefined ? due : Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw Errors.validation("Please correct the highlighted fields.", { amount: "Enter a valid amount" });
  if (amount > due + 0.005) throw Errors.validation("Please correct the highlighted fields.", { amount: `Amount cannot exceed the due amount of ${formatINR(due)}` });
  const installmentsAllowed = app.installmentsAllowed && cfg.installmentsEnabled;
  if (amount < due - 0.005 && !installmentsAllowed) throw Errors.badRequest("Partial payments are not enabled for this application. Please pay the full due amount.");
  if (installmentsAllowed && amount < due - 0.005) {
    const existing = await db.payment.count({ where: { applicationId: app.id, status: "COMPLETED" } });
    if (existing + 1 > cfg.maxInstallments) throw Errors.badRequest(`Maximum ${cfg.maxInstallments} installments are allowed.`);
  }

  // Cancel stale pending online orders so only one intent is live.
  await db.payment.updateMany({ where: { applicationId: app.id, status: "PENDING", method: "ONLINE" }, data: { status: "CANCELLED", failureReason: "Superseded by a new payment attempt" } });

  const isOnline = input.method === "ONLINE";
  if (isOnline && cfg.gateway === "manual") throw Errors.badRequest("Online payment is not configured. Please use an offline payment method.");
  if (!isOnline && !cfg.allowOffline) throw Errors.badRequest("Offline payments are not accepted. Please pay online.");

  const nums = await generatePaymentNumbers();
  let gatewayOrderId: string | null = null;
  let gatewayKeyId: string | null = null;
  if (isOnline) {
    const order = await createGatewayOrder({ amount, receipt: nums.paymentNo, notes: { applicationNo: app.applicationNo, student: app.student.name } });
    gatewayOrderId = order.orderId;
    gatewayKeyId = order.keyId ?? null;
  }
  const payment = await db.payment.create({
    data: {
      paymentNo: nums.paymentNo,
      invoiceNo: nums.invoiceNo,
      applicationId: app.id,
      studentId: app.studentId,
      amount,
      currency: cfg.currency,
      method: input.method,
      gateway: isOnline ? cfg.gateway : "manual",
      gatewayOrderId,
      status: isOnline ? "PENDING" : "PROCESSING",
      description: `Fee payment for ${app.course.name} (${app.applicationNo})`,
      referenceNo: input.referenceNo ?? null,
      metadata: input.notes ? { notes: input.notes, ip: meta.ip } : { ip: meta.ip },
    },
  });
  await audit({ user: { id: app.student.user.id, name: app.student.name, role: "STUDENT" }, action: isOnline ? "initiate_payment" : "declare_payment", module: "payments", recordType: "Payment", recordId: payment.id, description: `Student ${app.student.name} ${isOnline ? "initiated online payment" : "declared offline payment"} ${payment.paymentNo} of ${formatINR(amount)}`, ip: meta.ip });
  // An offline declaration sits in PROCESSING until a staff member reconciles it, so it needs an
  // owner. Online payments confirm themselves and are announced from completePayment instead.
  if (!isOnline) {
    await notifyStaff({
      permission: "payments.verify",
      title: `Offline payment to verify: ${formatINR(amount)}`,
      body: `${app.student.name} declared a ${input.method.toLowerCase()} payment of ${formatINR(amount)} for ${app.course.name} (${app.applicationNo}).\nPayment ${payment.paymentNo}${input.referenceNo ? `\nReference: ${input.referenceNo}` : ""}`,
      path: `/admin/payments/${payment.id}`,
    });
  }
  return {
    payment: { ...payment, amount: toNumber(payment.amount) },
    checkout: isOnline ? { gateway: cfg.gateway, keyId: gatewayKeyId, orderId: gatewayOrderId, amount, currency: cfg.currency, name: app.student.name, email: app.student.user.email ?? app.student.email, contact: app.student.user.mobile ?? app.student.mobile } : null,
  };
}

async function completePayment(paymentId: string, data: { gatewayPaymentId?: string | null; gatewaySignature?: string | null; verifiedById?: string | null; method?: PaymentMethod; referenceNo?: string | null }, actor: AuditActor | null) {
  const out = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { application: { include: { student: { include: { user: true } }, course: true } } } });
    if (!payment) throw Errors.notFound("Payment");
    if (payment.status === "COMPLETED") return { payment, already: true, fullyPaid: false };
    if (!["PENDING", "PROCESSING"].includes(payment.status)) throw Errors.badRequest(`Payment is ${payment.status.toLowerCase()} and cannot be completed.`);
    const receiptNo = await generateReceiptNo(tx);
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
        receiptNo,
        gatewayPaymentId: data.gatewayPaymentId ?? payment.gatewayPaymentId,
        gatewaySignature: data.gatewaySignature ?? payment.gatewaySignature,
        verifiedById: data.verifiedById ?? null,
        verifiedAt: data.verifiedById ? new Date() : null,
        method: data.method ?? payment.method,
        referenceNo: data.referenceNo ?? payment.referenceNo,
      },
      include: { application: { include: { student: { include: { user: true } }, course: true } } },
    });
    const { fullyPaid } = await syncPaymentStatus(tx, payment.applicationId, actor?.id ?? null);
    await tx.feeInstallment.updateMany({ where: { applicationId: payment.applicationId, status: "PENDING", amount: { lte: updated.amount } }, data: { status: "PAID", paymentId: updated.id } });
    return { payment: updated, already: false, fullyPaid };
  });
  if (out.already) return out.payment;

  const app = out.payment.application;
  const student = app.student;
  await audit({ user: actor, action: "payment_completed", module: "payments", recordType: "Payment", recordId: out.payment.id, description: `Payment ${out.payment.paymentNo} of ${formatINR(out.payment.amount)} completed for ${student.name} (${app.applicationNo})`, newValue: { receiptNo: out.payment.receiptNo, verifiedById: data.verifiedById } });
  await notify({ userId: student.user.id, email: student.user.email ?? student.email, mobile: student.user.mobile ?? student.mobile, event: "PAYMENT_RECEIVED", data: { name: student.name, amount: formatINR(out.payment.amount), paymentNo: out.payment.paymentNo, receiptNo: out.payment.receiptNo ?? "" } });
  await notifyStaff({
    permission: "payments.view",
    title: `Payment received: ${formatINR(out.payment.amount)}`,
    body: `${student.name} paid ${formatINR(out.payment.amount)} for ${app.course.name} (${app.applicationNo}).\nPayment ${out.payment.paymentNo}, receipt ${out.payment.receiptNo ?? "—"}.`,
    path: `/admin/payments/${out.payment.id}`,
  });

  const autoConfirm = await getSetting<boolean>("admissions.autoConfirmOnPayment");
  if (out.fullyPaid && autoConfirm && app.batchId) {
    const systemActor: AuditActor = actor ?? { id: student.user.id, name: "System", role: "SYSTEM" };
    await confirmAdmission(app.id, { user: systemActor }, "Auto-confirmed after full payment").catch((err) => console.error("[payments] auto-confirm failed:", err));
  }
  return out.payment;
}

/** Verifies a Razorpay checkout response for a payment the student initiated. */
export async function verifyOnlinePayment(input: { paymentId: string; studentId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
  const payment = await db.payment.findFirst({ where: { id: input.paymentId, studentId: input.studentId } });
  if (!payment) throw Errors.notFound("Payment");
  if (payment.gatewayOrderId !== input.razorpayOrderId) throw Errors.badRequest("Order mismatch");
  const cfg = await getGatewayConfig();
  const ok = verifyRazorpayCheckoutSignature({ orderId: input.razorpayOrderId, paymentId: input.razorpayPaymentId, signature: input.razorpaySignature, secret: cfg.razorpay.keySecret });
  if (!ok) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Signature verification failed" } });
    throw Errors.badRequest("Payment verification failed. If money was deducted it will be reconciled automatically.");
  }
  return completePayment(payment.id, { gatewayPaymentId: input.razorpayPaymentId, gatewaySignature: input.razorpaySignature }, null);
}

/** Razorpay webhook (payment.captured / order.paid). */
export async function handleRazorpayWebhook(rawBody: string, signature: string | null) {
  const cfg = await getGatewayConfig();
  if (!cfg.razorpay.webhookSecret) throw Errors.badRequest("Webhook secret not configured");
  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature, cfg.razorpay.webhookSecret)) throw Errors.forbidden("Invalid webhook signature");
  const event = JSON.parse(rawBody) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; status: string } } } };
  const entity = event.payload?.payment?.entity;
  if (!entity?.order_id) return { ignored: true };
  const payment = await db.payment.findFirst({ where: { gatewayOrderId: entity.order_id } });
  if (!payment) return { ignored: true };
  if (event.event === "payment.captured" || event.event === "order.paid") {
    await completePayment(payment.id, { gatewayPaymentId: entity.id }, null);
    return { completed: true };
  }
  if (event.event === "payment.failed" && payment.status === "PENDING") {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Gateway reported failure", gatewayPaymentId: entity.id } });
  }
  return { handled: event.event };
}

/** Staff verifies an offline (PROCESSING) payment. */
export async function verifyPaymentByStaff(paymentId: string, ctx: Ctx, input: { referenceNo?: string | null; method?: PaymentMethod } = {}) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw Errors.notFound("Payment");
  if (!["PENDING", "PROCESSING"].includes(payment.status)) throw Errors.badRequest("Only pending payments can be verified.");
  return completePayment(paymentId, { verifiedById: ctx.user.id, referenceNo: input.referenceNo, method: input.method }, ctx.user);
}

export async function rejectPayment(paymentId: string, reason: string, ctx: Ctx) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { application: { include: { student: { include: { user: true } } } } } });
  if (!payment) throw Errors.notFound("Payment");
  if (!["PENDING", "PROCESSING"].includes(payment.status)) throw Errors.badRequest("Only pending payments can be rejected.");
  await db.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failureReason: reason, verifiedById: ctx.user.id, verifiedAt: new Date() } });
  await audit({ user: ctx.user, action: "reject_payment", module: "payments", recordType: "Payment", recordId: paymentId, description: `${ctx.user.name} rejected payment ${payment.paymentNo}: ${reason}`, ip: ctx.ip, userAgent: ctx.userAgent });
  const s = payment.application.student;
  await notify({ userId: s.user.id, email: s.user.email ?? s.email, mobile: s.user.mobile ?? s.mobile, event: "APPLICATION_STATUS", data: { name: s.name, applicationNo: payment.application.applicationNo, status: "Payment not verified", note: reason } });
}

/** Staff records a payment collected directly (cash at center, bank transfer seen in statement). */
export async function recordManualPayment(input: { applicationId: string; amount: number; method: PaymentMethod; referenceNo?: string | null; description?: string | null; paidAt?: Date | null }, ctx: Ctx) {
  const { app, due } = await loadPayableApplication(input.applicationId);
  if (input.amount <= 0) throw Errors.validation("Please correct the highlighted fields.", { amount: "Enter a valid amount" });
  if (input.amount > due + 0.005) throw Errors.validation("Please correct the highlighted fields.", { amount: `Amount exceeds the due amount of ${formatINR(due)}` });
  const cfg = await getGatewayConfig();
  const nums = await generatePaymentNumbers();
  const payment = await db.payment.create({
    data: {
      paymentNo: nums.paymentNo,
      invoiceNo: nums.invoiceNo,
      applicationId: app.id,
      studentId: app.studentId,
      amount: input.amount,
      currency: cfg.currency,
      method: input.method,
      gateway: "manual",
      status: "PROCESSING",
      description: input.description ?? `Fee payment for ${app.course.name} (${app.applicationNo})`,
      referenceNo: input.referenceNo ?? null,
      paidAt: input.paidAt ?? null,
    },
  });
  await audit({ user: ctx.user, action: "record_payment", module: "payments", recordType: "Payment", recordId: payment.id, description: `${ctx.user.name} recorded ${input.method} payment ${payment.paymentNo} of ${formatINR(input.amount)} for ${app.applicationNo}`, ip: ctx.ip, userAgent: ctx.userAgent });
  return completePayment(payment.id, { verifiedById: ctx.user.id }, ctx.user);
}

export async function refundPayment(paymentId: string, reason: string, ctx: Ctx) {
  const out = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw Errors.notFound("Payment");
    if (payment.status !== "COMPLETED") throw Errors.badRequest("Only completed payments can be refunded.");
    const updated = await tx.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED", failureReason: reason } });
    await syncPaymentStatus(tx, payment.applicationId, ctx.user.id);
    return updated;
  });
  await audit({ user: ctx.user, action: "refund", module: "payments", recordType: "Payment", recordId: paymentId, description: `${ctx.user.name} refunded payment ${out.paymentNo}: ${reason}`, ip: ctx.ip, userAgent: ctx.userAgent });
  return out;
}

export async function createInstallmentPlan(applicationId: string, plan: { amount: number; dueDate: Date }[], ctx: Ctx) {
  const { app, due } = await loadPayableApplication(applicationId);
  const total = plan.reduce((s, p) => s + p.amount, 0);
  if (Math.abs(total - due) > 0.01) throw Errors.validation("Please correct the highlighted fields.", { plan: `Installments must total the due amount of ${formatINR(due)}` });
  await db.$transaction(async (tx) => {
    await tx.feeInstallment.deleteMany({ where: { applicationId, status: "PENDING" } });
    await tx.application.update({ where: { id: applicationId }, data: { installmentsAllowed: true } });
    await tx.feeInstallment.createMany({ data: plan.map((p, i) => ({ applicationId, installmentNo: i + 1, amount: p.amount, dueDate: p.dueDate })) });
  });
  await audit({ user: ctx.user, action: "installment_plan", module: "payments", recordType: "Application", recordId: applicationId, description: `${ctx.user.name} created a ${plan.length}-installment plan for ${app.applicationNo}`, newValue: plan, ip: ctx.ip, userAgent: ctx.userAgent });
}

export const paymentListSchema = paginationSchema.extend({
  status: z.string().optional(),
  method: z.string().optional(),
  centerId: optionalUuid,
  courseId: optionalUuid,
  studentId: optionalUuid,
  applicationId: optionalUuid,
  from: optionalDate,
  to: optionalDate,
});

export async function listPayments(q: z.infer<typeof paymentListSchema>) {
  const where: Prisma.PaymentWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",") as PaymentStatus[] };
  if (q.method) where.method = { in: q.method.split(",") as PaymentMethod[] };
  if (q.studentId) where.studentId = q.studentId;
  if (q.applicationId) where.applicationId = q.applicationId;
  if (q.centerId || q.courseId) where.application = { centerId: q.centerId, courseId: q.courseId };
  if (q.from || q.to) where.createdAt = { gte: q.from, lt: q.to };
  if (q.q) {
    where.OR = [
      { paymentNo: { contains: q.q, mode: "insensitive" } },
      { receiptNo: { contains: q.q, mode: "insensitive" } },
      { invoiceNo: { contains: q.q, mode: "insensitive" } },
      { referenceNo: { contains: q.q, mode: "insensitive" } },
      { gatewayPaymentId: { contains: q.q, mode: "insensitive" } },
      { student: { name: { contains: q.q, mode: "insensitive" } } },
      { application: { applicationNo: { contains: q.q, mode: "insensitive" } } },
    ];
  }
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "amount", "status", "paidAt"] as const, "createdAt");
  const [items, total, sum] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy,
      ...getPaging(q),
      include: { student: { select: { id: true, name: true, studentId: true, mobile: true } }, application: { select: { id: true, applicationNo: true, course: { select: { name: true } }, center: { select: { name: true, code: true } } } } },
    }),
    db.payment.count({ where }),
    db.payment.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { amount: true } }),
  ]);
  return { ...paged(items.map((p) => ({ ...p, amount: toNumber(p.amount) })), total, q), totalCompleted: toNumber(sum._sum.amount) };
}
