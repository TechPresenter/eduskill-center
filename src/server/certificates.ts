import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { db, type Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { generateCertificateNo } from "@/lib/ids";
import { getSetting, getBranding } from "@/lib/settings";
import { putBuffer, readStoredFile, keyFromUrl } from "@/lib/storage";
import { absoluteUrl, formatDate, toNumber } from "@/lib/utils";
import { recomputeProgress } from "@/server/progress";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

export function gradeFor(pct: number | null): string | null {
  if (pct === null) return null;
  if (pct >= 85) return "A+";
  if (pct >= 75) return "A";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "Pass";
}

/** Issues a certificate for an admission whose progress is eligible (or with `force` by a permitted user). */
export async function issueCertificate(admissionId: string, ctx: Ctx, opts: { grade?: string | null; force?: boolean; completionDate?: Date | null } = {}) {
  const progress = await recomputeProgress(admissionId);
  const adm = await db.admission.findUnique({ where: { id: admissionId }, include: { student: { include: { user: true } }, course: true, center: true, certificate: true, batch: true } });
  if (!adm) throw Errors.notFound("Admission");
  if (adm.certificate) throw Errors.conflict(`Certificate ${adm.certificate.certificateNo} already exists for this admission.`);
  if (!progress.certificateEligible && !opts.force) {
    throw Errors.badRequest(`Student is not yet eligible: attendance ${toNumber(progress.attendancePct)}% (required ${adm.course.minAttendancePct}%), assessment average ${toNumber(progress.assessmentAvgPct)}% (required ${adm.course.passingMarksPct}%), training ${adm.status === "COMPLETED" || adm.batch.status === "COMPLETED" ? "completed" : "not completed"}.`);
  }
  const signatoryName = await getSetting<string>("certificate.signatoryName");
  const signatoryTitle = await getSetting<string>("certificate.signatoryTitle");
  const completionDate = opts.completionDate ?? adm.completedAt ?? adm.batch.endDate;
  const finalPct = progress.finalMarksPct !== null ? toNumber(progress.finalMarksPct) : toNumber(progress.assessmentAvgPct) || null;

  const cert = await db.$transaction(async (tx) => {
    const certificateNo = await generateCertificateNo(tx);
    return tx.certificate.create({
      data: {
        certificateNo,
        admissionId,
        studentId: adm.studentId,
        courseId: adm.courseId,
        centerId: adm.centerId,
        studentName: adm.student.name,
        courseName: adm.course.name,
        centerName: adm.center.name,
        centerCode: adm.center.code,
        durationText: adm.course.durationText,
        completionDate,
        grade: opts.grade ?? gradeFor(finalPct),
        signatoryName,
        signatoryTitle,
        issuedById: ctx.user.id,
      },
    });
  });

  try {
    const pdf = await renderCertificatePdf(cert);
    const stored = await putBuffer(`public/certificates/${cert.certificateNo}.pdf`, pdf, "application/pdf");
    await db.certificate.update({ where: { id: cert.id }, data: { pdfUrl: stored.url } });
    cert.pdfUrl = stored.url;
  } catch (err) {
    console.error("[certificates] PDF generation failed (will render on demand):", err);
  }

  await audit({ user: ctx.user, action: "issue", module: "certificates", recordType: "Certificate", recordId: cert.id, description: `${ctx.user.name} issued certificate ${cert.certificateNo} to ${adm.student.name} for ${adm.course.name}${opts.force ? " (forced)" : ""}`, ip: ctx.ip, userAgent: ctx.userAgent });
  const s = adm.student;
  await notify({ userId: s.user.id, email: s.user.email ?? s.email, mobile: s.user.mobile ?? s.mobile, event: "CERTIFICATE_ISSUED", data: { name: s.name, course: adm.course.name, certificateNo: cert.certificateNo, verifyUrl: absoluteUrl(`/verify-certificate/${cert.certificateNo}`) } });
  return cert;
}

export async function revokeCertificate(id: string, reason: string, ctx: Ctx) {
  const cert = await db.certificate.findUnique({
    where: { id },
    include: { student: { include: { user: { select: { id: true, email: true, mobile: true } } } }, course: { select: { name: true } } },
  });
  if (!cert) throw Errors.notFound("Certificate");
  if (cert.status === "REVOKED") throw Errors.badRequest("Already revoked.");
  const updated = await db.certificate.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason } });
  await audit({ user: ctx.user, action: "revoke", module: "certificates", recordType: "Certificate", recordId: id, description: `${ctx.user.name} revoked certificate ${cert.certificateNo}: ${reason}`, ip: ctx.ip, userAgent: ctx.userAgent });
  await notify({
    userId: cert.student.user.id,
    email: cert.student.user.email ?? cert.student.email,
    mobile: cert.student.user.mobile ?? cert.student.mobile,
    event: "CERTIFICATE_REVOKED",
    data: { name: cert.student.name, certificateNo: cert.certificateNo, course: cert.course.name, reason },
  });
  return updated;
}

/** Public verification. Returns only non-sensitive fields. */
export async function verifyCertificate(certificateNo: string, meta: { ip?: string | null } = {}) {
  const no = certificateNo.trim().toUpperCase();
  const cert = await db.certificate.findUnique({ where: { certificateNo: no }, include: { course: { select: { slug: true } }, center: { select: { slug: true, state: { select: { slug: true, name: true } }, district: { select: { slug: true, name: true } } } } } });
  if (!cert) return null;
  await db.certificate.update({ where: { id: cert.id }, data: { verificationCount: { increment: 1 } } }).catch(() => undefined);
  await db.analyticsEvent.create({ data: { type: "CERTIFICATE_VERIFIED", refId: cert.id, ipHash: meta.ip ?? null } }).catch(() => undefined);
  return {
    certificateNo: cert.certificateNo,
    status: cert.status,
    studentName: cert.studentName,
    courseName: cert.courseName,
    courseSlug: cert.course.slug,
    centerName: cert.centerName,
    centerCode: cert.centerCode,
    centerUrl: `/training-centers/${cert.center.state.slug}/${cert.center.district.slug}/${cert.center.slug}`,
    location: `${cert.center.district.name}, ${cert.center.state.name}`,
    durationText: cert.durationText,
    completionDate: cert.completionDate,
    issuedAt: cert.issuedAt,
    grade: cert.grade,
    revokedAt: cert.revokedAt,
    revokedReason: cert.status === "REVOKED" ? cert.revokedReason : null,
  };
}

export async function getCertificatePdf(certificateId: string, scope?: { studentId?: string }): Promise<{ buffer: Buffer; filename: string }> {
  const cert = await db.certificate.findFirst({ where: { id: certificateId, ...(scope?.studentId ? { studentId: scope.studentId } : {}) } });
  if (!cert) throw Errors.notFound("Certificate");
  const key = keyFromUrl(cert.pdfUrl);
  if (key) {
    const existing = await readStoredFile(key);
    if (existing) return { buffer: existing.buffer, filename: `${cert.certificateNo}.pdf` };
  }
  const buffer = await renderCertificatePdf(cert);
  const stored = await putBuffer(`public/certificates/${cert.certificateNo}.pdf`, buffer, "application/pdf");
  await db.certificate.update({ where: { id: cert.id }, data: { pdfUrl: stored.url } }).catch(() => undefined);
  return { buffer, filename: `${cert.certificateNo}.pdf` };
}

type CertRow = Prisma.CertificateGetPayload<Record<string, never>>;

/** Renders an A4 landscape certificate with navy/orange branding and a verification QR code. */
export async function renderCertificatePdf(cert: CertRow): Promise<Buffer> {
  const branding = await getBranding();
  const showQr = await getSetting<boolean>("certificate.showQr");
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]);
  const { width, height } = page.getSize();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const navy = rgb(18 / 255, 53 / 255, 122 / 255);
  const orange = rgb(232 / 255, 82 / 255, 10 / 255);
  const ink = rgb(23 / 255, 32 / 255, 51 / 255);
  const muted = rgb(102 / 255, 112 / 255, 133 / 255);
  const lavender = rgb(232 / 255, 234 / 255, 246 / 255);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: navy, borderWidth: 3 });
  page.drawRectangle({ x: 26, y: 26, width: width - 52, height: height - 52, borderColor: orange, borderWidth: 1 });
  page.drawRectangle({ x: 26, y: height - 108, width: width - 52, height: 82, color: navy });
  page.drawRectangle({ x: 26, y: height - 114, width: width - 52, height: 6, color: orange });

  const center = (text: string, y: number, font = regular, size = 12, color = ink) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font, color });
  };

  center(branding.siteName.toUpperCase(), height - 62, bold, 22, rgb(1, 1, 1));
  center(branding.tagline, height - 84, regular, 10, rgb(0.85, 0.88, 0.97));

  center("CERTIFICATE OF COMPLETION", height - 160, bold, 26, navy);
  page.drawRectangle({ x: width / 2 - 40, y: height - 172, width: 80, height: 3, color: orange });
  center("This is to certify that", height - 205, italic, 13, muted);
  center(cert.studentName, height - 245, bold, 30, orange);
  center("has successfully completed the course", height - 275, italic, 13, muted);
  center(cert.courseName, height - 305, bold, 20, navy);
  center(`Duration: ${cert.durationText}   |   Completed on: ${formatDate(cert.completionDate)}${cert.grade ? `   |   Grade: ${cert.grade}` : ""}`, height - 332, regular, 12, ink);
  center(`at ${cert.centerName} (Center Code: ${cert.centerCode})`, height - 352, regular, 12, ink);

  // Footer band
  page.drawRectangle({ x: 26, y: 26, width: width - 52, height: 92, color: lavender });
  page.drawText("Certificate No.", { x: 48, y: 92, size: 9, font: regular, color: muted });
  page.drawText(cert.certificateNo, { x: 48, y: 76, size: 13, font: bold, color: navy });
  page.drawText("Issued on", { x: 48, y: 56, size: 9, font: regular, color: muted });
  page.drawText(formatDate(cert.issuedAt), { x: 48, y: 42, size: 11, font: regular, color: ink });

  const sigX = width / 2 - 90;
  page.drawLine({ start: { x: sigX, y: 66 }, end: { x: sigX + 180, y: 66 }, thickness: 1, color: navy });
  const sName = cert.signatoryName;
  page.drawText(sName, { x: sigX + 90 - bold.widthOfTextAtSize(sName, 11) / 2, y: 52, size: 11, font: bold, color: navy });
  page.drawText(cert.signatoryTitle, { x: sigX + 90 - regular.widthOfTextAtSize(cert.signatoryTitle, 9) / 2, y: 40, size: 9, font: regular, color: muted });

  if (showQr) {
    const verifyUrl = absoluteUrl(`/verify-certificate/${cert.certificateNo}`);
    const png = await QRCode.toBuffer(verifyUrl, { margin: 0, width: 160, color: { dark: "#12357A", light: "#FFFFFF" } });
    const qr = await doc.embedPng(png);
    page.drawImage(qr, { x: width - 48 - 70, y: 36, width: 70, height: 70 });
    page.drawText("Scan to verify", { x: width - 48 - 70 + 8, y: 28, size: 7, font: regular, color: muted });
  }
  if (cert.status === "REVOKED") {
    page.drawText("REVOKED", { x: width / 2 - 110, y: height / 2 - 40, size: 72, font: bold, color: rgb(0.85, 0.18, 0.13), opacity: 0.25, rotate: { type: "degrees", angle: 20 } as never });
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export const certificateListSchema = paginationSchema.extend({
  status: z.string().optional(),
  centerId: optionalUuid,
  courseId: optionalUuid,
  studentId: optionalUuid,
  from: optionalDate,
  to: optionalDate,
});

export async function listCertificates(q: z.infer<typeof certificateListSchema>) {
  const where: Prisma.CertificateWhereInput = {};
  if (q.status) where.status = q.status as "ISSUED" | "REVOKED";
  if (q.centerId) where.centerId = q.centerId;
  if (q.courseId) where.courseId = q.courseId;
  if (q.studentId) where.studentId = q.studentId;
  if (q.from || q.to) where.issuedAt = { gte: q.from, lt: q.to };
  if (q.q) where.OR = [{ certificateNo: { contains: q.q, mode: "insensitive" } }, { studentName: { contains: q.q, mode: "insensitive" } }, { student: { studentId: { contains: q.q, mode: "insensitive" } } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["issuedAt", "certificateNo", "studentName", "status"] as const, "issuedAt");
  const [items, total] = await Promise.all([
    db.certificate.findMany({ where, orderBy, ...getPaging(q), include: { student: { select: { id: true, studentId: true } }, admission: { select: { id: true, admissionNo: true, batch: { select: { name: true, code: true } } } } } }),
    db.certificate.count({ where }),
  ]);
  return paged(items, total, q);
}

/** Admissions that are eligible for a certificate but do not yet have one. */
export async function listCertificateCandidates(q: { centerId?: string; courseId?: string; batchId?: string; page: number; limit: number }) {
  const where: Prisma.AdmissionWhereInput = { certificate: null, progress: { certificateEligible: true }, centerId: q.centerId, courseId: q.courseId, batchId: q.batchId };
  const [items, total] = await Promise.all([
    db.admission.findMany({ where, ...getPaging(q), orderBy: { completedAt: "desc" }, include: { student: { select: { id: true, name: true, studentId: true } }, course: { select: { name: true } }, center: { select: { name: true, code: true } }, batch: { select: { name: true, code: true } }, progress: true } }),
    db.admission.count({ where }),
  ]);
  return paged(items, total, q);
}
