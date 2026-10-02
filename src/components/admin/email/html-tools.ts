"use client";

import { withBasePath } from "@/lib/base-path";

/*
 * Browser-side helpers for Admin → Send Email.
 *
 * The SERVER is the authority on what an email may contain (src/lib/email/sanitize.ts sanitises
 * every preview, draft, template and send). What lives here is the editor's own hygiene: HTML that
 * is pasted, dropped or typed into the source view is cleaned in an inert DOMParser document BEFORE
 * it touches the live contenteditable, so an `onerror=` attribute or a <script> never runs in the
 * administrator's browser, and inline `data:` images (which bloat emails and are blocked by most
 * mail clients) are refused in favour of an upload.
 */

/** Same shape as the server's `isValidAddress` (src/lib/email/sanitize.ts), which stays the authority. */
const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i;

export function isValidEmail(address: string): boolean {
  return address.length <= 254 && !/[\r\n\0<>,;"]/.test(address) && EMAIL_RE.test(address);
}

/** Splits pasted text ("a@x.com, b@y.org; c@z.in" or one per line) into trimmed, lower-cased, unique addresses. */
export function splitAddresses(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[,;\s]+/)) {
    // "Name <a@b.com>" → "a@b.com"
    const m = part.match(/<([^>]+)>/);
    const v = (m ? m[1]! : part).trim().replace(/^mailto:/i, "").toLowerCase();
    if (v) seen.add(v);
  }
  return [...seen];
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Accepts https:// and mailto: links only (the server allows http too, but the composer never creates one). */
export function safeLinkUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || /[\s<>"]/.test(v)) return null;
  if (/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,24}(\?.*)?$/i.test(v)) return v;
  if (/^[^@\s/]+@[^@\s/]+\.[a-z]{2,24}$/i.test(v)) return `mailto:${v}`;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Images must be absolute https URLs (or http on a local development host) that mail clients can fetch. */
export function safeImageUrl(raw: string): string | null {
  const v = raw.trim();
  try {
    const u = new URL(v);
    if (u.protocol === "https:") return u.toString();
    if (u.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(u.hostname)) return u.toString();
    return null;
  } catch {
    return null;
  }
}

/* ───────────── HTML cleaning (inert document) ───────────── */

const ALLOWED_TAGS = new Set([
  "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "small",
  "h1", "h2", "h3", "h4", "blockquote", "pre", "code", "hr",
  "ul", "ol", "li", "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
]);

/** Removed together with their content. Anything else that is not allowed is unwrapped (children kept). */
const DROP_TAGS = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "form", "input", "button", "textarea", "select", "option",
  "noscript", "template", "svg", "math", "link", "meta", "title", "head", "base", "video", "audio", "source", "track", "canvas", "map", "area", "picture",
]);

const GLOBAL_ATTRS = new Set(["style", "align", "dir"]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "width", "height", "title"]),
  table: new Set(["width", "border", "cellpadding", "cellspacing", "role"]),
  td: new Set(["colspan", "rowspan", "width", "valign"]),
  th: new Set(["colspan", "rowspan", "width", "valign", "scope"]),
  col: new Set(["width", "span"]),
};

const STYLE_PROPS = new Set([
  "color", "background-color", "background", "font-size", "font-weight", "font-style", "font-family", "text-decoration", "text-align", "vertical-align",
  "line-height", "letter-spacing", "margin", "margin-top", "margin-bottom", "margin-left", "margin-right", "padding", "padding-top", "padding-bottom",
  "padding-left", "padding-right", "border", "border-top", "border-bottom", "border-left", "border-right", "border-radius", "border-collapse",
  "width", "max-width", "height", "display",
]);

function cleanStyle(style: string): string {
  return style
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(":");
      if (i < 0) return null;
      const prop = d.slice(0, i).trim().toLowerCase();
      const value = d.slice(i + 1).trim();
      if (!STYLE_PROPS.has(prop) || !value || /url\(|expression|javascript:|@import|[<>]/i.test(value)) return null;
      return `${prop}:${value}`;
    })
    .filter(Boolean)
    .join(";");
}

export interface CleanResult {
  html: string;
  /** Images dropped because they were inline `data:`/`blob:` images or used an unsupported scheme. */
  removedImages: number;
}

/**
 * Cleans HTML in an inert document (DOMParser never runs scripts or loads images) and returns markup
 * that is safe to place in the editor. Mirrors the server's allow-list; the server still sanitises.
 */
export function cleanEditorHtml(input: string): CleanResult {
  if (typeof window === "undefined" || !input) return { html: input ?? "", removedImages: 0 };
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${input}</body></html>`, "text/html");
  let removedImages = 0;

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE || child.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
        child.remove();
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (DROP_TAGS.has(tag) || tag.includes(":")) {
        // Office namespaces (o:p, v:shape…) carry nothing an email can use.
        if (tag.includes(":") && !DROP_TAGS.has(tag)) {
          walk(el);
          el.replaceWith(...Array.from(el.childNodes));
        } else el.remove();
        continue;
      }
      walk(el);
      if (!ALLOWED_TAGS.has(tag)) {
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }
      const allowed = TAG_ATTRS[tag];
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) el.removeAttribute(attr.name);
      }
      const style = el.getAttribute("style");
      if (style !== null) {
        const cleaned = cleanStyle(style);
        if (cleaned) el.setAttribute("style", cleaned);
        else el.removeAttribute("style");
      }
      if (tag === "a") {
        const href = el.getAttribute("href");
        if (href !== null) {
          const ok = /^(https?:|mailto:)/i.test(href.trim()) || href.trim().startsWith("#");
          if (!ok) el.removeAttribute("href");
        }
      }
      if (tag === "img") {
        const src = (el.getAttribute("src") ?? "").trim();
        if (!/^https?:\/\//i.test(src)) {
          removedImages++;
          el.remove();
        }
      }
    }
  };
  walk(doc.body);
  return { html: doc.body.innerHTML.trim(), removedImages };
}

/** True when the HTML has no visible text and no image, divider or table. */
export function isHtmlEmpty(html: string): boolean {
  if (!html) return true;
  if (/<(img|hr|table)\b/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;| |\s/g, "") === "";
}

/** Light pretty-printing for the HTML source view: one block per line. Whitespace between blocks is insignificant. */
export function formatHtmlSource(html: string): string {
  return html
    .replace(/(<\/(p|h[1-4]|li|ul|ol|table|thead|tbody|tfoot|tr|blockquote|pre|div)>)(?!\n)/gi, "$1\n")
    .replace(/(<(ul|ol|table|thead|tbody|tfoot|tr)\b[^>]*>)(?!\n)/gi, "$1\n")
    .replace(/(<hr\b[^>]*>)(?!\n)/gi, "$1\n")
    .trim();
}

/* ───────────── Uploads with progress ───────────── */

export interface UploadedFile {
  key: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export class UploadError extends Error {}

/**
 * multipart POST with upload progress (fetch has none). Speaks the API envelope
 * `{ success, data | error }` and the same base-path rules as `api-client`.
 */
export function uploadWithProgress<T = UploadedFile>(url: string, form: FormData, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", withBasePath(url));
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      const body = xhr.response as { success?: boolean; data?: T; error?: { message?: string } } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.success) {
        onProgress?.(100);
        resolve(body.data as T);
      } else reject(new UploadError(body?.error?.message ?? (xhr.status === 413 ? "The file is too large." : `Upload failed (${xhr.status || "network error"})`)));
    };
    xhr.onerror = () => reject(new UploadError("Upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new UploadError("Upload cancelled"));
    if (signal) {
      if (signal.aborted) {
        reject(new UploadError("Upload cancelled"));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(form);
  });
}

/** Uploads an image for use INSIDE an email body (public, absolute URL so mail clients can load it). */
export async function uploadEmailImage(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("preset", "image");
  form.append("visibility", "public");
  form.append("folder", "email-images");
  const r = await uploadWithProgress<UploadedFile>("/api/admin/uploads", form, onProgress);
  return new URL(r.url, window.location.origin).toString();
}

/** Access-controlled link to a stored attachment (same URL shape as `fileUrl` in src/lib/storage). */
export function attachmentUrl(key: string): string {
  return withBasePath(`/api/files/${key}`);
}
