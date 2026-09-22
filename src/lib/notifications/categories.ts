import type { NotifyEvent } from "@/lib/notifications";

/**
 * Notification taxonomy for the in-app inbox. Pure data + helpers, safe in client components:
 * only the `NotifyEvent` *type* is imported (erased at compile time), never the notifier itself,
 * so importing this file never pulls the Prisma client into a bundle.
 */
export const NOTIFICATION_CATEGORIES = ["Application", "Admission", "Payment", "Training", "Attendance", "Certificate", "System"] as const;


export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Which inbox tab each notification event belongs to. `satisfies` keeps it exhaustive as events are added. */
export const EVENT_CATEGORY = {
  APPLICATION_SUBMITTED: "Application",
  APPLICATION_STATUS: "Application",
  DOCUMENTS_REQUIRED: "Application",
  SCHOLARSHIP_DECISION: "Application",
  ADMISSION_CONFIRMED: "Admission",
  BATCH_ALLOCATED: "Admission",
  ADMISSION_CANCELLED: "Admission",
  BATCH_CHANGED: "Admission",
  PAYMENT_PENDING: "Payment",
  PAYMENT_RECEIVED: "Payment",
  DONATION_RECEIVED: "Payment",
  TRAINING_STARTED: "Training",
  TRAINER_ASSIGNED: "Training",
  ATTENDANCE_ALERT: "Attendance",
  CERTIFICATE_ISSUED: "Certificate",
  CERTIFICATE_REVOKED: "Certificate",
  REGISTRATION: "System",
  PASSWORD_RESET: "System",
  LOGIN_OTP: "System",
  SUPPORT_REPLY: "System",
  SUPPORT_TICKET_CREATED: "System",
  ENQUIRY_RECEIVED: "System",
  ANNOUNCEMENT: "System",
  GENERIC: "System",
  STAFF_ALERT: "System",
  TRAINER_APPLICATION_SUBMITTED: "System",
  TRAINER_APPLICATION_STATUS: "System",
  TRAINER_APPROVED: "System",
  CENTRE_APPLICATION_SUBMITTED: "Application",
  CENTRE_APPLICATION_STATUS: "Application",
} satisfies Record<NotifyEvent, NotificationCategory>;

export type CategorisedEvent = keyof typeof EVENT_CATEGORY;

/** `templateKey` is stored as `${event}:${channel}`; anything unknown (or null) counts as System. */
export function categoryOf(templateKey: string | null | undefined): NotificationCategory {
  const event = templateKey?.split(":")[0] ?? "";
  return (EVENT_CATEGORY as Record<string, NotificationCategory | undefined>)[event] ?? "System";
}

/** Events that map to a category – used to build the `templateKey in (...)` filter. */
export function eventsInCategory(category: NotificationCategory): CategorisedEvent[] {
  return (Object.keys(EVENT_CATEGORY) as CategorisedEvent[]).filter((e) => EVENT_CATEGORY[e] === category);
}

/** Narrows an arbitrary query-string value to a known category. */
export function asCategory(value: string | null | undefined): NotificationCategory | undefined {
  return NOTIFICATION_CATEGORIES.find((c) => c === value);
}

/** lucide icon name per category. Plain strings keep this module icon-library free; the inbox maps them to components. */
export const CATEGORY_ICON: Record<NotificationCategory, string> = {
  Application: "ClipboardList",
  Admission: "GraduationCap",
  Payment: "CreditCard",
  Training: "BookOpen",
  Attendance: "ClipboardCheck",
  Certificate: "Award",
  System: "Bell",
};
