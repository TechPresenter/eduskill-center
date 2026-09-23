import * as React from "react";
import { cn, titleCase } from "@/lib/utils";

export type BadgeTone = "neutral" | "navy" | "orange" | "success" | "warning" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface text-muted border-line",
  navy: "bg-navy-soft text-navy border-navy/10",
  orange: "bg-orange-light text-orange border-orange/20",
  success: "bg-success-light text-success-dark border-success/20",
  warning: "bg-warning-light text-warning-dark border-warning/25",
  danger: "bg-danger-light text-danger border-danger/20",
  info: "bg-info-light text-info-dark border-info/20",
};

export function Badge({ tone = "neutral", className, dot, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span className={cn("text-caption inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold whitespace-nowrap", TONES[tone], className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  // generic
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
  PENDING: "warning",
  DRAFT: "neutral",
  PUBLISHED: "success",
  // Derived, never stored: a blog post that is PUBLISHED with a future publishedAt. Info-toned
  // because it is neither done (success) nor a problem (warning) — it is simply waiting.
  SCHEDULED: "info",
  ARCHIVED: "neutral",
  // applications
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  DOCUMENTS_REQUIRED: "warning",
  APPROVED: "success",
  PAYMENT_PENDING: "warning",
  PAYMENT_COMPLETED: "success",
  ADMISSION_CONFIRMED: "success",
  WAITLISTED: "warning",
  REJECTED: "danger",
  CANCELLED: "neutral",
  COMPLETED: "navy",
  // trainer applications
  SHORTLISTED: "info",
  INTERVIEW: "info",
  VERIFIED: "success",
  // payments
  PROCESSING: "info",
  FAILED: "danger",
  REFUNDED: "neutral",
  PAID: "success",
  OVERDUE: "danger",
  WAIVED: "neutral",
  // batches
  UPCOMING: "info",
  ONGOING: "success",
  // attendance
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  LEAVE: "info",
  // misc
  OPEN: "info",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "neutral",
  NEW: "info",
  ISSUED: "success",
  REVOKED: "danger",
  SENT: "success",
  READ: "neutral",
  ON_HOLD: "warning",
  DROPPED: "danger",
  GRADED: "success",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return null;
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} dot className={className}>
      {titleCase(status)}
    </Badge>
  );
}
