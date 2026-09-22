import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { NotificationChannel, NotificationStatus, AnnouncementAudience } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/session";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { DEFAULT_TEMPLATES, notify, renderTemplate, type NotifyEvent } from "@/lib/notifications";
import { getSettingsGroup } from "@/lib/settings";
import { uuid } from "@/lib/validation/common";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalDate } from "@/lib/api/query";

export interface Ctx {
  user: AuthUser;
  ip?: string | null;
  userAgent?: string | null;
}

export const NOTIFY_EVENTS = Object.keys(DEFAULT_TEMPLATES) as NotifyEvent[];
export const TEMPLATE_CHANNELS: NotificationChannel[] = ["EMAIL", "SMS", "WHATSAPP", "IN_APP"];
const RESENDABLE: NotificationChannel[] = ["EMAIL", "SMS", "WHATSAPP"];
/** Login codes are stored redacted and expire in minutes: resending one from the log is never right. */
const NOT_RESENDABLE_EVENTS = new Set(["LOGIN_OTP"]);
const eventOf = (templateKey: string | null) => templateKey?.split(":")[0] ?? "";

/** Which outbound channels are switched on in Settings → Communication. */
export async function enabledChannels(): Promise<{ EMAIL: boolean; SMS: boolean; WHATSAPP: boolean }> {
  const s = await getSettingsGroup("comms");
  return {
    EMAIL: s["comms.emailEnabled"] === true || (!!process.env.SMTP_HOST && s["comms.emailEnabled"] !== false),
    SMS: s["comms.smsEnabled"] === true,
    WHATSAPP: s["comms.whatsappEnabled"] === true,
  };
}

// ───────────────────────────── Sent log ─────────────────────────────

export const sentLogSchema = paginationSchema.extend({
  channel: z.string().optional(),
  status: z.string().optional(),
  event: z.string().trim().max(60).optional(),
  from: optionalDate,
  to: optionalDate,
});

export async function listSentLog(q: z.infer<typeof sentLogSchema>) {
  const where: Prisma.NotificationWhereInput = {};
  if (q.channel) where.channel = { in: q.channel.split(",") as NotificationChannel[] };
  if (q.status) where.status = { in: q.status.split(",") as NotificationStatus[] };
  if (q.event) where.templateKey = { startsWith: `${q.event}:` };
  if (q.from || q.to) where.createdAt = { gte: q.from, lt: q.to ? new Date(q.to.getTime() + 86400000) : undefined };
  if (q.q) where.OR = [{ title: { contains: q.q, mode: "insensitive" } }, { recipient: { contains: q.q, mode: "insensitive" } }, { user: { name: { contains: q.q, mode: "insensitive" } } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "channel", "status"] as const, "createdAt");
  const [items, total] = await Promise.all([
    db.notification.findMany({ where, orderBy, ...getPaging(q), include: { user: { select: { id: true, name: true, role: true, email: true, mobile: true } } } }),
    db.notification.count({ where }),
  ]);
  return paged(
    items.map((n) => ({ ...n, data: undefined, event: n.templateKey?.split(":")[0] ?? null, canResend: n.status === "FAILED" && RESENDABLE.includes(n.channel) && !!n.recipient && !NOT_RESENDABLE_EVENTS.has(eventOf(n.templateKey)) })),
    total,
    q
  );
}

export async function getSentNotification(id: string) {
  const n = await db.notification.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, role: true } } } });
  if (!n) throw Errors.notFound("Notification");
  return n;
}

/** Re-dispatches a FAILED EMAIL/SMS/WHATSAPP notification with its stored title/body to the same recipient. */
export async function resendNotification(id: string, ctx: Ctx) {
  const n = await db.notification.findUnique({ where: { id } });
  if (!n) throw Errors.notFound("Notification");
  if (n.status !== "FAILED") throw Errors.badRequest("Only failed notifications can be resent.");
  if (!RESENDABLE.includes(n.channel)) throw Errors.badRequest("In-app notifications cannot be resent.");
  if (!n.recipient) throw Errors.badRequest("This notification has no recipient address.");
  if (NOT_RESENDABLE_EVENTS.has(eventOf(n.templateKey))) throw Errors.badRequest("Login codes cannot be resent from the log. The student can request a new code on the login page.");
  const before = await db.notification.count();
  await notify({
    userId: n.userId,
    email: n.channel === "EMAIL" ? n.recipient : null,
    mobile: n.channel === "SMS" || n.channel === "WHATSAPP" ? n.recipient : null,
    event: "GENERIC",
    data: { title: n.title, body: n.body },
    channels: [n.channel],
  });
  const created = await db.notification.findFirst({ where: { channel: n.channel, recipient: n.recipient, title: n.title, id: { not: n.id } }, orderBy: { createdAt: "desc" } });
  await audit({ user: ctx.user, action: "resend", module: "notifications", recordType: "Notification", recordId: n.id, description: `${ctx.user.name} resent ${n.channel} notification "${n.title}" to ${n.recipient}`, newValue: { newNotificationId: created?.id ?? null, before }, ip: ctx.ip, userAgent: ctx.userAgent });
  return { id: created?.id ?? null, channel: n.channel, recipient: n.recipient };
}

// ───────────────────────────── Templates ─────────────────────────────

export const templateKey = (event: string, channel: string) => `${event}:${channel}`;

export function parseTemplateKey(key: string): { event: NotifyEvent; channel: NotificationChannel } {
  const [event, channel] = key.split(":");
  if (!event || !(event in DEFAULT_TEMPLATES)) throw Errors.notFound("Template");
  if (!channel || !TEMPLATE_CHANNELS.includes(channel as NotificationChannel)) throw Errors.notFound("Template");
  return { event: event as NotifyEvent, channel: channel as NotificationChannel };
}

function defaultFor(event: NotifyEvent, channel: NotificationChannel) {
  const def = DEFAULT_TEMPLATES[event];
  return { subject: def.subject, body: channel === "SMS" || channel === "WHATSAPP" ? def.sms : def.body };
}

export async function listTemplates() {
  const custom = await db.notificationTemplate.findMany();
  const byKey = new Map(custom.map((t) => [t.key, t]));
  return NOTIFY_EVENTS.map((event) => ({
    event,
    name: DEFAULT_TEMPLATES[event].name,
    variables: DEFAULT_TEMPLATES[event].variables,
    channels: TEMPLATE_CHANNELS.map((channel) => {
      const c = byKey.get(templateKey(event, channel));
      return { channel, key: templateKey(event, channel), custom: !!c, isActive: c?.isActive ?? true, updatedAt: c?.updatedAt ?? null };
    }),
  }));
}

export async function getTemplate(key: string) {
  const { event, channel } = parseTemplateKey(key);
  const def = DEFAULT_TEMPLATES[event];
  const custom = await db.notificationTemplate.findUnique({ where: { key } });
  const defaults = defaultFor(event, channel);
  return {
    key,
    event,
    channel,
    name: def.name,
    variables: def.variables,
    defaults,
    custom: custom ? { subject: custom.subject, body: custom.body, isActive: custom.isActive, updatedAt: custom.updatedAt } : null,
    subject: custom?.subject ?? defaults.subject,
    body: custom?.body ?? defaults.body,
    isActive: custom?.isActive ?? true,
    sample: sampleData(def.variables),
  };
}

export function sampleData(variables: string[]): Record<string, string> {
  const samples: Record<string, string> = {
    name: "Asha Kumari", siteName: "EduSkill India Foundation", link: "https://eduskillindia.org/reset-password?token=abc123", applicationNo: "APP-2026-000123", course: "Digital Literacy Foundation", center: "EduSkill Center Varanasi", status: "Under Review",
    note: "Please upload your Aadhaar card.", scholarshipAmount: "₹1,500", payableAmount: "₹1,000", amount: "₹1,000", paymentNo: "PAY-2026-000045", receiptNo: "RCPT-2026-000045", studentId: "ESK-ST-000123", batch: "Morning Batch",
    schedule: "Mon–Fri · 10:00–12:00", attendancePct: "62", requiredPct: "75", certificateNo: "ESK-CERT-2026-000010", verifyUrl: "https://eduskillindia.org/verify/ESK-CERT-2026-000010", level: "Block", trainerId: "ESK-TR-00012",
    credentials: "\n\nLogin: asha@example.com\nTemporary password: Xy7abc9", details: " for batch Morning Batch (Digital Literacy Foundation)", ticketNo: "TKT-000031", message: "We have updated your batch timing.", title: "Holiday notice", body: "Centers remain closed on 2 October.",
  };
  const out: Record<string, string> = {};
  for (const v of variables) out[v] = samples[v] ?? `{${v}}`;
  return out;
}

export const templateSchema = z.object({
  subject: z.string().trim().max(300).optional().nullable(),
  body: z.string().trim().min(1, "Enter the message body").max(10_000),
  isActive: z.coerce.boolean().default(true),
});

export async function saveTemplate(key: string, input: z.infer<typeof templateSchema>, ctx: Ctx) {
  const { event, channel } = parseTemplateKey(key);
  const def = DEFAULT_TEMPLATES[event];
  const needsSubject = channel === "EMAIL" || channel === "IN_APP";
  if (needsSubject && !input.subject) throw Errors.validation("Please correct the highlighted fields.", { subject: "Subject is required for this channel" });
  const unknown = [...input.body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]!).filter((v) => !def.variables.includes(v) && v !== "siteName");
  if (unknown.length) throw Errors.validation("Please correct the highlighted fields.", { body: `Unknown variable(s): ${[...new Set(unknown)].map((v) => `{{${v}}}`).join(", ")}` });
  const before = await db.notificationTemplate.findUnique({ where: { key } });
  const row = await db.notificationTemplate.upsert({
    where: { key },
    create: { key, name: `${def.name} (${channel})`, event, channel, subject: needsSubject ? input.subject : (input.subject || null), body: input.body, variables: def.variables, isActive: input.isActive },
    update: { subject: needsSubject ? input.subject : (input.subject || null), body: input.body, variables: def.variables, isActive: input.isActive },
  });
  await audit({ user: ctx.user, action: before ? "update" : "create", module: "notifications", recordType: "NotificationTemplate", recordId: row.id, description: `${ctx.user.name} ${before ? "updated" : "created"} ${channel} template for "${def.name}"`, oldValue: before, newValue: row, ip: ctx.ip, userAgent: ctx.userAgent });
  return row;
}

export async function deleteTemplate(key: string, ctx: Ctx) {
  const { event, channel } = parseTemplateKey(key);
  const before = await db.notificationTemplate.findUnique({ where: { key } });
  if (!before) throw Errors.notFound("Custom template");
  await db.notificationTemplate.delete({ where: { key } });
  await audit({ user: ctx.user, action: "delete", module: "notifications", recordType: "NotificationTemplate", recordId: before.id, description: `${ctx.user.name} restored the default ${channel} template for "${DEFAULT_TEMPLATES[event].name}"`, oldValue: before, ip: ctx.ip, userAgent: ctx.userAgent });
}

export function previewTemplate(subject: string | null | undefined, body: string, variables: string[]) {
  const data = sampleData(variables);
  return { subject: subject ? renderTemplate(subject, data) : "", body: renderTemplate(body, data) };
}

// ───────────────────────────── Announcements ─────────────────────────────

export const announcementSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a title").max(200),
    body: z.string().trim().min(5, "Write the announcement").max(5000),
    audience: z.enum(["ALL", "STUDENTS", "TRAINERS", "CENTER", "BATCH"]),
    centerId: z.union([z.literal(""), uuid]).optional().nullable(),
    batchId: z.union([z.literal(""), uuid]).optional().nullable(),
    publish: z.coerce.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (d.audience === "CENTER" && !d.centerId) ctx.addIssue({ code: "custom", path: ["centerId"], message: "Select a training center" });
    if (d.audience === "BATCH" && !d.batchId) ctx.addIssue({ code: "custom", path: ["batchId"], message: "Select a batch" });
  });
export type AnnouncementInput = z.infer<typeof announcementSchema>;

export async function listAnnouncements(q: { page: number; limit: number }) {
  const [items, total] = await Promise.all([
    db.announcement.findMany({ orderBy: { createdAt: "desc" }, ...getPaging(q), include: { center: { select: { id: true, name: true, code: true } }, batch: { select: { id: true, name: true, code: true } } } }),
    db.announcement.count(),
  ]);
  const creatorIds = [...new Set(items.map((a) => a.createdById).filter((v): v is string => !!v))];
  const creators = creatorIds.length ? await db.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(creators.map((c) => [c.id, c.name]));
  return paged(items.map((a) => ({ ...a, createdBy: a.createdById ? (names.get(a.createdById) ?? null) : null })), total, q);
}

/** Resolves the set of user ids that should receive an announcement. */
export async function resolveAudience(audience: AnnouncementAudience, centerId?: string | null, batchId?: string | null): Promise<string[]> {
  const ids = new Set<string>();
  const add = (rows: { userId: string }[]) => rows.forEach((r) => ids.add(r.userId));
  switch (audience) {
    case "ALL": {
      const users = await db.user.findMany({ where: { status: "ACTIVE", deletedAt: null }, select: { id: true } });
      users.forEach((u) => ids.add(u.id));
      break;
    }
    case "STUDENTS": {
      add(await db.student.findMany({ where: { deletedAt: null, user: { status: "ACTIVE", deletedAt: null }, OR: [{ admissions: { some: { status: "ACTIVE" } } }, { applications: { some: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "WAITLISTED"] } } } }] }, select: { userId: true } }));
      break;
    }
    case "TRAINERS": {
      add(await db.trainer.findMany({ where: { deletedAt: null, status: "ACTIVE", user: { status: "ACTIVE", deletedAt: null } }, select: { userId: true } }));
      break;
    }
    case "CENTER": {
      if (!centerId) break;
      const [students, trainers] = await Promise.all([
        db.student.findMany({ where: { deletedAt: null, user: { status: "ACTIVE", deletedAt: null }, admissions: { some: { status: "ACTIVE", centerId } } }, select: { userId: true } }),
        db.trainer.findMany({ where: { deletedAt: null, status: "ACTIVE", user: { status: "ACTIVE", deletedAt: null }, assignments: { some: { isActive: true, centerId } } }, select: { userId: true } }),
      ]);
      add(students);
      add(trainers);
      break;
    }
    case "BATCH": {
      if (!batchId) break;
      const [students, batch] = await Promise.all([
        db.student.findMany({ where: { deletedAt: null, user: { status: "ACTIVE", deletedAt: null }, admissions: { some: { status: { in: ["ACTIVE", "ON_HOLD"] }, batchId } } }, select: { userId: true } }),
        db.batch.findUnique({ where: { id: batchId }, select: { trainer: { select: { userId: true } } } }),
      ]);
      add(students);
      if (batch?.trainer) ids.add(batch.trainer.userId);
      break;
    }
  }
  return [...ids];
}

export async function createAnnouncement(input: AnnouncementInput, ctx: Ctx) {
  let center: { id: string; name: string } | null = null;
  let batch: { id: string; name: string; centerId: string } | null = null;
  if (input.audience === "CENTER") {
    center = await db.center.findFirst({ where: { id: input.centerId!, deletedAt: null }, select: { id: true, name: true } });
    if (!center) throw Errors.validation("Please correct the highlighted fields.", { centerId: "Select a valid training center" });
  }
  if (input.audience === "BATCH") {
    batch = await db.batch.findFirst({ where: { id: input.batchId!, deletedAt: null }, select: { id: true, name: true, centerId: true } });
    if (!batch) throw Errors.validation("Please correct the highlighted fields.", { batchId: "Select a valid batch" });
  }
  const announcement = await db.announcement.create({
    data: { title: input.title, body: input.body, audience: input.audience, centerId: center?.id ?? (batch?.centerId ?? null), batchId: batch?.id ?? null, isPublished: input.publish, createdById: ctx.user.id },
  });
  let recipients = 0;
  if (input.publish) {
    const userIds = await resolveAudience(input.audience, center?.id, batch?.id);
    recipients = userIds.length;
    const CHUNK = 25;
    for (let i = 0; i < userIds.length; i += CHUNK) {
      await Promise.all(userIds.slice(i, i + CHUNK).map((userId) => notify({ userId, event: "ANNOUNCEMENT", data: { title: input.title, body: input.body }, channels: ["IN_APP"] })));
    }
  }
  const target = input.audience === "CENTER" ? ` at ${center?.name}` : input.audience === "BATCH" ? ` in batch ${batch?.name}` : "";
  await audit({ user: ctx.user, action: input.publish ? "publish" : "create", module: "notifications", recordType: "Announcement", recordId: announcement.id, description: `${ctx.user.name} ${input.publish ? "published" : "saved"} announcement "${input.title}" for ${input.audience.toLowerCase()}${target}${input.publish ? ` (${recipients} recipient${recipients === 1 ? "" : "s"})` : ""}`, newValue: { ...announcement, recipients }, ip: ctx.ip, userAgent: ctx.userAgent });
  return { ...announcement, recipients };
}

export async function publishAnnouncement(id: string, ctx: Ctx) {
  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) throw Errors.notFound("Announcement");
  if (a.isPublished) throw Errors.badRequest("This announcement is already published.");
  const userIds = await resolveAudience(a.audience, a.centerId, a.batchId);
  for (let i = 0; i < userIds.length; i += 25) {
    await Promise.all(userIds.slice(i, i + 25).map((userId) => notify({ userId, event: "ANNOUNCEMENT", data: { title: a.title, body: a.body }, channels: ["IN_APP"] })));
  }
  await db.announcement.update({ where: { id }, data: { isPublished: true } });
  await audit({ user: ctx.user, action: "publish", module: "notifications", recordType: "Announcement", recordId: id, description: `${ctx.user.name} published announcement "${a.title}" (${userIds.length} recipients)`, newValue: { recipients: userIds.length }, ip: ctx.ip, userAgent: ctx.userAgent });
  return { recipients: userIds.length };
}

export async function deleteAnnouncement(id: string, ctx: Ctx) {
  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) throw Errors.notFound("Announcement");
  await db.announcement.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "notifications", recordType: "Announcement", recordId: id, description: `${ctx.user.name} deleted announcement "${a.title}"`, oldValue: a, ip: ctx.ip, userAgent: ctx.userAgent });
}

/** Pickers for announcement targeting. */
export async function announcementTargets() {
  const [centers, batches] = await Promise.all([
    db.center.findMany({ where: { deletedAt: null, status: { in: ["ACTIVE", "PENDING"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    db.batch.findMany({ where: { deletedAt: null, status: { in: ["UPCOMING", "ONGOING"] } }, orderBy: [{ status: "asc" }, { startDate: "desc" }], select: { id: true, name: true, code: true, status: true, center: { select: { name: true } }, course: { select: { name: true } } } }),
  ]);
  return { centers, batches };
}

// ───────────────────────────── Direct message ─────────────────────────────

export const userSearchSchema = z.object({ q: z.string().trim().min(2, "Type at least 2 characters").max(100) });

export async function searchUsers(q: string) {
  const users = await db.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q.replace(/\D/g, "") || q } },
        { student: { studentId: { contains: q, mode: "insensitive" } } },
        { trainer: { trainerId: { contains: q, mode: "insensitive" } } },
      ],
    },
    take: 10,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, mobile: true, role: true, status: true, student: { select: { studentId: true } }, trainer: { select: { trainerId: true } } },
  });
  return users.map((u) => ({ id: u.id, name: u.name, email: u.email, mobile: u.mobile, role: u.role, status: u.status, code: u.student?.studentId ?? u.trainer?.trainerId ?? null }));
}

export const sendMessageSchema = z.object({
  userId: uuid,
  channels: z.array(z.enum(["IN_APP", "EMAIL", "SMS", "WHATSAPP"])).min(1, "Choose at least one channel"),
  subject: z.string().trim().min(2, "Enter a subject").max(200),
  body: z.string().trim().min(2, "Write the message").max(5000),
});

export async function sendDirectMessage(input: z.infer<typeof sendMessageSchema>, ctx: Ctx) {
  const user = await db.user.findFirst({ where: { id: input.userId, deletedAt: null }, select: { id: true, name: true, email: true, mobile: true } });
  if (!user) throw Errors.notFound("User");
  const enabled = await enabledChannels();
  const channels = new Set<NotificationChannel>(["IN_APP"]);
  const errors: Record<string, string> = {};
  for (const c of input.channels) {
    if (c === "IN_APP") continue;
    if (!enabled[c]) errors.channels = `${c === "EMAIL" ? "Email" : c === "SMS" ? "SMS" : "WhatsApp"} is not enabled in Settings → Communication`;
    else if (c === "EMAIL" && !user.email) errors.channels = "This user has no email address";
    else if ((c === "SMS" || c === "WHATSAPP") && !user.mobile) errors.channels = "This user has no mobile number";
    else channels.add(c);
  }
  if (Object.keys(errors).length) throw Errors.validation("Please correct the highlighted fields.", errors);
  await notify({ userId: user.id, email: user.email, mobile: user.mobile, event: "GENERIC", data: { title: input.subject, body: input.body }, channels: [...channels] });
  await audit({ user: ctx.user, action: "send", module: "notifications", recordType: "User", recordId: user.id, description: `${ctx.user.name} sent message "${input.subject}" to ${user.name} via ${[...channels].join(", ")}`, newValue: { subject: input.subject, channels: [...channels] }, ip: ctx.ip, userAgent: ctx.userAgent });
  return { channels: [...channels] };
}
