import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { emailConfigStatus, sendMail, type MailAttachment } from "@/lib/notifications";
import { getSetting, getSettingsGroup } from "@/lib/settings";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readStoredFile, saveUpload } from "@/lib/storage";
import { htmlToText, isValidAddress, parseAddressList, sanitizeEmailHtml, wrapEmailLayout } from "@/lib/email/sanitize";
import { getPaging, paged, paginationSchema, optionalBool, optionalDate } from "@/lib/api/query";
import { raiseSecurityAlert } from "@/server/security-alerts";

/**
 * Admin → Send Email: compose, preview, test, send and keep a history of emails sent through the
 * Foundation's own SMTP account (info@eduskillindia.com).
 *
 *   - Permission: email.send (compose/send/drafts), email.view (history), email.templates.
 *   - HTML is sanitised on the server before preview, storage and sending (src/lib/email/sanitize).
 *   - Recipients are validated and capped (Settings → email.maxRecipients); CR/LF is refused in every
 *     header value (subject, addresses, attachment names), so no header can be injected.
 *   - More than BULK_CONFIRM_THRESHOLD recipients needs an explicit confirmation flag.
 *   - Per-admin limits: 10 sends a minute, and email.dailyLimitPerAdmin a day.
 *   - Attachments are private files under private/email/<adminId>/ — only the sender's own uploads
 *     (or those already on a draft the sender may edit) can be attached — with a total size cap
 *     (email.maxAttachmentMb). The name recipients see keeps the extension of the stored file.
 */

export interface Ctx {
  user: AuthUser;
  ip?: string | null;
  userAgent?: string | null;
}

export const BULK_CONFIRM_THRESHOLD = 10;
const ATTACHMENT_EXTS = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "png", "jpg", "jpeg", "webp", "zip"] as const;

const attachmentRef = z.object({
  key: z.string().trim().min(1).max(300),
  name: z.string().trim().min(1).max(160).refine((v) => !/[\r\n\0]/.test(v), "Invalid file name"),
  size: z.number().int().nonnegative(),
  mimeType: z.string().trim().max(120).optional().default("application/octet-stream"),
});
export type AttachmentRef = z.infer<typeof attachmentRef>;

const addressField = z.union([z.string(), z.array(z.string())]).optional().transform((v) => parseAddressList(v));

export const composeSchema = z.object({
  to: addressField,
  cc: addressField,
  bcc: addressField,
  subject: z.string().trim().min(1, "Enter a subject").max(200).refine((v) => !/[\r\n\0]/.test(v), "Subject cannot contain line breaks"),
  html: z.string().max(400_000, "The email is too long"),
  includeSignature: z.boolean().default(true),
  attachments: z.array(attachmentRef).max(10, "At most 10 attachments").default([]),
  templateId: z.string().uuid().optional().nullable(),
});
export type ComposeInput = z.infer<typeof composeSchema>;

export const sendSchema = composeSchema.extend({
  draftId: z.string().uuid().optional().nullable(),
  /** Required when the email goes to more than BULK_CONFIRM_THRESHOLD people. */
  confirmBulk: z.boolean().optional(),
});

export const testSchema = composeSchema.extend({
  testTo: z.string().trim().toLowerCase().refine((v) => isValidAddress(v), "Enter a valid email address"),
  /** The draft being tested, so its stored attachments may be sent; the draft itself is left as is. */
  draftId: z.string().uuid().optional().nullable(),
});

// ───────────────────────────── helpers ─────────────────────────────

const IST_OFFSET_MS = 330 * 60_000;

/** Midnight in India (the daily sending limit resets at 00:00 IST, whatever the server's time zone). */
export function startOfIstDay(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

async function emailLimits() {
  const s = await getSettingsGroup("email");
  const num = (k: string, d: number, min: number, max: number) => Math.min(max, Math.max(min, Number(s[k] ?? d) || d));
  return {
    maxRecipients: num("email.maxRecipients", 50, 1, 500),
    maxAttachmentMb: num("email.maxAttachmentMb", 10, 1, 20),
    dailyLimit: num("email.dailyLimitPerAdmin", 200, 1, 5000),
  };
}

function validateRecipients(input: { to: string[]; cc: string[]; bcc: string[] }, max: number) {
  const all = [...input.to, ...input.cc, ...input.bcc];
  const bad = all.filter((a) => !isValidAddress(a));
  if (bad.length) throw Errors.validation("Please correct the highlighted fields.", { to: `Not a valid email address: ${bad.slice(0, 3).join(", ")}` });
  if (input.to.length === 0) throw Errors.validation("Please correct the highlighted fields.", { to: "Add at least one recipient" });
  const unique = new Set(all);
  if (unique.size > max) throw Errors.validation("Please correct the highlighted fields.", { to: `At most ${max} recipients per email (To + CC + BCC). Split the list.` });
  return unique.size;
}

/**
 * The sender may only attach their own uploads (private/email/<their id>/…), plus the attachments
 * already stored on a draft they are allowed to edit or send (`allowedKeys` — a Super Admin working
 * on another administrator's draft).
 */
function assertOwnAttachments(refs: AttachmentRef[], ctx: Ctx, allowedKeys: ReadonlySet<string> = new Set()) {
  const prefix = `private/email/${ctx.user.id}/`;
  for (const a of refs) {
    if (a.key.includes("..")) throw Errors.forbidden("That attachment does not belong to you. Upload it again.");
    if (!a.key.startsWith(prefix) && !allowedKeys.has(a.key)) throw Errors.forbidden("That attachment does not belong to you. Upload it again.");
  }
}

/**
 * The file name recipients see. The extension always comes from the server-generated storage key —
 * the one the upload was checked against — never from the client, so `x.txt` cannot be delivered as
 * `Fee_Receipt.html`. The rest of the name is reduced to letters, digits, marks, spaces and . _ - ( ).
 */
export function normalizeAttachmentRef(a: AttachmentRef): AttachmentRef {
  const ext = (a.key.split("/").pop() ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (!(ATTACHMENT_EXTS as readonly string[]).includes(ext)) throw Errors.badRequest("That attachment type is not allowed.");
  const base =
    (a.name.split(/[\\/]/).pop() ?? "")
      .replace(/\.[^.]*$/, "")
      .replace(/[^\p{L}\p{M}\p{N} ._()-]+/gu, "_")
      .replace(/^[\s.]+|[\s.]+$/g, "")
      .slice(0, 150) || "attachment";
  return { ...a, name: `${base}.${ext}` };
}

/** Keys of the attachments stored on an existing email row. */
function storedAttachmentKeys(m: { attachments: Prisma.JsonValue }): Set<string> {
  return new Set(serializeMessage(m).attachments.map((a) => a.key).filter((k): k is string => typeof k === "string"));
}

async function loadAttachments(refs: AttachmentRef[], maxMb: number): Promise<MailAttachment[]> {
  const out: MailAttachment[] = [];
  let total = 0;
  for (const a of refs) {
    const file = await readStoredFile(a.key);
    if (!file) throw Errors.badRequest(`Attachment "${a.name}" is no longer available. Remove it and upload it again.`);
    total += file.buffer.length;
    if (total > maxMb * 1024 * 1024) throw Errors.badRequest(`Attachments are larger than ${maxMb} MB in total.`);
    out.push({ filename: a.name, content: file.buffer, contentType: file.mimeType });
  }
  return out;
}

async function signatureHtml(): Promise<string> {
  return sanitizeEmailHtml(String((await getSetting<string>("email.signatureHtml")) ?? ""));
}

/** Builds the exact HTML + text that will be sent (also used for the previews). */
export async function renderEmail(input: { html: string; includeSignature: boolean; subject?: string }) {
  const body = sanitizeEmailHtml(input.html);
  const signature = input.includeSignature ? await signatureHtml() : "";
  const html = wrapEmailLayout(body, { signatureHtml: signature || null, preheader: htmlToText(body).slice(0, 120) });
  const text = [htmlToText(body), signature ? `\n--\n${htmlToText(signature)}` : ""].join("").trim();
  return { body, html, text };
}

function serializeMessage<T extends { attachments: Prisma.JsonValue }>(m: T) {
  return { ...m, attachments: (Array.isArray(m.attachments) ? m.attachments : []) as unknown as AttachmentRef[] };
}

// ───────────────────────────── attachments ─────────────────────────────

export async function uploadEmailAttachment(file: File, ctx: Ctx) {
  const { maxAttachmentMb } = await emailLimits();
  const stored = await saveUpload(file, { folder: `email/${ctx.user.id}`, visibility: "private", allowedExts: [...ATTACHMENT_EXTS], maxMb: maxAttachmentMb });
  return { key: stored.key, name: stored.name, size: stored.size, mimeType: stored.mimeType };
}

// ───────────────────────────── drafts ─────────────────────────────

export async function saveDraft(input: ComposeInput & { draftId?: string | null }, ctx: Ctx) {
  // The draft is loaded (and its ownership checked) first: its own stored attachments may be kept
  // even when another administrator uploaded them.
  const existing = input.draftId
    ? await db.emailMessage.findFirst({ where: { id: input.draftId, status: "DRAFT", deletedAt: null }, select: { id: true, createdById: true, attachments: true } })
    : null;
  if (input.draftId) {
    if (!existing) throw Errors.notFound("Draft");
    if (existing.createdById !== ctx.user.id && ctx.user.role !== "SUPER_ADMIN") throw Errors.forbidden("You can only edit your own drafts.");
  }
  assertOwnAttachments(input.attachments, ctx, existing ? storedAttachmentKeys(existing) : undefined);
  const attachments = input.attachments.map(normalizeAttachmentRef);
  const data = {
    toAddresses: input.to,
    ccAddresses: input.cc,
    bccAddresses: input.bcc,
    subject: input.subject,
    html: sanitizeEmailHtml(input.html),
    includeSignature: input.includeSignature,
    attachments: attachments as unknown as Prisma.InputJsonValue,
    templateId: input.templateId ?? null,
  };
  if (existing) {
    return serializeMessage(await db.emailMessage.update({ where: { id: existing.id }, data }));
  }
  const draft = await db.emailMessage.create({ data: { ...data, status: "DRAFT", createdById: ctx.user.id } });
  await audit({ user: ctx.user, action: "email_draft", module: "email", recordType: "EmailMessage", recordId: draft.id, description: `${ctx.user.name} saved an email draft "${input.subject}"`, ip: ctx.ip, userAgent: ctx.userAgent });
  return serializeMessage(draft);
}

export async function deleteDraft(id: string, ctx: Ctx) {
  const d = await db.emailMessage.findFirst({ where: { id, status: "DRAFT", deletedAt: null }, select: { id: true, createdById: true, subject: true } });
  if (!d) throw Errors.notFound("Draft");
  if (d.createdById !== ctx.user.id && ctx.user.role !== "SUPER_ADMIN") throw Errors.forbidden("You can only delete your own drafts.");
  await db.emailMessage.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({ user: ctx.user, action: "email_draft_delete", module: "email", recordType: "EmailMessage", recordId: id, description: `${ctx.user.name} deleted the email draft "${d.subject}"`, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── preview / test / send ─────────────────────────────

export async function previewEmail(input: Pick<ComposeInput, "html" | "includeSignature" | "subject">) {
  const r = await renderEmail(input);
  return { html: r.html, text: r.text, sanitizedBody: r.body };
}

async function deliver(input: ComposeInput, recipients: { to: string[]; cc: string[]; bcc: string[] }, ctx: Ctx, opts: { isTest: boolean; draftId?: string | null }) {
  const status = await emailConfigStatus();
  if (!status.configured) throw Errors.badRequest("Email is not configured. A Super Admin must set up SMTP in Admin → Settings → Communication first.");
  const limits = await emailLimits();
  // The draft (when sending from one) is checked first: the attachments stored on it may be sent by
  // whoever may send the draft, even when another administrator uploaded them.
  let draftId: string | null = null;
  let draftKeys: Set<string> | undefined;
  if (opts.draftId) {
    const draft = await db.emailMessage.findFirst({ where: { id: opts.draftId, status: "DRAFT", deletedAt: null }, select: { id: true, createdById: true, attachments: true } });
    const mayUse = !!draft && (draft.createdById === ctx.user.id || ctx.user.role === "SUPER_ADMIN");
    if (!opts.isTest) {
      if (!draft) throw Errors.notFound("Draft");
      if (!mayUse) throw Errors.forbidden("You can only send your own drafts.");
      draftId = draft.id;
    }
    // A test send leaves the draft where it is; it only borrows the draft's stored attachments.
    if (draft && mayUse) draftKeys = storedAttachmentKeys(draft);
  }
  assertOwnAttachments(input.attachments, ctx, draftKeys);
  const refs = input.attachments.map(normalizeAttachmentRef);

  await enforceRateLimit(`email-send:u:${ctx.user.id}`, 10, 60);
  const sentToday = await db.emailMessage.count({ where: { sentById: ctx.user.id, sentAt: { gte: startOfIstDay() }, status: { in: ["SENT", "SENDING"] } } });
  if (sentToday >= limits.dailyLimit) throw Errors.tooMany(3600);

  const rendered = await renderEmail(input);
  const attachments = await loadAttachments(refs, limits.maxAttachmentMb);
  const subject = opts.isTest ? `[TEST] ${input.subject}` : input.subject;

  // Sending always creates a new history row. A draft it came from is removed only once the email
  // is accepted, so a failed send leaves the draft in Drafts to try again.
  const data = {
    status: "SENDING" as const,
    isTest: opts.isTest,
    toAddresses: recipients.to,
    ccAddresses: recipients.cc,
    bccAddresses: recipients.bcc,
    subject,
    html: rendered.body,
    text: rendered.text,
    includeSignature: input.includeSignature,
    attachments: refs as unknown as Prisma.InputJsonValue,
    fromAddress: status.fromAddress || null,
    replyTo: status.replyTo || null,
    templateId: input.templateId ?? null,
    sentById: ctx.user.id,
    sentAt: new Date(),
  };
  const row = await db.emailMessage.create({ data: { ...data, createdById: ctx.user.id } });

  // Only the SMTP hand-off can fail the send. Once the server has accepted the message it has gone
  // out, so a database hiccup afterwards must never report "could not be sent" (the admin would send
  // it again and every recipient would get it twice).
  let res: Awaited<ReturnType<typeof sendMail>>;
  try {
    res = await sendMail({ to: recipients.to, cc: recipients.cc, bcc: recipients.bcc, subject, text: rendered.text, html: rendered.html, attachments });
  } catch (err) {
    const error = String(err instanceof Error ? err.message : err).slice(0, 1000);
    const failed = await db.emailMessage.update({ where: { id: row.id }, data: { status: "FAILED", error } });
    await audit({ user: ctx.user, action: "email_failed", module: "email", recordType: "EmailMessage", recordId: row.id, description: `Email "${input.subject}" from ${ctx.user.name} could not be sent: ${error}`, ip: ctx.ip, userAgent: ctx.userAgent });
    return serializeMessage(failed);
  }

  const partial = res.rejected.length > 0;
  const sentData = { status: "SENT" as const, messageId: res.messageId, error: partial ? `Rejected by the server: ${res.rejected.join(", ")}`.slice(0, 1000) : null };
  const updated = await db.emailMessage.update({ where: { id: row.id }, data: sentData }).catch((e: unknown) => {
    console.error("[email] sent, but the history row could not be marked SENT", row.id, e);
    return { ...row, ...sentData };
  });
  if (draftId) {
    await db.emailMessage.update({ where: { id: draftId }, data: { deletedAt: new Date() } }).catch((e: unknown) => console.error("[email] sent, but the draft could not be removed", draftId, e));
  }
  await audit({
    user: ctx.user,
    action: opts.isTest ? "email_test" : "email_send",
    module: "email",
    recordType: "EmailMessage",
    recordId: row.id,
    description: `${ctx.user.name} ${opts.isTest ? "sent a test of" : "sent"} "${input.subject}" to ${recipients.to.length + recipients.cc.length + recipients.bcc.length} recipient(s)`,
    newValue: { to: recipients.to, cc: recipients.cc, bccCount: recipients.bcc.length, attachments: refs.map((a) => a.name), messageId: res.messageId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return serializeMessage(updated);
}

export async function sendTestComposedEmail(input: z.infer<typeof testSchema>, ctx: Ctx) {
  return deliver(input, { to: [input.testTo], cc: [], bcc: [] }, ctx, { isTest: true, draftId: input.draftId });
}

export async function sendComposedEmail(input: z.infer<typeof sendSchema>, ctx: Ctx) {
  const limits = await emailLimits();
  const count = validateRecipients(input, limits.maxRecipients);
  if (count > BULK_CONFIRM_THRESHOLD && !input.confirmBulk) {
    throw Errors.validation("Please confirm bulk sending.", { confirmBulk: `This email goes to ${count} people. Confirm to send it.` });
  }
  const result = await deliver(input, { to: input.to, cc: input.cc, bcc: input.bcc }, ctx, { isTest: false, draftId: input.draftId });
  if (count > BULK_CONFIRM_THRESHOLD) {
    await raiseSecurityAlert({ type: "BULK_EMAIL_SENT", severity: "info", title: `${ctx.user.name} sent "${input.subject}" to ${count} recipients`, detail: "Bulk email from Admin → Send Email.", userId: ctx.user.id, ip: ctx.ip, userAgent: ctx.userAgent, notifyAdmins: false });
  }
  return result;
}

// ───────────────────────────── history ─────────────────────────────

export const historySchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "SENDING", "SENT", "FAILED"]).optional(),
  scope: z.enum(["sent", "drafts", "all"]).default("sent"),
  from: optionalDate,
  to: optionalDate,
  mine: optionalBool,
});

export async function listEmails(q: z.infer<typeof historySchema>, ctx: Ctx) {
  const where: Prisma.EmailMessageWhereInput = { deletedAt: null };
  const and: Prisma.EmailMessageWhereInput[] = [];
  // Drafts are private to their author in every scope (a Super Admin sees all), and a sender without
  // email.view only ever lists their own emails — enforced here, not only by the callers.
  if (ctx.user.role !== "SUPER_ADMIN") and.push({ OR: [{ status: { not: "DRAFT" } }, { createdById: ctx.user.id }] });
  if (!hasPermission(ctx.user, "email.view")) and.push({ OR: [{ sentById: ctx.user.id }, { createdById: ctx.user.id }] });
  if (q.scope === "drafts") {
    where.status = "DRAFT";
    // Drafts are private to their author (a Super Admin sees all).
    if (ctx.user.role !== "SUPER_ADMIN") where.createdById = ctx.user.id;
  } else if (q.scope === "sent") {
    where.status = q.status && q.status !== "DRAFT" ? q.status : { in: ["SENT", "FAILED", "SENDING"] };
  } else if (q.status) where.status = q.status;
  if (q.mine) and.push({ OR: [{ sentById: ctx.user.id }, { createdById: ctx.user.id }] });
  if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
  if (q.q) {
    const term = q.q.trim().toLowerCase();
    and.push({ OR: [{ subject: { contains: q.q, mode: "insensitive" } }, { toAddresses: { has: term } }, { ccAddresses: { has: term } }, { messageId: { contains: q.q } }] });
  }
  if (and.length) where.AND = and;
  const { skip, take } = getPaging(q);
  const [rows, total] = await Promise.all([
    db.emailMessage.findMany({
      where,
      orderBy: { createdAt: q.order === "asc" ? "asc" : "desc" },
      skip,
      take,
      select: { id: true, status: true, isTest: true, toAddresses: true, ccAddresses: true, bccAddresses: true, subject: true, attachments: true, messageId: true, error: true, sentAt: true, createdAt: true, updatedAt: true, createdById: true, sentById: true },
    }),
    db.emailMessage.count({ where }),
  ]);
  const userIds = [...new Set(rows.flatMap((r) => [r.sentById, r.createdById]).filter(Boolean) as string[])];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  return paged(
    rows.map((r) => ({ ...serializeMessage(r), sentBy: r.sentById ? (nameOf.get(r.sentById) ?? "—") : null, createdBy: nameOf.get(r.createdById) ?? "—" })),
    total,
    q
  );
}

export async function getEmail(id: string, ctx: Ctx) {
  const m = await db.emailMessage.findFirst({ where: { id, deletedAt: null } });
  if (!m) throw Errors.notFound("Email");
  if (m.status === "DRAFT" && m.createdById !== ctx.user.id && ctx.user.role !== "SUPER_ADMIN") throw Errors.notFound("Email");
  // History is for email.view holders; anyone may open an email they sent themselves.
  const own = m.sentById === ctx.user.id || m.createdById === ctx.user.id;
  if (m.status !== "DRAFT" && !own && !hasPermission(ctx.user, ["email.view"])) throw Errors.forbidden();
  const users = await db.user.findMany({ where: { id: { in: [m.createdById, m.sentById].filter(Boolean) as string[] } }, select: { id: true, name: true, email: true } });
  const nameOf = new Map(users.map((u) => [u.id, u]));
  const preview = m.status === "DRAFT" ? null : (await renderEmail({ html: m.html, includeSignature: false })).html;
  return { ...serializeMessage(m), sentBy: m.sentById ? (nameOf.get(m.sentById) ?? null) : null, createdBy: nameOf.get(m.createdById) ?? null, previewHtml: preview };
}

// ───────────────────────────── templates ─────────────────────────────

export const templateInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional().nullable(),
  subject: z.string().trim().min(1).max(200).refine((v) => !/[\r\n\0]/.test(v), "Subject cannot contain line breaks"),
  html: z.string().max(400_000),
  isActive: z.boolean().default(true),
});

/** Starter layouts always offered in the composer, alongside the Foundation's own templates. */
export const STARTER_TEMPLATES = [
  {
    id: "starter-announcement",
    name: "Announcement",
    subject: "An update from EduSkill India Foundation",
    html: '<h2 style="color:#12357a;margin:0 0 12px">Important update</h2><p>Dear friends,</p><p>We are happy to share an update with you.</p><p style="margin:24px 0"><a href="https://eduskillindia.com" style="display:inline-block;background:#ea580c;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Read more</a></p><p>Thank you for being part of our journey.</p>',
  },
  {
    id: "starter-event",
    name: "Event invitation",
    subject: "You are invited: [event name]",
    html: '<h2 style="color:#12357a;margin:0 0 12px">You are invited!</h2><p>Dear [name],</p><p>We would be delighted to have you at <strong>[event name]</strong>.</p><table role="presentation" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0"><tr><td style="border:1px solid #e5e7eb"><strong>Date</strong></td><td style="border:1px solid #e5e7eb">[date]</td></tr><tr><td style="border:1px solid #e5e7eb"><strong>Time</strong></td><td style="border:1px solid #e5e7eb">[time]</td></tr><tr><td style="border:1px solid #e5e7eb"><strong>Venue</strong></td><td style="border:1px solid #e5e7eb">[venue]</td></tr></table><p style="margin:24px 0"><a href="https://eduskillindia.com/events" style="display:inline-block;background:#12357a;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Register now</a></p>',
  },
  {
    id: "starter-admission",
    name: "Admission update",
    subject: "Admissions are open at EduSkill India Foundation",
    html: '<h2 style="color:#12357a;margin:0 0 12px">Admissions are open</h2><p>Dear [name],</p><p>Admissions are now open for Class 1 to 12, competitive exam training, computer &amp; skill development and AI workshops.</p><ul><li>Class 1–4: ₹50 registration fee only</li><li>Class 5–10: ₹100 per month</li><li>Class 11–12 &amp; competitive exams: ₹300 per month</li></ul><p style="margin:24px 0"><a href="https://eduskillindia.com/courses" style="display:inline-block;background:#ea580c;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">View courses</a></p>',
  },
] as const;

export async function listEmailTemplates() {
  const rows = await db.emailTemplate.findMany({ where: { deletedAt: null }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return { starters: STARTER_TEMPLATES, templates: rows };
}

export async function createEmailTemplate(input: z.infer<typeof templateInput>, ctx: Ctx) {
  const t = await db.emailTemplate.create({ data: { ...input, html: sanitizeEmailHtml(input.html), createdById: ctx.user.id } });
  await audit({ user: ctx.user, action: "create", module: "email", recordType: "EmailTemplate", recordId: t.id, description: `${ctx.user.name} created email template "${t.name}"`, ip: ctx.ip, userAgent: ctx.userAgent });
  return t;
}

export async function updateEmailTemplate(id: string, input: z.infer<typeof templateInput>, ctx: Ctx) {
  const before = await db.emailTemplate.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw Errors.notFound("Email template");
  const t = await db.emailTemplate.update({ where: { id }, data: { ...input, html: sanitizeEmailHtml(input.html) } });
  await audit({ user: ctx.user, action: "update", module: "email", recordType: "EmailTemplate", recordId: id, description: `${ctx.user.name} updated email template "${t.name}"`, oldValue: { name: before.name, subject: before.subject }, newValue: { name: t.name, subject: t.subject }, ip: ctx.ip, userAgent: ctx.userAgent });
  return t;
}

export async function deleteEmailTemplate(id: string, ctx: Ctx) {
  const before = await db.emailTemplate.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw Errors.notFound("Email template");
  await db.emailTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({ user: ctx.user, action: "delete", module: "email", recordType: "EmailTemplate", recordId: id, description: `${ctx.user.name} deleted email template "${before.name}"`, ip: ctx.ip, userAgent: ctx.userAgent });
}

/** The composer's defaults: whether the signature box starts ticked, the From line, limits. */
export async function composerConfig() {
  const [status, limits, sigEnabled] = await Promise.all([emailConfigStatus(), emailLimits(), getSetting<boolean>("email.signatureEnabled")]);
  return {
    configured: status.configured,
    from: status.fromName ? `${status.fromName} <${status.fromAddress}>` : status.fromAddress,
    replyTo: status.replyTo,
    signatureDefault: sigEnabled !== false,
    signatureHtml: await signatureHtml(),
    bulkConfirmThreshold: BULK_CONFIRM_THRESHOLD,
    ...limits,
    attachmentExts: ATTACHMENT_EXTS,
  };
}
