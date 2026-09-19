import type { ApplicationStatus } from "@/generated/prisma/enums";
import { formatINR } from "@/lib/utils";

/** Minimal application shape the helpers need (works with list rows and the detail object). */
export interface ApplicationLike {
  id: string;
  status: ApplicationStatus | string;
  payableAmount: number;
  paidAmount: number;
  batchId?: string | null;
  waitlistPosition?: number | null;
  rejectionReason?: string | null;
  documentsRequestNote?: string | null;
  installmentsAllowed?: boolean;
  missingDocuments?: { name: string }[] | string[];
}

export interface NextAction {
  label: string;
  href: string;
  tone: "orange" | "navy" | "neutral" | "success" | "danger";
  /** true when the student must do something */
  actionable: boolean;
}

export const CANCELLABLE_STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "WAITLISTED"];
export const PAYABLE_STATUSES = ["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED"];

export function dueAmount(app: Pick<ApplicationLike, "payableAmount" | "paidAmount">) {
  return Math.max(0, app.payableAmount - app.paidAmount);
}

export function canPayNow(app: ApplicationLike) {
  return dueAmount(app) > 0.005 && PAYABLE_STATUSES.includes(app.status);
}

function missingCount(app: ApplicationLike) {
  return app.missingDocuments?.length ?? 0;
}

/** The single most useful thing the student can do next for an application. */
export function nextAction(app: ApplicationLike): NextAction {
  const detail = `/student/applications/${app.id}`;
  const pay = `/student/payments/${app.id}`;
  const due = dueAmount(app);
  switch (app.status) {
    case "DRAFT":
      return missingCount(app) > 0
        ? { label: `Upload ${missingCount(app)} document${missingCount(app) === 1 ? "" : "s"} & submit`, href: detail, tone: "orange", actionable: true }
        : { label: "Submit application", href: detail, tone: "orange", actionable: true };
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return { label: "Awaiting review", href: detail, tone: "navy", actionable: false };
    case "DOCUMENTS_REQUIRED":
      return { label: "Upload requested documents", href: detail, tone: "orange", actionable: true };
    case "APPROVED":
      return due > 0 ? { label: `Pay fee ${formatINR(due)}`, href: pay, tone: "orange", actionable: true } : { label: "Awaiting batch allocation", href: detail, tone: "navy", actionable: false };
    case "PAYMENT_PENDING":
      return { label: `Pay fee ${formatINR(due)}`, href: pay, tone: "orange", actionable: true };
    case "PAYMENT_COMPLETED":
      return { label: "Awaiting admission confirmation", href: detail, tone: "navy", actionable: false };
    case "ADMISSION_CONFIRMED":
      return due > 0 ? { label: `Pay balance ${formatINR(due)}`, href: pay, tone: "orange", actionable: true } : { label: "Admitted – view training", href: "/student/timetable", tone: "success", actionable: false };
    case "WAITLISTED":
      return { label: app.waitlistPosition ? `Waitlisted (#${app.waitlistPosition})` : "Waitlisted", href: detail, tone: "navy", actionable: false };
    case "REJECTED":
      return { label: "Not selected", href: detail, tone: "danger", actionable: false };
    case "CANCELLED":
      return { label: "Cancelled", href: detail, tone: "neutral", actionable: false };
    case "COMPLETED":
      return { label: "Training completed", href: "/student/certificates", tone: "success", actionable: false };
    default:
      return { label: "View", href: detail, tone: "neutral", actionable: false };
  }
}

export interface StatusMessage {
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "danger";
}

/** Student-friendly explanation of the current status, including waitlist position, rejection reason and document notes. */
export function statusMessage(app: ApplicationLike): StatusMessage {
  const due = dueAmount(app);
  switch (app.status) {
    case "DRAFT":
      return {
        tone: "warning",
        title: "Your application is not submitted yet",
        body: missingCount(app) > 0 ? "Upload the required documents below, then press Submit application. The Foundation only reviews submitted applications." : "All required documents are uploaded. Review the details and press Submit application.",
      };
    case "SUBMITTED":
      return { tone: "info", title: "Application received", body: "Thank you. The Foundation will review your application and documents shortly. You will be notified of every update." };
    case "UNDER_REVIEW":
      return { tone: "info", title: "Under review", body: "Our team is reviewing your application. This usually takes a few working days. No action is needed from you right now." };
    case "DOCUMENTS_REQUIRED":
      return { tone: "warning", title: "Documents required", body: app.documentsRequestNote ? `The Foundation has asked for: ${app.documentsRequestNote}` : "The Foundation has asked you to upload or replace some documents. Once uploaded, your application returns to review automatically." };
    case "APPROVED":
      return { tone: "success", title: "Application approved", body: due > 0 ? `Congratulations! Please pay the fee of ${formatINR(due)} to confirm your seat.` : app.batchId ? "Congratulations! Your admission will be confirmed shortly." : "Congratulations! A batch will be allocated to you shortly and you will be notified." };
    case "PAYMENT_PENDING":
      return { tone: "warning", title: "Fee payment pending", body: `Your seat is reserved. Please pay ${formatINR(due)}${app.installmentsAllowed ? " (installments allowed)" : ""} to confirm your admission.` };
    case "PAYMENT_COMPLETED":
      return { tone: "success", title: "Payment received", body: "Your fee has been received. The Foundation will confirm your admission and issue your Student ID shortly." };
    case "ADMISSION_CONFIRMED":
      return { tone: "success", title: "Admission confirmed", body: due > 0 ? `You are admitted. A balance of ${formatINR(due)} is still due – please pay it before the next installment date.` : "You are admitted. Check your timetable and attend classes regularly – a minimum attendance is required for the certificate." };
    case "WAITLISTED":
      return { tone: "warning", title: "You are on the waitlist", body: `${app.waitlistPosition ? `Your position is #${app.waitlistPosition}. ` : ""}Seats in this batch are full right now. We will move your application forward as soon as a seat opens, or offer you another batch.` };
    case "REJECTED":
      return { tone: "danger", title: "Application not selected", body: app.rejectionReason ? `Reason: ${app.rejectionReason}` : "Unfortunately your application was not selected this time. You are welcome to apply for another course or center." };
    case "CANCELLED":
      return { tone: "info", title: "Application cancelled", body: "This application was cancelled. You can start a new application at any time." };
    case "COMPLETED":
      return { tone: "success", title: "Training completed", body: "Congratulations on completing your course! Your certificate is available once issued by the Foundation." };
    default:
      return { tone: "info", title: String(app.status), body: "" };
  }
}

export const HISTORY_TONES: Record<string, "orange" | "navy" | "success" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  SUBMITTED: "navy",
  UNDER_REVIEW: "navy",
  DOCUMENTS_REQUIRED: "orange",
  APPROVED: "success",
  PAYMENT_PENDING: "orange",
  PAYMENT_COMPLETED: "success",
  ADMISSION_CONFIRMED: "success",
  WAITLISTED: "orange",
  REJECTED: "danger",
  CANCELLED: "neutral",
  COMPLETED: "success",
};

/* ───────────── Milestone tracker (mobile home + application detail) ───────────── */

export const TRACKER_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "documents", label: "Documents verified" },
  { key: "payment", label: "Payment" },
  { key: "admission", label: "Admission confirmed" },
] as const;

export type TrackerStepKey = (typeof TRACKER_STEPS)[number]["key"];

export interface TrackerState {
  /** Number of milestones already completed (nodes `0 … done-1` render as ticks). */
  done: number;
  /** Index of the milestone in progress, or `TRACKER_STEPS.length` when everything is done. */
  current: number;
  /** REJECTED / CANCELLED: the journey stopped at `current`. */
  failed: boolean;
  /** Colour of the node in progress: orange normally, amber when the student must act, red when failed. */
  tone: "orange" | "warning" | "danger";
  /** Short caption under the tracker. */
  hint: string;
}

/** Maps an application status onto the four milestones shown by <ApplicationTracker>. */
export function trackerState(app: Pick<ApplicationLike, "status" | "waitlistPosition">): TrackerState {
  const base = { done: 0, current: 0, failed: false, tone: "orange" as const };
  switch (app.status) {
    case "DRAFT":
      return { ...base, hint: "Submit your application to start the review." };
    case "SUBMITTED":
      return { ...base, done: 1, current: 1, hint: "Received – your documents will be verified next." };
    case "UNDER_REVIEW":
      return { ...base, done: 1, current: 1, hint: "The Foundation is verifying your documents." };
    case "WAITLISTED":
      return { ...base, done: 1, current: 1, tone: "warning", hint: app.waitlistPosition ? `Waitlisted at position #${app.waitlistPosition}.` : "Waitlisted until a seat opens." };
    case "DOCUMENTS_REQUIRED":
      return { ...base, done: 1, current: 1, tone: "warning", hint: "Documents requested – upload them to continue." };
    case "APPROVED":
      return { ...base, done: 2, current: 2, hint: "Approved – pay the fee to confirm your seat." };
    case "PAYMENT_PENDING":
      return { ...base, done: 2, current: 2, tone: "warning", hint: "Fee payment pending." };
    case "PAYMENT_COMPLETED":
      return { ...base, done: 3, current: 3, hint: "Payment received – admission is being confirmed." };
    case "ADMISSION_CONFIRMED":
      return { ...base, done: 4, current: 4, hint: "Admission confirmed. Welcome aboard!" };
    case "COMPLETED":
      return { ...base, done: 4, current: 4, hint: "Course completed." };
    case "REJECTED":
      return { ...base, done: 1, current: 1, failed: true, tone: "danger", hint: "This application was not selected." };
    case "CANCELLED":
      return { ...base, done: 1, current: 1, failed: true, tone: "danger", hint: "This application was cancelled." };
    default:
      return { ...base, hint: "" };
  }
}
