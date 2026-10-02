import type { composerConfig } from "@/server/email";

/** What `GET /api/admin/email/config` returns (no SMTP credentials, ever). */
export type ComposerConfig = Awaited<ReturnType<typeof composerConfig>>;

/** An uploaded attachment as the composer holds it; `url` is the access-controlled preview link. */
export interface EmailAttachment {
  key: string;
  name: string;
  size: number;
  mimeType: string;
  url?: string;
}

/** A starter layout or a saved template, flattened for the pickers. */
export interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  html: string;
  description?: string | null;
  starter: boolean;
  isActive?: boolean;
}

/** The message row the send / test / draft endpoints return. */
export interface EmailMessageResult {
  id: string;
  status: "DRAFT" | "SENDING" | "SENT" | "FAILED";
  isTest: boolean;
  subject: string;
  messageId: string | null;
  error: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
}

export interface PreviewResult {
  html: string;
  text: string;
  sanitizedBody: string;
}
