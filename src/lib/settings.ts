import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { decryptSecret, encryptSecret, isEncrypted, isEncryptionConfigured } from "@/lib/crypto";

export interface SettingDef {
  group: string;
  label: string;
  value: unknown;
  /** Public settings are exposed to the website / client bundle (branding, contact, etc.). */
  isPublic: boolean;
  /** Secrets are never returned to the client, are masked in the admin UI and are encrypted at rest. */
  secret?: boolean;
  /**
   * Only a Super Admin may change it. Email transport and security switches are here: whoever can
   * repoint SMTP can read every sign-in code, so `settings.update` alone must not be enough.
   */
  superAdminOnly?: boolean;
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
  "contact.email": { group: "contact", label: "Contact email", value: "info@eduskillindia.com", isPublic: true },
  // Phone numbers are kept for the Foundation's own records but are NEVER shown on the website, in
  // receipts or by the assistant: the Foundation is contacted by email only (getBranding blanks them).
  "contact.phone": { group: "contact", label: "Contact phone (not shown on the website)", value: "", isPublic: false, help: "Kept for internal records only. The website, receipts and the assistant show the contact email, never a phone number." },
  "contact.whatsapp": { group: "contact", label: "WhatsApp number (not shown on the website)", value: "", isPublic: false, help: "Kept for internal records only. No WhatsApp link is shown anywhere on the website." },
  "contact.address": { group: "contact", label: "Office address", value: "New Delhi, India", isPublic: true, type: "textarea" },
  "contact.hours": { group: "contact", label: "Office hours", value: "Mon – Sat, 10:00 AM – 6:00 PM", isPublic: true },

  // Social
  "social.facebook": { group: "social", label: "Facebook URL", value: "", isPublic: true },
  "social.instagram": { group: "social", label: "Instagram URL", value: "", isPublic: true },
  "social.twitter": { group: "social", label: "X / Twitter URL", value: "", isPublic: true },
  "social.linkedin": { group: "social", label: "LinkedIn URL", value: "", isPublic: true },
  "social.youtube": { group: "social", label: "YouTube URL", value: "", isPublic: true },

  // Mobile app
  // There is no native EduSkill app in either store today, and both of these stay empty until there
  // is one. While they are empty the "Get the app" control installs THIS website instead — it is a
  // PWA with a manifest and a service worker, so the browser puts a real icon on the home screen.
  // Filling in a URL that does not resolve to a published listing turns that control into a broken
  // promise, so leave them blank until the listing is live.
  "app.playStoreUrl": {
    group: "app",
    label: "Google Play listing URL",
    value: "",
    isPublic: true,
    help: 'Only once a real listing is published, e.g. "https://play.google.com/store/apps/details?id=…". Leave empty to offer the website itself as an installable app.',
  },
  "app.appStoreUrl": {
    group: "app",
    label: "Apple App Store listing URL",
    value: "",
    isPublic: true,
    help: 'Only once a real listing is published, e.g. "https://apps.apple.com/in/app/…". Leave empty and iPhone visitors are shown the Share → Add to Home Screen steps instead.',
  },

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
  "payments.razorpayKeySecret": { group: "payments", label: "Razorpay Key Secret", value: "", isPublic: false, secret: true, superAdminOnly: true },
  "payments.razorpayWebhookSecret": { group: "payments", label: "Razorpay Webhook Secret", value: "", isPublic: false, secret: true, superAdminOnly: true },
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

  // Communication — Super Admin only (see `superAdminOnly`). Admin sign-in codes go out over this SMTP.
  "comms.emailEnabled": { group: "comms", label: "Email notifications enabled", value: false, isPublic: false, type: "boolean", superAdminOnly: true, help: "Routine notifications (applications, payments…). Sign-in codes and security alerts are always emailed when SMTP is configured." },
  "comms.smtpHost": { group: "comms", label: "SMTP host", value: "", isPublic: false, superAdminOnly: true, help: "e.g. smtp.hostinger.com" },
  "comms.smtpPort": { group: "comms", label: "SMTP port", value: 587, isPublic: false, type: "number", superAdminOnly: true, help: "587 (STARTTLS, required) or 465 (SSL)." },
  "comms.smtpUser": { group: "comms", label: "SMTP user", value: "", isPublic: false, superAdminOnly: true, help: "Usually the full mailbox address, e.g. info@eduskillindia.com" },
  "comms.smtpPass": { group: "comms", label: "SMTP password", value: "", isPublic: false, secret: true, superAdminOnly: true, help: "Stored encrypted. Never shown again after saving." },
  "comms.smtpSecurity": {
    group: "comms",
    label: "Encryption",
    value: "starttls",
    isPublic: false,
    type: "select",
    options: [
      { value: "starttls", label: "STARTTLS (port 587) — required upgrade" },
      { value: "ssl", label: "SSL/TLS (port 465)" },
    ],
    superAdminOnly: true,
  },
  "comms.smtpFromName": { group: "comms", label: "From name", value: "EduSkill India Foundation", isPublic: false, superAdminOnly: true },
  "comms.smtpFromEmail": { group: "comms", label: "From email", value: "info@eduskillindia.com", isPublic: false, superAdminOnly: true, help: "Must be an address the SMTP account is allowed to send as." },
  "comms.smtpReplyTo": { group: "comms", label: "Reply-To email", value: "", isPublic: false, superAdminOnly: true, help: "Optional. Where replies go; leave empty to reply to the From email." },
  "comms.smtpFrom": { group: "comms", label: "From address (legacy, combined)", value: "", isPublic: false, superAdminOnly: true, help: 'Older single field, e.g. EduSkill India Foundation <info@eduskillindia.com>. Used only when From email is empty.' },
  "comms.staffAlertsEnabled": { group: "comms", label: "Alert Foundation staff about new work (registrations, applications, payments, donations, enquiries)", value: true, isPublic: false, type: "boolean", superAdminOnly: true },
  "comms.staffAlertEmails": { group: "comms", label: "Extra addresses for staff alerts (comma separated)", value: "", isPublic: false, superAdminOnly: true },
  "comms.smsEnabled": { group: "comms", label: "SMS notifications enabled", value: false, isPublic: false, type: "boolean", superAdminOnly: true },
  "comms.smsProvider": { group: "comms", label: "SMS provider", value: "none", isPublic: false, type: "select", options: [{ value: "none", label: "None" }, { value: "msg91", label: "MSG91" }, { value: "webhook", label: "Generic HTTP webhook" }], superAdminOnly: true },
  "comms.smsApiKey": { group: "comms", label: "SMS API key", value: "", isPublic: false, secret: true, superAdminOnly: true },
  "comms.smsSenderId": { group: "comms", label: "SMS sender ID", value: "", isPublic: false, superAdminOnly: true },
  "comms.smsTemplateId": { group: "comms", label: "SMS DLT template ID (MSG91)", value: "", isPublic: false, superAdminOnly: true },
  "comms.smsWebhookUrl": { group: "comms", label: "SMS webhook URL", value: "", isPublic: false, superAdminOnly: true },
  "comms.whatsappEnabled": { group: "comms", label: "WhatsApp notifications enabled", value: false, isPublic: false, type: "boolean", superAdminOnly: true },
  "comms.whatsappProvider": { group: "comms", label: "WhatsApp provider", value: "none", isPublic: false, type: "select", options: [{ value: "none", label: "None" }, { value: "meta", label: "Meta WhatsApp Cloud API" }, { value: "webhook", label: "Generic HTTP webhook" }], superAdminOnly: true },
  "comms.whatsappApiKey": { group: "comms", label: "WhatsApp API token", value: "", isPublic: false, secret: true, superAdminOnly: true },
  "comms.whatsappPhoneNumberId": { group: "comms", label: "WhatsApp phone number ID (Meta)", value: "", isPublic: false, superAdminOnly: true },
  "comms.whatsappWebhookUrl": { group: "comms", label: "WhatsApp webhook URL", value: "", isPublic: false, superAdminOnly: true },

  // Manual email (Admin → Send Email).
  "email.signatureHtml": {
    group: "email",
    label: "Email signature",
    value:
      '<p style="margin:16px 0 0">Best regards,<br><strong>EduSkill India Foundation</strong><br>Email: <a href="mailto:info@eduskillindia.com">info@eduskillindia.com</a><br>Website: <a href="https://eduskillindia.com">eduskillindia.com</a></p><p style="margin:8px 0 0;color:#ea580c;font-weight:600">Empowering Education &amp; Skills</p>',
    isPublic: false,
    type: "textarea",
    help: "HTML. Appended to emails sent from Admin → Send Email when \"Add signature\" is ticked.",
  },
  "email.signatureEnabled": { group: "email", label: "Tick \"Add signature\" by default", value: true, isPublic: false, type: "boolean" },
  "email.maxRecipients": { group: "email", label: "Maximum recipients per email (To + CC + BCC)", value: 50, isPublic: false, type: "number", superAdminOnly: true },
  "email.maxAttachmentMb": { group: "email", label: "Maximum total attachment size (MB)", value: 10, isPublic: false, type: "number", superAdminOnly: true, help: "1–20. Most mailboxes reject messages above 20 MB." },
  "email.dailyLimitPerAdmin": { group: "email", label: "Maximum emails each administrator can send per day", value: 200, isPublic: false, type: "number", superAdminOnly: true },

  // Security — Super Admin only. Edited in Admin → Security Center → Settings.
  "security.require2faForAdmins": {
    group: "security",
    label: "Require an authenticator app (2FA) for every administrator",
    value: false,
    isPublic: false,
    type: "boolean",
    superAdminOnly: true,
    help: "Administrators who have not set it up are taken through set-up at their next sign-in. Switch on only after you have set up your own authenticator and saved your backup codes.",
  },
  "security.alertEmail": {
    group: "security",
    label: "Security alert email",
    value: "info@eduskillindia.com",
    isPublic: false,
    superAdminOnly: true,
    help: "Receives new-device, suspicious sign-in, lockout and 2FA alerts in addition to the Super Admins.",
  },
  "security.newDeviceAlerts": {
    group: "security",
    label: "Email administrators when their account signs in from a new device",
    value: true,
    isPublic: false,
    type: "boolean",
    superAdminOnly: true,
  },

  // AI assistant (public website chatbot)
  // Nothing here is `isPublic`: the widget reads everything it needs from GET /api/public/chat,
  // so the model id, the rate limit and the extra prompt never reach the browser bundle.
  // The OpenAI key is deliberately NOT a setting — it stays in OPENAI_API_KEY on the server.
  "chatbot.enabled": {
    group: "chatbot",
    label: "AI assistant enabled",
    value: true,
    isPublic: false,
    type: "boolean",
    help: "Shows the bilingual assistant on the public website. It stays hidden until OPENAI_API_KEY is set on the server.",
  },
  "chatbot.model": {
    group: "chatbot",
    label: "OpenAI model",
    value: "gpt-4o-mini",
    isPublic: false,
    help: 'An OpenAI model id, e.g. "gpt-4o-mini" (fast and inexpensive) or "gpt-4o". Must be a model your OpenAI account can access.',
  },
  "chatbot.greetingEn": {
    group: "chatbot",
    label: "Greeting (English)",
    value:
      "Namaste! I am the EduSkill India Foundation assistant. Ask me about our courses, training centres, admissions, scholarships or volunteering — in English or Hindi.",
    isPublic: false,
    type: "textarea",
  },
  "chatbot.greetingHi": {
    group: "chatbot",
    label: "Greeting (Hindi)",
    value:
      "नमस्ते! मैं एडुस्किल इंडिया फ़ाउंडेशन का सहायक हूँ। कोर्स, ट्रेनिंग सेंटर, एडमिशन, स्कॉलरशिप या वॉलंटियर बनने के बारे में कुछ भी पूछिए — हिंदी या अंग्रेज़ी में।",
    isPublic: false,
    type: "textarea",
  },
  "chatbot.suggestions": {
    group: "chatbot",
    label: "Quick questions",
    value: [
      "What courses does the Foundation offer? | फाउंडेशन कौन-कौन से कोर्स कराता है?",
      "Is there a training centre near me? | क्या मेरे आस-पास कोई ट्रेनिंग सेंटर है?",
      "How do I apply for admission? | एडमिशन के लिए आवेदन कैसे करें?",
      "Can I get a scholarship or a fee waiver? | क्या मुझे स्कॉलरशिप या फीस में छूट मिल सकती है?",
      "How do I become a volunteer trainer? | वॉलंटियर ट्रेनर कैसे बनें?",
      "How can I open a training centre in my area? | अपने क्षेत्र में ट्रेनिंग सेंटर कैसे खोलें?",
      "How do I contact the Foundation? | फाउंडेशन से संपर्क कैसे करें?",
    ].join("\n"),
    isPublic: false,
    type: "textarea",
    help: 'One question per line as "English question | हिंदी प्रश्न". The visitor sees them as tappable chips in their own language.',
  },
  "chatbot.voiceEnabled": {
    group: "chatbot",
    label: "Let visitors hear answers read aloud",
    value: true,
    isPublic: false,
    type: "boolean",
    help: "Uses the visitor's own device voice. No audio is sent anywhere.",
  },
  "chatbot.maxMessagesPerHour": {
    group: "chatbot",
    label: "Maximum messages per visitor per hour",
    value: 40,
    isPublic: false,
    type: "number",
    help: "Per IP address. Keeps the OpenAI bill predictable; 1–500.",
  },
  "chatbot.systemPromptExtra": {
    group: "chatbot",
    label: "Extra instructions for the assistant",
    value: "",
    isPublic: false,
    type: "textarea",
    help: "Appended to the assistant's instructions, e.g. a seasonal admission notice or a phrase to always mention. Leave empty for the default behaviour.",
  },

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
  { key: "social", label: "Social Media", description: "Social profile links shown in the top bar and the footer." },
  { key: "app", label: "Mobile App", description: "Store listings for the \"Get the app\" button. While these are empty the button installs the website itself as an app." },
  { key: "codes", label: "ID Formats", description: "Prefixes and formats for center codes, student IDs, trainer IDs and certificates." },
  { key: "admissions", label: "Admissions", description: "Control registrations, applications and uploads." },
  { key: "payments", label: "Payments", description: "Payment gateway and offline payment configuration." },
  { key: "comms", label: "Communication", description: "Email (SMTP), SMS and WhatsApp providers. Super Admin only: admin sign-in codes are sent over this email." },
  { key: "security", label: "Security", description: "Administrator sign-in policy and security alerts. Super Admin only." },
  { key: "email", label: "Email Signature & Limits", description: "The signature added to emails sent from Admin → Send Email, and sending limits." },
  { key: "chatbot", label: "AI Assistant", description: "The bilingual assistant on the public website: greeting, quick questions, model and limits." },
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

/**
 * Secret settings whose stored value could not be decrypted on the last load (DATA_ENCRYPTION_KEY lost
 * or changed). Readers get "" for them — which every consumer must treat as "not configured", never as
 * a usable key — and the Security Center lists them. Key names only, never values.
 */
let undecryptable = new Set<string>();
const alertedUndecryptable = new Set<string>();

export function undecryptableSecretKeys(): string[] {
  return [...undecryptable].sort();
}

export async function loadSettings(force = false): Promise<Map<string, unknown>> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.map;
  const rows = await db.setting.findMany({ select: { key: true, value: true } });
  const map = new Map<string, unknown>();
  const failed = new Set<string>();
  for (const r of rows) {
    let value: unknown = r.value;
    // Secrets are stored encrypted (enc:v1:…); everything that reads settings gets plaintext.
    if (SETTING_DEFAULTS[r.key]?.secret && isEncrypted(value)) {
      try {
        value = decryptSecret(value);
      } catch (err) {
        console.error(`[settings] could not decrypt ${r.key}:`, err instanceof Error ? err.message : err);
        value = "";
        failed.add(r.key);
      }
    }
    map.set(r.key, value);
  }
  cache = { at: Date.now(), map };
  undecryptable = failed;
  // One critical alert per key per process (the alert code reads settings itself, hence the guard and
  // the dynamic import, which also keeps this module free of a static cycle).
  for (const key of failed) {
    if (alertedUndecryptable.has(key)) continue;
    alertedUndecryptable.add(key);
    const label = SETTING_DEFAULTS[key]?.label ?? key;
    void import("@/server/security-alerts")
      .then(({ raiseSecurityAlert }) =>
        raiseSecurityAlert({
          type: "SECRET_UNREADABLE",
          severity: "critical",
          title: `The saved "${label}" cannot be decrypted`,
          detail: `Setting ${key} was encrypted with a different DATA_ENCRYPTION_KEY. It is treated as not configured until a Super Admin saves it again in Admin → Settings.`,
        })
      )
      .catch(() => undefined);
  }
  return map;
}

/**
 * Problems with the secret settings stored in the database, for the Security Center (Super Admin):
 * values that cannot be decrypted, and values still stored as plain text (saved before
 * DATA_ENCRYPTION_KEY existed — `npm run security:migrate` encrypts them). Names keys, never values.
 */
export async function storedSecretIssues(): Promise<string[]> {
  await loadSettings();
  const issues = undecryptableSecretKeys().map(
    (k) => `${SETTING_DEFAULTS[k]?.label ?? k} (${k}) cannot be decrypted with the current DATA_ENCRYPTION_KEY and is treated as not set. Save it again in Admin → Settings.`
  );
  if (isEncryptionConfigured()) {
    const secretKeys = Object.entries(SETTING_DEFAULTS).filter(([, d]) => d.secret).map(([k]) => k);
    const rows = await db.setting.findMany({ where: { key: { in: secretKeys } }, select: { key: true, value: true } });
    for (const r of rows) {
      if (typeof r.value === "string" && r.value !== "" && !isEncrypted(r.value)) {
        issues.push(`${SETTING_DEFAULTS[r.key]?.label ?? r.key} (${r.key}) is stored as plain text. Run npm run security:migrate on the server, or save it again in Admin → Settings, to encrypt it.`);
      }
    }
  }
  return issues;
}

/** True when the key has a stored row (as opposed to falling back to its default). */
export async function hasStoredSetting(key: string): Promise<boolean> {
  return (await loadSettings()).has(key);
}

export function isSuperAdminOnlySetting(key: string): boolean {
  return SETTING_DEFAULTS[key]?.superAdminOnly === true;
}

/** Groups whose page and API are Super Admin only (every key in them is). */
export function isSuperAdminOnlyGroup(group: string): boolean {
  const keys = Object.values(SETTING_DEFAULTS).filter((d) => d.group === group);
  return keys.length > 0 && keys.every((d) => d.superAdminOnly === true);
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
      // Email only: no phone or WhatsApp number is ever shown publicly (see contact.phone above).
      phone: "",
      whatsapp: "",
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
  // Encrypt secrets at rest when DATA_ENCRYPTION_KEY is configured (legacy plaintext otherwise).
  if (def.secret && typeof value === "string" && value !== "" && !isEncrypted(value) && isEncryptionConfigured()) {
    value = encryptSecret(value);
  }
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
