import { db } from "@/lib/db";
import { getSettingsGroup } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import type { NotificationChannel } from "@/generated/prisma/enums";

export type NotifyEvent =
  | "REGISTRATION"
  | "PASSWORD_RESET"
  | "LOGIN_OTP"
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_STATUS"
  | "DOCUMENTS_REQUIRED"
  | "SCHOLARSHIP_DECISION"
  | "PAYMENT_PENDING"
  | "PAYMENT_RECEIVED"
  | "ADMISSION_CONFIRMED"
  | "BATCH_ALLOCATED"
  | "TRAINING_STARTED"
  | "ATTENDANCE_ALERT"
  | "CERTIFICATE_ISSUED"
  | "TRAINER_APPLICATION_SUBMITTED"
  | "TRAINER_APPLICATION_STATUS"
  | "TRAINER_APPROVED"
  | "TRAINER_ASSIGNED"
  | "SUPPORT_REPLY"
  | "SUPPORT_TICKET_CREATED"
  | "ENQUIRY_RECEIVED"
  | "DONATION_RECEIVED"
  | "ADMISSION_CANCELLED"
  | "BATCH_CHANGED"
  | "CERTIFICATE_REVOKED"
  | "CENTRE_APPLICATION_SUBMITTED"
  | "CENTRE_APPLICATION_STATUS"
  | "STAFF_ALERT"
  | "ANNOUNCEMENT"
  | "GENERIC";

export interface EventTemplate {
  name: string;
  subject: string;
  body: string;
  sms: string;
  variables: string[];
}

/** Built-in defaults. Admin can override any of these per channel from /admin/notifications/templates. */
export const DEFAULT_TEMPLATES: Record<NotifyEvent, EventTemplate> = {
  REGISTRATION: {
    name: "Registration welcome",
    subject: "Welcome to {{siteName}}",
    body: "Dear {{name}},\n\nYour account has been created successfully. Log in to complete your profile and apply for a course at a training center near you.\n\n{{siteName}}",
    sms: "Welcome to {{siteName}}, {{name}}! Your account is ready. Log in to complete your profile and apply.",
    variables: ["name", "siteName"],
  },
  PASSWORD_RESET: {
    name: "Password reset",
    subject: "Reset your {{siteName}} password",
    body: "Dear {{name}},\n\nUse the link below to reset your password. It expires in 30 minutes.\n\n{{link}}\n\nIf you did not request this, you can ignore this message.",
    sms: "{{siteName}}: reset your password using {{link}} (valid 30 min).",
    variables: ["name", "link", "siteName"],
  },
  LOGIN_OTP: {
    name: "Login code (admission number sign-in)",
    subject: "Your {{siteName}} login code",
    body: "Dear {{name}},\n\nYour one-time login code is {{code}}. It is valid for {{minutes}} minutes.\n\nFoundation staff will never ask you for this code. Do not share it with anyone.\n\n{{siteName}}",
    sms: "{{code}} is your {{siteName}} login code. Valid {{minutes}} min. Our staff will never ask for it - do not share it.",
    variables: ["name", "code", "minutes", "siteName"],
  },
  APPLICATION_SUBMITTED: {
    name: "Application submitted",
    subject: "Application {{applicationNo}} received",
    body: "Dear {{name}},\n\nWe have received your application {{applicationNo}} for {{course}} at {{center}}. Our team will review it and keep you updated.\n\n{{siteName}}",
    sms: "{{siteName}}: application {{applicationNo}} for {{course}} received. We will update you soon.",
    variables: ["name", "applicationNo", "course", "center", "siteName"],
  },
  APPLICATION_STATUS: {
    name: "Application status update",
    subject: "Application {{applicationNo}}: {{status}}",
    body: "Dear {{name}},\n\nThe status of your application {{applicationNo}} is now: {{status}}.\n{{note}}\n\n{{siteName}}",
    sms: "{{siteName}}: application {{applicationNo}} is now {{status}}. {{note}}",
    variables: ["name", "applicationNo", "status", "note", "siteName"],
  },
  DOCUMENTS_REQUIRED: {
    name: "Documents required",
    subject: "Documents required for application {{applicationNo}}",
    body: "Dear {{name}},\n\nPlease upload the following for application {{applicationNo}}: {{note}}\n\nLog in to your student dashboard to upload.\n\n{{siteName}}",
    sms: "{{siteName}}: documents required for {{applicationNo}}: {{note}}. Please upload from your dashboard.",
    variables: ["name", "applicationNo", "note", "siteName"],
  },
  SCHOLARSHIP_DECISION: {
    name: "Scholarship decision",
    subject: "Scholarship decision for {{applicationNo}}",
    body: "Dear {{name}},\n\nScholarship decision for application {{applicationNo}}: {{status}}.\nScholarship amount: {{scholarshipAmount}}\nPayable fee: {{payableAmount}}\n\n{{siteName}}",
    sms: "{{siteName}}: scholarship {{status}} for {{applicationNo}}. Payable fee {{payableAmount}}.",
    variables: ["name", "applicationNo", "status", "scholarshipAmount", "payableAmount", "siteName"],
  },
  PAYMENT_PENDING: {
    name: "Payment pending",
    subject: "Fee payment pending for {{applicationNo}}",
    body: "Dear {{name}},\n\nYour application {{applicationNo}} has been approved. Please pay the fee of {{amount}} to confirm your admission.\n\n{{siteName}}",
    sms: "{{siteName}}: application {{applicationNo}} approved. Pay {{amount}} to confirm admission.",
    variables: ["name", "applicationNo", "amount", "siteName"],
  },
  PAYMENT_RECEIVED: {
    name: "Payment received",
    subject: "Payment {{paymentNo}} received – receipt {{receiptNo}}",
    body: "Dear {{name}},\n\nWe have received your payment of {{amount}} (Payment {{paymentNo}}, Receipt {{receiptNo}}). Thank you.\n\n{{siteName}}",
    sms: "{{siteName}}: payment of {{amount}} received. Receipt {{receiptNo}}.",
    variables: ["name", "amount", "paymentNo", "receiptNo", "siteName"],
  },
  ADMISSION_CONFIRMED: {
    name: "Admission confirmed",
    subject: "Admission confirmed – Student ID {{studentId}}",
    body: "Dear {{name}},\n\nCongratulations! Your admission to {{course}} at {{center}} is confirmed.\nStudent ID: {{studentId}}\nBatch: {{batch}}\n\n{{siteName}}",
    sms: "{{siteName}}: admission confirmed for {{course}}. Student ID {{studentId}}, batch {{batch}}.",
    variables: ["name", "course", "center", "studentId", "batch", "siteName"],
  },
  BATCH_ALLOCATED: {
    name: "Batch allocated",
    subject: "Batch allocated: {{batch}}",
    body: "Dear {{name}},\n\nYou have been allocated to batch {{batch}} for {{course}} at {{center}}.\nSchedule: {{schedule}}\n\n{{siteName}}",
    sms: "{{siteName}}: you are allocated to batch {{batch}} ({{schedule}}).",
    variables: ["name", "batch", "course", "center", "schedule", "siteName"],
  },
  TRAINING_STARTED: {
    name: "Training started",
    subject: "Your training for {{course}} has started",
    body: "Dear {{name}},\n\nTraining for {{course}} (batch {{batch}}) has started at {{center}}. Please attend regularly.\n\n{{siteName}}",
    sms: "{{siteName}}: training for {{course}} (batch {{batch}}) has started.",
    variables: ["name", "course", "batch", "center", "siteName"],
  },
  ATTENDANCE_ALERT: {
    name: "Attendance alert",
    subject: "Attendance alert for {{course}}",
    body: "Dear {{name}},\n\nYour attendance in {{course}} is {{attendancePct}}%, below the required {{requiredPct}}%. Please attend regularly to remain eligible for certification.\n\n{{siteName}}",
    sms: "{{siteName}}: your attendance is {{attendancePct}}% (required {{requiredPct}}%). Please attend regularly.",
    variables: ["name", "course", "attendancePct", "requiredPct", "siteName"],
  },
  CERTIFICATE_ISSUED: {
    name: "Certificate issued",
    subject: "Your certificate {{certificateNo}} is ready",
    body: "Dear {{name}},\n\nCongratulations on completing {{course}}! Your certificate number is {{certificateNo}}. Download it from your dashboard or verify at {{verifyUrl}}.\n\n{{siteName}}",
    sms: "{{siteName}}: congratulations! Certificate {{certificateNo}} issued. Verify: {{verifyUrl}}",
    variables: ["name", "course", "certificateNo", "verifyUrl", "siteName"],
  },
  TRAINER_APPLICATION_SUBMITTED: {
    name: "Trainer application submitted",
    subject: "Volunteer trainer application {{applicationNo}} received",
    body: "Dear {{name}},\n\nThank you for applying to become a volunteer trainer ({{level}} level). Your application number is {{applicationNo}}. Our team will review it and get in touch.\n\n{{siteName}}",
    sms: "{{siteName}}: trainer application {{applicationNo}} received. We will review and contact you.",
    variables: ["name", "applicationNo", "level", "siteName"],
  },
  TRAINER_APPLICATION_STATUS: {
    name: "Trainer application status",
    subject: "Trainer application {{applicationNo}}: {{status}}",
    body: "Dear {{name}},\n\nYour volunteer trainer application {{applicationNo}} is now: {{status}}.\n{{note}}\n\n{{siteName}}",
    sms: "{{siteName}}: trainer application {{applicationNo}} is now {{status}}. {{note}}",
    variables: ["name", "applicationNo", "status", "note", "siteName"],
  },
  TRAINER_APPROVED: {
    name: "Trainer approved",
    subject: "Welcome aboard – Trainer ID {{trainerId}}",
    body: "Dear {{name}},\n\nCongratulations! You are now an approved volunteer trainer with {{siteName}}.\nTrainer ID: {{trainerId}}\n\nLog in with your registered email to access your trainer dashboard.{{credentials}}\n\n{{siteName}}",
    sms: "{{siteName}}: you are approved as volunteer trainer. Trainer ID {{trainerId}}. Log in to your dashboard.",
    variables: ["name", "trainerId", "credentials", "siteName"],
  },
  TRAINER_ASSIGNED: {
    name: "Trainer assignment",
    subject: "New assignment: {{center}}",
    body: "Dear {{name}},\n\nYou have been assigned to {{center}}{{details}}.\n\nPlease check your trainer dashboard for batches, timetable and students.\n\n{{siteName}}",
    sms: "{{siteName}}: you are assigned to {{center}}{{details}}. Check your dashboard.",
    variables: ["name", "center", "details", "siteName"],
  },
  SUPPORT_REPLY: {
    name: "Support reply",
    subject: "Reply on ticket {{ticketNo}}",
    body: "Dear {{name}},\n\nThere is a new reply on your support ticket {{ticketNo}}:\n\n{{message}}\n\n{{siteName}}",
    sms: "{{siteName}}: new reply on ticket {{ticketNo}}.",
    variables: ["name", "ticketNo", "message", "siteName"],
  },
  ANNOUNCEMENT: {
    name: "Announcement",
    subject: "{{title}}",
    body: "{{body}}\n\n{{siteName}}",
    sms: "{{siteName}}: {{title}}",
    variables: ["title", "body", "siteName"],
  },
  SUPPORT_TICKET_CREATED: {
    name: "Support ticket received",
    subject: "We have received your ticket {{ticketNo}}",
    body: "Dear {{name}},\n\nWe have received your support request and logged it as ticket {{ticketNo}}.\n\nSubject: {{subject}}\n\nOur team will reply to you here and by email. Please quote the ticket number in any follow-up.\n\n{{siteName}}",
    sms: "{{siteName}}: ticket {{ticketNo}} received. We will reply shortly.",
    variables: ["name", "ticketNo", "subject", "siteName"],
  },
  ENQUIRY_RECEIVED: {
    name: "Enquiry received",
    subject: "Thank you for contacting {{siteName}}",
    body: "Dear {{name}},\n\nThank you for writing to us. We have received your enquiry and a member of our team will get back to you soon.\n\nYour message:\n{{message}}\n\n{{siteName}}",
    sms: "{{siteName}}: we have received your enquiry and will get back to you soon.",
    variables: ["name", "message", "siteName"],
  },
  DONATION_RECEIVED: {
    name: "Donation received",
    subject: "Thank you for your donation ({{donationNo}})",
    body: "Dear {{name}},\n\nThank you for your generous donation of {{amount}} to {{siteName}}.\n\nDonation number: {{donationNo}}\n{{campaignLine}}\nYour contribution helps us run Normal Education Centres and skill training for children and youth across India.\n\n{{receiptLine}}\n{{siteName}}",
    sms: "{{siteName}}: thank you for your donation of {{amount}}. Donation no {{donationNo}}.",
    variables: ["name", "amount", "donationNo", "campaignLine", "receiptLine", "siteName"],
  },
  ADMISSION_CANCELLED: {
    name: "Admission cancelled",
    subject: "Your admission has been cancelled",
    body: "Dear {{name}},\n\nYour admission to {{course}} at {{center}} has been cancelled.\n\n{{note}}\n\nIf you believe this is a mistake, please contact us or raise a support ticket.\n\n{{siteName}}",
    sms: "{{siteName}}: your admission to {{course}} has been cancelled.",
    variables: ["name", "course", "center", "note", "siteName"],
  },
  BATCH_CHANGED: {
    name: "Batch or schedule changed",
    subject: "Your batch details have changed",
    body: "Dear {{name}},\n\nYour batch for {{course}} at {{center}} has been updated.\n\nBatch: {{batch}}\nSchedule: {{schedule}}\n\n{{note}}\n\n{{siteName}}",
    sms: "{{siteName}}: your batch is now {{batch}} ({{schedule}}).",
    variables: ["name", "course", "center", "batch", "schedule", "note", "siteName"],
  },
  CERTIFICATE_REVOKED: {
    name: "Certificate revoked",
    subject: "Certificate {{certificateNo}} has been revoked",
    body: "Dear {{name}},\n\nCertificate {{certificateNo}} for {{course}} has been revoked and will no longer verify as valid.\n\nReason: {{reason}}\n\nPlease contact us if you need more information.\n\n{{siteName}}",
    sms: "{{siteName}}: certificate {{certificateNo}} has been revoked.",
    variables: ["name", "certificateNo", "course", "reason", "siteName"],
  },
  CENTRE_APPLICATION_SUBMITTED: {
    name: "Centre application received",
    subject: "Centre application {{applicationNo}} received",
    body: "Dear {{name}},\n\nWe have received your application to open a Normal Education Centre (Class 1–4) at {{location}}.\n\nApplication number: {{applicationNo}}\n\nOur team will verify your documents and contact you about the next steps. You can track your application at any time using your application number and mobile number.\n\n{{siteName}}",
    sms: "{{siteName}}: centre application {{applicationNo}} received. We will contact you shortly.",
    variables: ["name", "applicationNo", "location", "siteName"],
  },
  CENTRE_APPLICATION_STATUS: {
    name: "Centre application update",
    subject: "Centre application {{applicationNo}}: {{status}}",
    body: "Dear {{name}},\n\n{{message}}\n\n{{note}}\nApplication number: {{applicationNo}}\n\n{{siteName}}",
    sms: "{{siteName}}: centre application {{applicationNo}} is now {{status}}.",
    variables: ["name", "applicationNo", "status", "message", "note", "siteName"],
  },
  STAFF_ALERT: {
    name: "Staff alert (internal)",
    subject: "[{{siteName}}] {{title}}",
    body: "{{title}}\n\n{{body}}\n\n{{link}}\n\nThis is an automatic notification for Foundation staff.",
    sms: "{{siteName}}: {{title}}",
    variables: ["title", "body", "link", "siteName"],
  },
  GENERIC: {
    name: "Generic message",
    subject: "{{title}}",
    body: "{{body}}",
    sms: "{{body}}",
    variables: ["title", "body"],
  },
};

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = data[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

export interface NotifyInput {
  userId?: string | null;
  email?: string | null;
  mobile?: string | null;
  event: NotifyEvent;
  data: Record<string, unknown>;
  /** Restrict channels. Defaults to IN_APP (+ EMAIL/SMS/WHATSAPP when enabled in settings). */
  channels?: NotificationChannel[];
  /**
   * Keys of `data` that are secrets (a one-time code). They are rendered into the message that is
   * actually dispatched, but the copy stored in the notifications table — title, body and data —
   * carries `REDACTED` instead, so the log never holds a usable secret.
   */
  redact?: string[];
}

/** What a redacted secret reads as in the stored notification log. */
export const REDACTED = "[hidden]";

interface CommsConfig {
  emailEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smsEnabled: boolean;
  smsProvider: string;
  smsApiKey: string;
  smsSenderId: string;
  smsTemplateId: string;
  smsWebhookUrl: string;
  whatsappEnabled: boolean;
  whatsappProvider: string;
  whatsappApiKey: string;
  whatsappPhoneNumberId: string;
  whatsappWebhookUrl: string;
}

async function getCommsConfig(): Promise<CommsConfig> {
  const s = await getSettingsGroup("comms");
  const str = (k: string, env?: string) => String(s[`comms.${k}`] || (env ? process.env[env] ?? "" : ""));
  const bool = (k: string) => s[`comms.${k}`] === true;
  const smtpHost = str("smtpHost", "SMTP_HOST");
  return {
    emailEnabled: bool("emailEnabled") || (!!process.env.SMTP_HOST && s["comms.emailEnabled"] !== false),
    smtpHost,
    smtpPort: Number(s["comms.smtpPort"] || process.env.SMTP_PORT || 587),
    smtpUser: str("smtpUser", "SMTP_USER"),
    smtpPass: str("smtpPass", "SMTP_PASS"),
    smtpFrom: str("smtpFrom", "SMTP_FROM"),
    smsEnabled: bool("smsEnabled"),
    smsProvider: str("smsProvider"),
    smsApiKey: str("smsApiKey"),
    smsSenderId: str("smsSenderId"),
    smsTemplateId: str("smsTemplateId"),
    smsWebhookUrl: str("smsWebhookUrl"),
    whatsappEnabled: bool("whatsappEnabled"),
    whatsappProvider: str("whatsappProvider"),
    whatsappApiKey: str("whatsappApiKey"),
    whatsappPhoneNumberId: str("whatsappPhoneNumberId"),
    whatsappWebhookUrl: str("whatsappWebhookUrl"),
  };
}

/** A provider is usable only when it is enabled AND its credentials/endpoint are filled in. */
function smsReady(cfg: CommsConfig) {
  if (!cfg.smsEnabled) return false;
  if (cfg.smsProvider === "msg91") return !!cfg.smsApiKey;
  if (cfg.smsProvider === "webhook") return !!cfg.smsWebhookUrl;
  return false;
}

function whatsappReady(cfg: CommsConfig) {
  if (!cfg.whatsappEnabled) return false;
  if (cfg.whatsappProvider === "meta") return !!cfg.whatsappApiKey && !!cfg.whatsappPhoneNumberId;
  if (cfg.whatsappProvider === "webhook") return !!cfg.whatsappWebhookUrl;
  return false;
}

/**
 * The channels that can actually reach a phone right now (SMS and/or WhatsApp), in that order.
 * Empty when neither provider is configured — callers that NEED a phone (login codes) use this to
 * fail honestly instead of pretending a message went out.
 */
export async function getPhoneChannels(): Promise<NotificationChannel[]> {
  try {
    const cfg = await getCommsConfig();
    return [...(smsReady(cfg) ? (["SMS"] as NotificationChannel[]) : []), ...(whatsappReady(cfg) ? (["WHATSAPP"] as NotificationChannel[]) : [])];
  } catch (err) {
    console.error("[notify] could not read comms settings:", err);
    return [];
  }
}

async function resolveTemplate(event: NotifyEvent, channel: NotificationChannel) {
  const def = DEFAULT_TEMPLATES[event];
  const custom = await db.notificationTemplate.findFirst({ where: { event, channel, isActive: true } });
  if (custom) return { subject: custom.subject ?? def.subject, body: custom.body };
  const body = channel === "SMS" || channel === "WHATSAPP" ? def.sms : def.body;
  return { subject: def.subject, body };
}

// ───────────── Channel senders ─────────────

async function sendEmail(cfg: CommsConfig, to: string, subject: string, text: string) {
  if (!cfg.smtpHost) throw new Error("SMTP is not configured");
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
  });
  await transporter.sendMail({
    from: cfg.smtpFrom || cfg.smtpUser,
    to,
    subject,
    text,
    html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#172033">${text
      .split("\n")
      .map((l) => (l.trim() ? `<p style="margin:0 0 10px">${escapeHtml(l)}</p>` : ""))
      .join("")}</div>`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function normalizeMobile(mobile: string) {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function sendSms(cfg: CommsConfig, to: string, message: string) {
  const mobile = normalizeMobile(to);
  if (cfg.smsProvider === "msg91") {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: cfg.smsApiKey },
      body: JSON.stringify({ template_id: cfg.smsTemplateId, sender: cfg.smsSenderId, recipients: [{ mobiles: mobile, message }] }),
    });
    if (!res.ok) throw new Error(`MSG91 error ${res.status}`);
    return;
  }
  if (cfg.smsProvider === "webhook") {
    if (!cfg.smsWebhookUrl) throw new Error("SMS webhook URL not configured");
    const res = await fetch(cfg.smsWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.smsApiKey}` },
      body: JSON.stringify({ to: mobile, message, sender: cfg.smsSenderId }),
    });
    if (!res.ok) throw new Error(`SMS webhook error ${res.status}`);
    return;
  }
  throw new Error("SMS provider not configured");
}

async function sendWhatsApp(cfg: CommsConfig, to: string, message: string) {
  const mobile = normalizeMobile(to);
  if (cfg.whatsappProvider === "meta") {
    const res = await fetch(`https://graph.facebook.com/v20.0/${cfg.whatsappPhoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.whatsappApiKey}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: mobile, type: "text", text: { body: message } }),
    });
    if (!res.ok) throw new Error(`WhatsApp Cloud API error ${res.status}`);
    return;
  }
  if (cfg.whatsappProvider === "webhook") {
    if (!cfg.whatsappWebhookUrl) throw new Error("WhatsApp webhook URL not configured");
    const res = await fetch(cfg.whatsappWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.whatsappApiKey}` },
      body: JSON.stringify({ to: mobile, message }),
    });
    if (!res.ok) throw new Error(`WhatsApp webhook error ${res.status}`);
    return;
  }
  throw new Error("WhatsApp provider not configured");
}

// ───────────── Public API ─────────────

/**
 * Creates notification records for every applicable channel and dispatches them.
 * Delivery failures are recorded on the notification row and never thrown to callers.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const cfg = await getCommsConfig();
    const siteName = String((await getSettingsGroup("branding"))["branding.siteName"] ?? "EduSkill India Foundation");
    const data = { siteName, ...input.data };
    const secretKeys = new Set(input.redact ?? []);
    const storedData = secretKeys.size
      ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, secretKeys.has(k) ? REDACTED : v]))
      : data;

    const channels: NotificationChannel[] = input.channels ?? [
      ...(input.userId ? (["IN_APP"] as NotificationChannel[]) : []),
      ...(input.email && cfg.emailEnabled ? (["EMAIL"] as NotificationChannel[]) : []),
      ...(input.mobile && cfg.smsEnabled ? (["SMS"] as NotificationChannel[]) : []),
      ...(input.mobile && cfg.whatsappEnabled ? (["WHATSAPP"] as NotificationChannel[]) : []),
    ];
    if (channels.length === 0) return;

    for (const channel of channels) {
      const tpl = await resolveTemplate(input.event, channel);
      const title = renderTemplate(tpl.subject, data).trim() || DEFAULT_TEMPLATES[input.event].name;
      const body = renderTemplate(tpl.body, data).trim();
      const storedTitle = secretKeys.size ? renderTemplate(tpl.subject, storedData).trim() || DEFAULT_TEMPLATES[input.event].name : title;
      const storedBody = secretKeys.size ? renderTemplate(tpl.body, storedData).trim() : body;
      const recipient = channel === "EMAIL" ? input.email ?? null : channel === "IN_APP" ? null : input.mobile ?? null;

      const row = await db.notification.create({
        data: {
          userId: input.userId ?? null,
          channel,
          recipient,
          title: storedTitle,
          body: storedBody,
          templateKey: `${input.event}:${channel}`,
          data: JSON.parse(JSON.stringify(storedData)),
          status: channel === "IN_APP" ? "SENT" : "PENDING",
          sentAt: channel === "IN_APP" ? new Date() : null,
        },
      });

      if (channel === "IN_APP") continue;

      const dispatch = async () => {
        try {
          if (channel === "EMAIL" && recipient) await sendEmail(cfg, recipient, title, body);
          else if (channel === "SMS" && recipient) await sendSms(cfg, recipient, body);
          else if (channel === "WHATSAPP" && recipient) await sendWhatsApp(cfg, recipient, body);
          else throw new Error("No recipient");
          await db.notification.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } });
        } catch (err) {
          await db.notification
            .update({ where: { id: row.id }, data: { status: "FAILED", error: String(err instanceof Error ? err.message : err).slice(0, 500) } })
            .catch(() => undefined);
        }
      };
      void dispatch();
    }
  } catch (err) {
    console.error("[notify] failed:", err);
  }
}

export interface StaffAlertInput {
  /**
   * Permission that marks a staff member as an owner of this kind of work, e.g. `"applications.view"`.
   * Super Admins always receive the alert; other staff only when they hold this permission through
   * their role or a direct grant — so nobody is emailed about a module they cannot open.
   */
  permission: string;
  title: string;
  body: string;
  /** Admin path to the record (e.g. `/admin/applications/<id>`), shown as an absolute link. */
  path?: string | null;
}

/**
 * Tells the Foundation that a new piece of work has arrived (a registration, an application, a
 * payment declaration, a donation, an enquiry…).
 *
 * Recipients are the Super Admins plus the staff who hold `permission`, and any extra addresses in
 * the `comms.staffAlertEmails` setting. Every recipient also gets the alert in their admin inbox, so
 * the module works even before SMTP is configured. Controlled by `comms.staffAlertsEnabled`.
 *
 * Never throws: an alert failing must not roll back the work that triggered it.
 */
export async function notifyStaff(input: StaffAlertInput): Promise<void> {
  try {
    const s = await getSettingsGroup("comms");
    if (s["comms.staffAlertsEnabled"] === false) return;

    const staff = await db.user.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        OR: [
          { role: "SUPER_ADMIN" },
          { staff: { deletedAt: null, role: { permissions: { some: { permission: { key: input.permission } } } } } },
          { staff: { deletedAt: null, permissions: { some: { permission: { key: input.permission } } } } },
        ],
      },
      select: { id: true, email: true, mobile: true },
    });

    const link = input.path ? absoluteUrl(input.path) : "";
    const data = { title: input.title, body: input.body, link };

    for (const u of staff) {
      await notify({ userId: u.id, email: u.email, mobile: u.mobile, event: "STAFF_ALERT", data });
    }

    // Addresses that are not platform users (an ops or info mailbox, say) get the email only.
    const extra = String(s["comms.staffAlertEmails"] ?? "")
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@") && !staff.some((u) => u.email?.toLowerCase() === e.toLowerCase()));
    for (const email of extra) {
      await notify({ email, event: "STAFF_ALERT", data, channels: ["EMAIL"] });
    }
  } catch (err) {
    console.error("[notifyStaff] failed:", err);
  }
}

/** Sends a raw email immediately (used for tests from the admin settings page). Throws on failure. */
export async function sendTestEmail(to: string) {
  const cfg = await getCommsConfig();
  await sendEmail(cfg, to, "EduSkill test email", "This is a test email from your EduSkill platform. Email delivery is working.");
}
