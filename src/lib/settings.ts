import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export interface SettingDef {
  group: string;
  label: string;
  value: unknown;
  /** Public settings are exposed to the website / client bundle (branding, contact, etc.). */
  isPublic: boolean;
  /** Secrets are never returned to the client and are masked in the admin UI. */
  secret?: boolean;
  type?: "text" | "textarea" | "number" | "boolean" | "select" | "image" | "color";
  options?: { value: string; label: string }[];
  help?: string;
}

/**
 * Every configurable setting with its default. Values are stored in the `settings` table
 * and can be changed by the Super Admin from /admin/settings without a deployment.
 */
export const SETTING_DEFAULTS: Record<string, SettingDef> = {
  // Branding
  "branding.siteName": { group: "branding", label: "Organisation name", value: "EduSkill India Foundation", isPublic: true },
  "branding.shortName": { group: "branding", label: "Short name", value: "EduSkill", isPublic: true },
  "branding.tagline": { group: "branding", label: "Tagline", value: "Empowering Communities • Spreading Hope • Creating Change", isPublic: true },
  "branding.logoUrl": { group: "branding", label: "Main logo", value: "", isPublic: true, type: "image", help: "Shown in the website header. Leave empty to use the text wordmark." },
  "branding.logoMobileUrl": { group: "branding", label: "Mobile logo", value: "", isPublic: true, type: "image" },
  "branding.logoFooterUrl": { group: "branding", label: "Footer logo", value: "", isPublic: true, type: "image" },
  "branding.logoAdminUrl": { group: "branding", label: "Admin logo", value: "", isPublic: true, type: "image" },
  "branding.faviconUrl": { group: "branding", label: "Favicon", value: "", isPublic: true, type: "image" },
  "branding.registrationInfo": { group: "branding", label: "Registration / legal line", value: "", isPublic: true, help: "e.g. Registered under the Indian Trusts Act. Shown in the footer." },

  // Legal & registration — the Foundation's licence and tax identifiers. Every default is empty on
  // purpose: these are organisation data, entered once in Admin → Settings → Legal & Registration and
  // held only in the database, so they are never committed to the source repository.
  // `isPublic: false` keeps them out of the public settings payload; the ones a donor legitimately
  // needs on a receipt are marked public individually.
  "legal.registeredName": { group: "legal", label: "Registered legal name", value: "", isPublic: false },
  "legal.registrationNumber": { group: "legal", label: "Registration / trust deed number", value: "", isPublic: false },
  "legal.registrationDate": { group: "legal", label: "Date of registration", value: "", isPublic: false },
  "legal.registeredAddress": { group: "legal", label: "Registered office address", value: "", isPublic: false, type: "textarea" },
  "legal.pan": { group: "legal", label: "PAN of the organisation", value: "", isPublic: false },
  "legal.tan": { group: "legal", label: "TAN", value: "", isPublic: false },
  "legal.gstin": { group: "legal", label: "GSTIN", value: "", isPublic: false },
  "legal.darpanId": { group: "legal", label: "NGO Darpan / NITI Aayog unique ID", value: "", isPublic: false },
  "legal.csrNumber": { group: "legal", label: "CSR registration number (CSR-1)", value: "", isPublic: false },
  "legal.section12A": { group: "legal", label: "12A registration number", value: "", isPublic: false },
  "legal.section80G": { group: "legal", label: "80G registration number", value: "", isPublic: true, help: "Shown on donation receipts so donors can claim the deduction." },
  "legal.section80GValidity": { group: "legal", label: "80G valid until", value: "", isPublic: true },
  "legal.fcraNumber": { group: "legal", label: "FCRA registration number", value: "", isPublic: false },
  "legal.otherLicences": { group: "legal", label: "Other licences / approvals", value: "", isPublic: false, type: "textarea", help: "One per line, e.g. \"Shops & Establishments: …\"." },

  // Contact
  "contact.email": { group: "contact", label: "Contact email", value: "info@eduskillindia.org", isPublic: true },
  "contact.phone": { group: "contact", label: "Contact phone", value: "+91 00000 00000", isPublic: true },
  "contact.whatsapp": { group: "contact", label: "WhatsApp number", value: "", isPublic: true },
  "contact.address": { group: "contact", label: "Office address", value: "New Delhi, India", isPublic: true, type: "textarea" },
  "contact.hours": { group: "contact", label: "Office hours", value: "Mon – Sat, 10:00 AM – 6:00 PM", isPublic: true },

  // Social
  "social.facebook": { group: "social", label: "Facebook URL", value: "", isPublic: true },
  "social.instagram": { group: "social", label: "Instagram URL", value: "", isPublic: true },
  "social.twitter": { group: "social", label: "X / Twitter URL", value: "", isPublic: true },
  "social.linkedin": { group: "social", label: "LinkedIn URL", value: "", isPublic: true },
  "social.youtube": { group: "social", label: "YouTube URL", value: "", isPublic: true },

  // ID / code formats
  "codes.centerPrefix": { group: "codes", label: "Center code prefix", value: "ESK", isPublic: false },
  "codes.centerFormat": { group: "codes", label: "Center code format", value: "{PREFIX}-{STATE}-{DISTRICT}-{SEQ:4}", isPublic: false, help: "Placeholders: {PREFIX} {STATE} {DISTRICT} {SEQ:n}. Existing codes never change." },
  "codes.studentPrefix": { group: "codes", label: "Student ID prefix", value: "ESK-ST", isPublic: false },
  "codes.trainerPrefix": { group: "codes", label: "Trainer ID prefix", value: "ESK-TR", isPublic: false },
  "codes.certificatePrefix": { group: "codes", label: "Certificate number prefix", value: "ESK-CERT", isPublic: false },

  // Admissions
  "admissions.open": { group: "admissions", label: "Admissions open", value: true, isPublic: true, type: "boolean" },
  "admissions.registrationOpen": { group: "admissions", label: "Student registration open", value: true, isPublic: true, type: "boolean" },
  "admissions.trainerApplicationsOpen": { group: "admissions", label: "Volunteer trainer applications open", value: true, isPublic: true, type: "boolean" },
  "centres.applicationsOpen": { group: "admissions", label: "Centre applications open (Apply to open a centre)", value: true, isPublic: true, type: "boolean" },
  "admissions.maxUploadMb": { group: "admissions", label: "Max document upload size (MB)", value: 5, isPublic: true, type: "number" },
  "admissions.autoConfirmOnPayment": { group: "admissions", label: "Confirm admission automatically when the full fee is paid and a batch is assigned", value: true, isPublic: false, type: "boolean" },
  "admissions.autoReview": { group: "admissions", label: "Move submitted applications to Under Review automatically", value: true, isPublic: false, type: "boolean" },

  // Payments
  "payments.gateway": { group: "payments", label: "Payment gateway", value: "manual", isPublic: true, type: "select", options: [{ value: "manual", label: "Manual / Offline verification" }, { value: "razorpay", label: "Razorpay" }] },
  "payments.currency": { group: "payments", label: "Currency", value: "INR", isPublic: true },
  "payments.razorpayKeyId": { group: "payments", label: "Razorpay Key ID", value: "", isPublic: true },
  "payments.razorpayKeySecret": { group: "payments", label: "Razorpay Key Secret", value: "", isPublic: false, secret: true },
  "payments.razorpayWebhookSecret": { group: "payments", label: "Razorpay Webhook Secret", value: "", isPublic: false, secret: true },
  "payments.allowOffline": { group: "payments", label: "Allow offline payment declarations (cash / UPI / bank transfer)", value: true, isPublic: true, type: "boolean" },
  "payments.installmentsEnabled": { group: "payments", label: "Allow installments", value: true, isPublic: true, type: "boolean" },
  "payments.maxInstallments": { group: "payments", label: "Maximum installments", value: 3, isPublic: true, type: "number" },
  // Account details are organisation data, not source code: they live only in the database and are
  // entered in Admin → Settings → Payments. One "Label: value" per line – the donate page turns each
  // line into a labelled, copyable row.
  "payments.bankDetails": {
    group: "payments",
    label: "Bank / UPI details shown for offline payment",
    value: "",
    isPublic: true,
    type: "textarea",
    help: 'One "Label: value" per line, e.g. "Account Name: …", "Bank Name: …", "Account Number: …", "IFSC Code: …", "Branch: …".',
  },

  // Communication
  "comms.emailEnabled": { group: "comms", label: "Email notifications enabled", value: false, isPublic: false, type: "boolean" },
  "comms.smtpHost": { group: "comms", label: "SMTP host", value: "", isPublic: false },
  "comms.smtpPort": { group: "comms", label: "SMTP port", value: 587, isPublic: false, type: "number" },
  "comms.smtpUser": { group: "comms", label: "SMTP user", value: "", isPublic: false },
  "comms.smtpPass": { group: "comms", label: "SMTP password", value: "", isPublic: false, secret: true },
  "comms.smtpFrom": { group: "comms", label: "From address", value: "", isPublic: false },
  "comms.staffAlertsEnabled": { group: "comms", label: "Alert Foundation staff about new work (registrations, applications, payments, donations, enquiries)", value: true, isPublic: false, type: "boolean" },
  "comms.staffAlertEmails": { group: "comms", label: "Extra addresses for staff alerts (comma separated)", value: "", isPublic: false },
  "comms.smsEnabled": { group: "comms", label: "SMS notifications enabled", value: false, isPublic: false, type: "boolean" },
  "comms.smsProvider": { group: "comms", label: "SMS provider", value: "none", isPublic: false, type: "select", options: [{ value: "none", label: "None" }, { value: "msg91", label: "MSG91" }, { value: "webhook", label: "Generic HTTP webhook" }] },
  "comms.smsApiKey": { group: "comms", label: "SMS API key", value: "", isPublic: false, secret: true },
  "comms.smsSenderId": { group: "comms", label: "SMS sender ID", value: "", isPublic: false },
  "comms.smsTemplateId": { group: "comms", label: "SMS DLT template ID (MSG91)", value: "", isPublic: false },
  "comms.smsWebhookUrl": { group: "comms", label: "SMS webhook URL", value: "", isPublic: false },
  "comms.whatsappEnabled": { group: "comms", label: "WhatsApp notifications enabled", value: false, isPublic: false, type: "boolean" },
  "comms.whatsappProvider": { group: "comms", label: "WhatsApp provider", value: "none", isPublic: false, type: "select", options: [{ value: "none", label: "None" }, { value: "meta", label: "Meta WhatsApp Cloud API" }, { value: "webhook", label: "Generic HTTP webhook" }] },
  "comms.whatsappApiKey": { group: "comms", label: "WhatsApp API token", value: "", isPublic: false, secret: true },
  "comms.whatsappPhoneNumberId": { group: "comms", label: "WhatsApp phone number ID (Meta)", value: "", isPublic: false },
  "comms.whatsappWebhookUrl": { group: "comms", label: "WhatsApp webhook URL", value: "", isPublic: false },

  // Certificates
  "certificate.signatoryName": { group: "certificate", label: "Authorised signatory name", value: "Authorised Signatory", isPublic: false },
  "certificate.signatoryTitle": { group: "certificate", label: "Authorised signatory title", value: "EduSkill India Foundation", isPublic: false },
  "certificate.showQr": { group: "certificate", label: "Print verification QR code", value: true, isPublic: false, type: "boolean" },

  // SEO
  "seo.defaultTitle": { group: "seo", label: "Default page title", value: "EduSkill India Foundation – Skill Development, Education & Opportunity", isPublic: true },
  "seo.defaultDescription": { group: "seo", label: "Default meta description", value: "EduSkill India Foundation creates accessible skill development, vocational training and career-oriented learning opportunities for underserved students and communities across India.", isPublic: true, type: "textarea" },
  "seo.ogImage": { group: "seo", label: "Default social share image", value: "/og-default.png", isPublic: true, type: "image" },
  "seo.keywords": { group: "seo", label: "Keywords", value: "skill development, vocational training, digital literacy, India, NGO, foundation", isPublic: true },

  // Analytics
  "analytics.gaId": { group: "analytics", label: "Google Analytics measurement ID", value: "", isPublic: true },
  "analytics.trackVisitors": { group: "analytics", label: "Track website visitors internally", value: true, isPublic: true, type: "boolean" },
};

export const SETTING_GROUPS: { key: string; label: string; description: string }[] = [
  { key: "branding", label: "Branding", description: "Logos, organisation name and tagline used across the website and admin." },
  { key: "contact", label: "Contact", description: "Contact details shown on the website." },
  { key: "social", label: "Social Media", description: "Social profile links shown in the footer." },
  { key: "codes", label: "ID Formats", description: "Prefixes and formats for center codes, student IDs, trainer IDs and certificates." },
  { key: "admissions", label: "Admissions", description: "Control registrations, applications and uploads." },
  { key: "payments", label: "Payments", description: "Payment gateway and offline payment configuration." },
  { key: "comms", label: "Communication", description: "Email, SMS and WhatsApp providers." },
  { key: "legal", label: "Legal & Registration", description: "Registration, licence and tax numbers for the Foundation. Stored only in the database, never in the code." },
  { key: "certificate", label: "Certificates", description: "Signatory and certificate options." },
  { key: "seo", label: "SEO", description: "Default metadata for search engines and social sharing." },
  { key: "analytics", label: "Analytics", description: "Tracking configuration." },
];

const CACHE_TTL_MS = 30_000;
let cache: { at: number; map: Map<string, unknown> } | null = null;

export function invalidateSettingsCache() {
  cache = null;
}

export async function loadSettings(force = false): Promise<Map<string, unknown>> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.map;
  const rows = await db.setting.findMany({ select: { key: true, value: true } });
  const map = new Map<string, unknown>();
  for (const r of rows) map.set(r.key, r.value);
  cache = { at: Date.now(), map };
  return map;
}

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const map = await loadSettings();
  if (map.has(key)) return map.get(key) as T;
  const def = SETTING_DEFAULTS[key];
  if (!def) throw new Error(`Unknown setting key: ${key}`);
  return def.value as T;
}

export async function getSettingsGroup(group: string): Promise<Record<string, unknown>> {
  const map = await loadSettings();
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
    if (def.group !== group) continue;
    out[key] = map.has(key) ? map.get(key) : def.value;
  }
  return out;
}

export async function getAllSettings(opts: { includeSecrets?: boolean } = {}): Promise<Record<string, unknown>> {
  const map = await loadSettings();
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
    const value = map.has(key) ? map.get(key) : def.value;
    out[key] = def.secret && !opts.includeSecrets ? (value ? "••••••••" : "") : value;
  }
  return out;
}

/** Settings safe to expose to the public website and client bundles. */
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const map = await loadSettings();
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
    if (!def.isPublic || def.secret) continue;
    out[key] = map.has(key) ? map.get(key) : def.value;
  }
  return out;
}

export interface Branding {
  siteName: string;
  shortName: string;
  tagline: string;
  logoUrl: string;
  logoMobileUrl: string;
  logoFooterUrl: string;
  logoAdminUrl: string;
  faviconUrl: string;
  registrationInfo: string;
  contact: { email: string; phone: string; whatsapp: string; address: string; hours: string };
  social: { facebook: string; instagram: string; twitter: string; linkedin: string; youtube: string };
}

export async function getBranding(): Promise<Branding> {
  const s = await getPublicSettings();
  const str = (k: string) => String(s[k] ?? "");
  return {
    siteName: str("branding.siteName"),
    shortName: str("branding.shortName"),
    tagline: str("branding.tagline"),
    logoUrl: str("branding.logoUrl"),
    logoMobileUrl: str("branding.logoMobileUrl"),
    logoFooterUrl: str("branding.logoFooterUrl"),
    logoAdminUrl: str("branding.logoAdminUrl"),
    faviconUrl: str("branding.faviconUrl"),
    registrationInfo: str("branding.registrationInfo"),
    contact: {
      email: str("contact.email"),
      phone: str("contact.phone"),
      whatsapp: str("contact.whatsapp"),
      address: str("contact.address"),
      hours: str("contact.hours"),
    },
    social: {
      facebook: str("social.facebook"),
      instagram: str("social.instagram"),
      twitter: str("social.twitter"),
      linkedin: str("social.linkedin"),
      youtube: str("social.youtube"),
    },
  };
}

export async function setSetting(key: string, value: unknown, userId?: string | null) {
  const def = SETTING_DEFAULTS[key];
  if (!def) throw new Error(`Unknown setting key: ${key}`);
  await db.setting.upsert({
    where: { key },
    create: { key, group: def.group, value: value as Prisma.InputJsonValue, isPublic: def.isPublic, updatedById: userId ?? null },
    update: { value: value as Prisma.InputJsonValue, updatedById: userId ?? null },
  });
  invalidateSettingsCache();
}

export async function setSettings(values: Record<string, unknown>, userId?: string | null) {
  for (const [key, value] of Object.entries(values)) {
    const def = SETTING_DEFAULTS[key];
    if (!def) continue;
    // Masked secrets sent back unchanged are ignored.
    if (def.secret && value === "••••••••") continue;
    await setSetting(key, value, userId);
  }
}
