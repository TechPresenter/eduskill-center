"use client";

import Link from "next/link";
import { Award, Bell, BookOpen, Building2, Check, ClipboardCheck, ClipboardList, CreditCard, GraduationCap, type LucideIcon } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { IconButton } from "@/components/ui/button";
import { categoryOf, type NotificationCategory } from "@/lib/notifications/categories";

/** One row of GET /api/trainer/notifications. */
export interface TrainerNotification {
  id: string;
  title: string;
  body: string;
  templateKey?: string | null;
  data?: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

const CATEGORY_ICONS: Record<NotificationCategory, LucideIcon> = {
  Application: ClipboardList,
  Admission: GraduationCap,
  Payment: CreditCard,
  Training: BookOpen,
  Attendance: ClipboardCheck,
  Certificate: Award,
  System: Bell,
};

/** Trainer-side events get their own icon where the student taxonomy is too generic. */
const EVENT_ICONS: Record<string, LucideIcon> = {
  TRAINER_ASSIGNED: Building2,
  TRAINER_APPROVED: Building2,
  ANNOUNCEMENT: Bell,
};

/**
 * Where a notification takes the trainer. Trainer payloads carry names rather than ids (see
 * `assignTrainer` / `announceToBatch` in src/server), so the event in `templateKey` is the reliable
 * signal and any id in `data` is used when it happens to be there. A row with no sensible destination
 * stays a button that only marks itself read — it never pretends to navigate.
 */
export function trainerLinkFor(n: TrainerNotification): string | null {
  const d = n.data ?? {};
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  const batchId = str("batchId");
  if (batchId) return `/trainer/batches/${batchId}`;

  const event = n.templateKey?.split(":")[0] ?? "";
  switch (event) {
    case "TRAINER_ASSIGNED":
      return "/trainer/assignments";
    case "TRAINER_APPROVED":
    case "TRAINER_APPLICATION_STATUS":
    case "TRAINER_APPLICATION_SUBMITTED":
      return "/trainer/profile";
    case "ANNOUNCEMENT":
      return "/trainer/announcements";
    case "ATTENDANCE_ALERT":
      return "/trainer/attendance";
    case "BATCH_ALLOCATED":
    case "BATCH_CHANGED":
    case "TRAINING_STARTED":
    case "ADMISSION_CONFIRMED":
    case "ADMISSION_CANCELLED":
      return "/trainer/batches";
    case "PASSWORD_RESET":
      return "/trainer/settings";
    default:
      return null;
  }
}

export interface NotificationRowProps {
  notification: TrainerNotification;
  /** Optimistically read in this session, before the server round-trip lands. */
  read: boolean;
  onMarkRead: (id: string) => void;
}

/**
 * Inbox row, matching the student portal's inbox: a category icon tile, title, two-line body, the
 * category and timestamp, and a separate 44px "mark as read" control so tapping the row can follow
 * the deep link instead of being spent on housekeeping.
 */
export function NotificationRow({ notification: n, read, onMarkRead }: NotificationRowProps) {
  const unread = !n.readAt && !read;
  const href = trainerLinkFor(n);
  const category = categoryOf(n.templateKey);
  const event = n.templateKey?.split(":")[0] ?? "";
  const Icon = EVENT_ICONS[event] ?? CATEGORY_ICONS[category];

  const body = (
    <>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", unread ? "bg-orange-light text-orange" : "bg-lavender text-navy")}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-body", unread ? "font-bold text-navy" : "font-semibold text-ink")}>{n.title}</span>
          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-orange" aria-label="Unread" />}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-body-sm whitespace-pre-line text-muted">{n.body}</span>
        <span className="mt-0.5 block text-caption text-muted">
          {category} · {formatDateTime(n.createdAt)}
        </span>
      </span>
    </>
  );

  return (
    <li className={cn("flex items-start gap-1", unread ? "bg-orange-light/25" : "bg-white")}>
      {href ? (
        <Link href={href} onClick={() => onMarkRead(n.id)} className="flex min-h-16 min-w-0 flex-1 items-start gap-3 px-4 py-3 tap-highlight-none active:bg-surface/70">
          {body}
        </Link>
      ) : (
        <button type="button" onClick={() => onMarkRead(n.id)} className="flex min-h-16 min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left tap-highlight-none active:bg-surface/70">
          {body}
        </button>
      )}
      {unread && <IconButton aria-label={`Mark "${n.title}" as read`} icon={<Check className="h-5 w-5" />} onClick={() => onMarkRead(n.id)} className="mt-3 mr-1 shrink-0" />}
    </li>
  );
}
