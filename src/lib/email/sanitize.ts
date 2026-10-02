import sanitizeHtml from "sanitize-html";

/**
 * Email HTML hygiene for Admin → Send Email. Everything an administrator composes is sanitised on
 * the SERVER before it is previewed, stored or sent, so the preview shows exactly what goes out and
 * no script, form, iframe, event handler or javascript: link can ride along — whatever the editor or
 * a pasted HTML source contains.
 *
 * Inline styles are kept (email clients ignore <style> blocks) but only for a whitelist of
 * properties with conservative value patterns.
 */

const LENGTH = /^-?\d{1,4}(\.\d{1,3})?(px|em|rem|%|pt)?$/;
const LENGTHS = /^(-?\d{1,4}(\.\d{1,3})?(px|em|rem|%|pt)?\s*){1,4}$/;
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)|[a-z]{3,20}|transparent)$/i;
const BORDER = /^(\d{1,2}px\s+(solid|dashed|dotted|none)\s+(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s,.]+\))|none|0)$/i;
const FONT_FAMILY = /^[a-z0-9\s,'"-]{1,120}$/i;

const STYLES: Record<string, RegExp[]> = {
  color: [COLOR],
  "background-color": [COLOR],
  background: [COLOR],
  "font-size": [LENGTH, /^(small|medium|large|x-large|xx-large)$/],
  "font-weight": [/^(normal|bold|bolder|lighter|[1-9]00)$/],
  "font-style": [/^(normal|italic)$/],
  "font-family": [FONT_FAMILY],
  "text-decoration": [/^(none|underline|line-through)$/],
  "text-align": [/^(left|right|center|justify)$/],
  "vertical-align": [/^(top|middle|bottom|baseline)$/],
  "line-height": [/^\d{1,2}(\.\d{1,2})?$/, LENGTH],
  "letter-spacing": [LENGTH],
  margin: [LENGTHS, /^0 auto$/],
  "margin-top": [LENGTH],
  "margin-bottom": [LENGTH],
  "margin-left": [LENGTH, /^auto$/],
  "margin-right": [LENGTH, /^auto$/],
  padding: [LENGTHS],
  "padding-top": [LENGTH],
  "padding-bottom": [LENGTH],
  "padding-left": [LENGTH],
  "padding-right": [LENGTH],
  border: [BORDER],
  "border-top": [BORDER],
  "border-bottom": [BORDER],
  "border-left": [BORDER],
  "border-right": [BORDER],
  "border-radius": [LENGTHS],
  "border-collapse": [/^(collapse|separate)$/],
  width: [LENGTH, /^auto$/],
  "max-width": [LENGTH],
  height: [LENGTH, /^auto$/],
  display: [/^(block|inline-block|inline|table|none)$/],
};

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "small",
    "h1", "h2", "h3", "h4", "blockquote", "pre", "code", "hr",
    "ul", "ol", "li",
    "a", "img",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  ],
  allowedAttributes: {
    "*": ["style", "align", "dir"],
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "width", "height", "title"],
    table: ["width", "border", "cellpadding", "cellspacing", "role"],
    td: ["colspan", "rowspan", "width", "valign"],
    th: ["colspan", "rowspan", "width", "valign", "scope"],
    col: ["width", "span"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  allowedStyles: { "*": STYLES },
  disallowedTagsMode: "discard",
  // Links open in a new tab and never leak the admin panel as referrer.
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
  },
  // Text inside removed tags such as <script> or <style> is dropped, not shown.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "title", "head"],
};

export const MAX_EMAIL_HTML_LENGTH = 400_000;

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html.slice(0, MAX_EMAIL_HTML_LENGTH), SANITIZE_OPTIONS).trim();
}

/** A readable plain-text alternative (multipart/alternative) from sanitised HTML. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-4]|li|tr|blockquote|pre|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<hr[^>]*>/gi, "\n————————\n")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => {
      const label = text.replace(/<[^>]+>/g, "").trim();
      return label && label !== href ? `${label} (${href})` : href;
    });
  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;|\xA0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Wraps a sanitised body (and optional signature) in a 640px, table-based layout that renders the
 * same in Gmail, Outlook and phone mail apps. The body and signature MUST already be sanitised.
 */
export function wrapEmailLayout(bodyHtml: string, opts: { signatureHtml?: string | null; preheader?: string | null } = {}): string {
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeText(opts.preheader).slice(0, 150)}</div>` : "";
  const signature = opts.signatureHtml ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb">${opts.signatureHtml}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f6fb">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb">
<tr><td style="padding:28px 28px 32px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#172033">${bodyHtml}${signature}</td></tr>
</table></td></tr></table></body></html>`;
}

function escapeText(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Address list from free text ("a@x.com, b@y.org; c@z.in"): trimmed, lower-cased, de-duplicated. */
export function parseAddressList(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input) ? input.join(",") : (input ?? "");
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const v = part.trim().toLowerCase();
    if (v) seen.add(v);
  }
  return [...seen];
}

const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i;

/** RFC-lite address check that also refuses header-injection characters. */
export function isValidAddress(address: string): boolean {
  return address.length <= 254 && !/[\r\n\0<>,;"]/.test(address) && EMAIL_RE.test(address);
}
