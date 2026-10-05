import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { getPage } from "@/lib/cms";
import { TERMS_DOCUMENTS, type TermsKey } from "@/lib/terms/documents";
import { DEFAULT_TERMS } from "@/lib/terms/defaults";

export interface Terms {
  key: TermsKey;
  /** The CMS page slug — also what `TermsVersion.document` stores. */
  slug: string;
  /** The public page with the full text. */
  path: string;
  title: string;
  excerpt: string | null;
  /** SEO overrides from the CMS page, for the public terms page. */
  seoTitle: string | null;
  seoDescription: string | null;
  content: string;
  /** Short fingerprint of the exact title + text. The form sends it back with the application. */
  version: string;
  /** When the CMS page was last edited; null while the built-in text is in use. */
  updatedAt: Date | null;
  /** `updatedAt` as "05 Oct 2026" in India time — the same text on any server, so it hydrates cleanly. */
  updatedLabel: string | null;
}

const IST_PARTS = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "05 Oct 2026" in India time, matching `formatDate` elsewhere — built from numeric parts, because ICU versions disagree on short month names ("Sep" / "Sept"). */
function istDateLabel(date: Date): string {
  const p = Object.fromEntries(IST_PARTS.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.day} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

/** First 16 hex characters of SHA-256 over the title and text — changes with any edit. */
export function termsVersion(title: string, content: string): string {
  return createHash("sha256").update(`${title}\n\n${content}`, "utf8").digest("hex").slice(0, 16);
}

/** The current text of a terms document: its published CMS page, or the built-in text when the page is missing or a Draft. */
export async function getTerms(key: TermsKey): Promise<Terms> {
  const doc = TERMS_DOCUMENTS[key];
  const fallback = DEFAULT_TERMS[key];
  const page = await getPage(doc.slug).catch(() => null);
  const title = page?.title?.trim() || fallback.title;
  const content = page?.content?.trim() ? page.content : fallback.content;
  return {
    key,
    slug: doc.slug,
    path: doc.path,
    title,
    excerpt: page ? page.excerpt : fallback.excerpt,
    seoTitle: page?.seoTitle ?? null,
    seoDescription: page?.seoDescription ?? null,
    content,
    version: termsVersion(title, content),
    updatedAt: page?.updatedAt ?? null,
    updatedLabel: page?.updatedAt ? istDateLabel(page.updatedAt) : null,
  };
}

/**
 * The current terms, provided `version` is what the applicant was shown. If the Foundation edited the
 * text after the form loaded, the acceptance is for an older text: a 422 on `field` sends the
 * applicant back to read and accept the new one, so nobody is recorded as accepting text they never saw.
 */
export async function requireCurrentTerms(key: TermsKey, version: string, field: string): Promise<Terms> {
  const terms = await getTerms(key);
  if (version !== terms.version) {
    const message = `The ${TERMS_DOCUMENTS[key].label} were updated after you opened this form. Please read the new terms and accept them again.`;
    throw Errors.validation(message, { [field]: message });
  }
  return terms;
}

/**
 * Keeps the exact text an applicant accepted, once per document version, and returns its row id.
 * Later edits to the CMS page never change what an earlier applicant agreed to.
 *
 * Runs on the pool, not inside the application's transaction: the row is immutable text, harmless if
 * the application then fails, and a unique-key race between two first acceptances of a new version
 * is settled by reading the winner's row — which an aborted transaction could not do.
 */
export async function snapshotTerms(terms: Terms): Promise<string> {
  const where = { document_version: { document: terms.slug, version: terms.version } };
  const select = { id: true, title: true, content: true } as const;
  let row: { id: string; title: string; content: string } | null;
  try {
    row = await db.termsVersion.upsert({
      where,
      create: { document: terms.slug, version: terms.version, title: terms.title, content: terms.content },
      update: {},
      select,
    });
  } catch (e) {
    if (!(e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002")) throw e;
    row = await db.termsVersion.findUnique({ where, select });
    if (!row) throw e;
  }
  // The version is a 64-bit fingerprint: never let a (vanishingly unlikely) collision record a
  // different text as the one this applicant accepted.
  if (row.title !== terms.title || row.content !== terms.content) {
    throw new Error(`Terms snapshot mismatch for ${terms.slug}@${terms.version}: the stored text differs from the accepted one`);
  }
  return row.id;
}

/** The accepted texts behind these snapshot ids, for an admin detail page (id → version, title, text). */
export async function acceptedTermsByIds(ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((v): v is string => !!v))];
  if (!wanted.length) return new Map<string, { version: string; title: string; content: string }>();
  const rows = await db.termsVersion.findMany({ where: { id: { in: wanted } }, select: { id: true, version: true, title: true, content: true } });
  return new Map(rows.map((r) => [r.id, { version: r.version, title: r.title, content: r.content }]));
}
