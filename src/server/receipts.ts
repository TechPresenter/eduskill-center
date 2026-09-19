import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { getBranding } from "@/lib/settings";
import { formatDateTime, titleCase, toNumber } from "@/lib/utils";

/** Rupee formatting for PDFs (Helvetica has no ₹ glyph). */
function rs(n: number) {
  return `Rs. ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

/**
 * Renders a payment receipt (for COMPLETED payments) or a proforma invoice (for pending ones).
 * Scope by studentId for the student portal; staff pass no scope.
 */
export async function renderPaymentDocument(paymentId: string, scope?: { studentId?: string }): Promise<{ buffer: Buffer; filename: string }> {
  const p = await db.payment.findFirst({
    where: { id: paymentId, ...(scope?.studentId ? { studentId: scope.studentId } : {}) },
    include: {
      student: { select: { name: true, studentId: true, mobile: true, email: true } },
      application: { include: { course: { select: { name: true, code: true } }, center: { select: { name: true, code: true, address: true } }, fees: true } },
    },
  });
  if (!p) throw Errors.notFound("Payment");
  const branding = await getBranding();
  const isReceipt = p.status === "COMPLETED";

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const { width } = page.getSize();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const navy = rgb(18 / 255, 53 / 255, 122 / 255);
  const orange = rgb(232 / 255, 82 / 255, 10 / 255);
  const ink = rgb(23 / 255, 32 / 255, 51 / 255);
  const muted = rgb(102 / 255, 112 / 255, 133 / 255);
  const lavender = rgb(232 / 255, 234 / 255, 246 / 255);

  page.drawRectangle({ x: 0, y: 770, width, height: 72, color: navy });
  page.drawRectangle({ x: 0, y: 766, width, height: 4, color: orange });
  page.drawText(branding.siteName, { x: 40, y: 806, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText(branding.contact.address.replace(/\n/g, ", "), { x: 40, y: 788, size: 9, font: regular, color: rgb(0.85, 0.88, 0.97) });
  const title = isReceipt ? "PAYMENT RECEIPT" : "PROFORMA INVOICE";
  page.drawText(title, { x: width - 40 - bold.widthOfTextAtSize(title, 14), y: 800, size: 14, font: bold, color: rgb(1, 1, 1) });

  let y = 730;
  const label = (t: string, x: number, yy: number) => page.drawText(t, { x, y: yy, size: 8.5, font: regular, color: muted });
  const value = (t: string, x: number, yy: number, size = 11) => page.drawText(t, { x, y: yy, size, font: bold, color: ink });

  label(isReceipt ? "Receipt No." : "Invoice No.", 40, y);
  value(isReceipt ? (p.receiptNo ?? p.paymentNo) : p.invoiceNo, 40, y - 14);
  label("Payment No.", 220, y);
  value(p.paymentNo, 220, y - 14);
  label("Date", 400, y);
  value(formatDateTime(p.paidAt ?? p.createdAt), 400, y - 14, 10);

  y -= 50;
  label("Received from", 40, y);
  value(p.student.name, 40, y - 14);
  page.drawText([p.student.studentId ? `Student ID: ${p.student.studentId}` : null, p.student.mobile ? `Mobile: ${p.student.mobile}` : null].filter(Boolean).join("   "), { x: 40, y: y - 28, size: 9, font: regular, color: muted });
  label("For", 320, y);
  value(p.application.course.name, 320, y - 14, 10.5);
  page.drawText(`Application ${p.application.applicationNo}`, { x: 320, y: y - 28, size: 9, font: regular, color: muted });
  page.drawText(`${p.application.center.name} (${p.application.center.code})`, { x: 320, y: y - 40, size: 9, font: regular, color: muted });

  y -= 80;
  page.drawRectangle({ x: 40, y: y - 6, width: width - 80, height: 22, color: lavender });
  page.drawText("Description", { x: 48, y, size: 9.5, font: bold, color: navy });
  page.drawText("Amount", { x: width - 48 - bold.widthOfTextAtSize("Amount", 9.5), y, size: 9.5, font: bold, color: navy });
  y -= 26;
  const fees = p.application.fees;
  const originalFee = toNumber(p.application.originalFee);
  const scholarship = toNumber(p.application.scholarshipAmount);
  const discount = toNumber(p.application.discountAmount);
  const payable = toNumber(p.application.payableAmount);
  const paid = toNumber(p.application.paidAmount);
  const line = (desc: string, amt: string, strong = false) => {
    page.drawText(desc, { x: 48, y, size: 10, font: strong ? bold : regular, color: ink });
    page.drawText(amt, { x: width - 48 - (strong ? bold : regular).widthOfTextAtSize(amt, 10), y, size: 10, font: strong ? bold : regular, color: ink });
    y -= 18;
  };
  for (const f of fees) line(f.description, rs(toNumber(f.amount)));
  if (fees.length === 0) line("Course fee", rs(originalFee));
  page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: width - 40, y: y + 8 }, thickness: 0.5, color: muted });
  line("Total fee", rs(originalFee), true);
  if (scholarship > 0) line("Less: Scholarship", `- ${rs(scholarship)}`);
  if (discount > 0) line("Less: Discount", `- ${rs(discount)}`);
  line("Payable fee", rs(payable), true);
  y -= 6;
  page.drawRectangle({ x: 40, y: y - 8, width: width - 80, height: 26, color: navy });
  page.drawText(isReceipt ? "Amount received (this payment)" : "Amount due (this invoice)", { x: 48, y, size: 11, font: bold, color: rgb(1, 1, 1) });
  const amtText = rs(toNumber(p.amount));
  page.drawText(amtText, { x: width - 48 - bold.widthOfTextAtSize(amtText, 12), y, size: 12, font: bold, color: rgb(1, 1, 1) });
  y -= 34;
  page.drawText(`Payment method: ${titleCase(p.method)}${p.referenceNo ? `   Reference: ${p.referenceNo}` : ""}${p.gatewayPaymentId ? `   Gateway ID: ${p.gatewayPaymentId}` : ""}`, { x: 40, y, size: 9, font: regular, color: muted });
  y -= 14;
  page.drawText(`Total paid so far: ${rs(paid)}   Balance due: ${rs(Math.max(0, payable - paid))}`, { x: 40, y, size: 9, font: regular, color: muted });
  y -= 14;
  page.drawText(`Status: ${titleCase(p.status)}`, { x: 40, y, size: 9, font: bold, color: isReceipt ? rgb(0.07, 0.55, 0.32) : orange });

  page.drawText("This is a computer generated document and does not require a signature.", { x: 40, y: 60, size: 8, font: regular, color: muted });
  page.drawText(`${branding.contact.email}  |  ${branding.contact.phone}`, { x: 40, y: 48, size: 8, font: regular, color: muted });

  const bytes = await doc.save();
  return { buffer: Buffer.from(bytes), filename: `${isReceipt ? (p.receiptNo ?? p.paymentNo) : p.invoiceNo}.pdf` };
}
