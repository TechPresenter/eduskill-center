import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { withBasePath } from "@/lib/base-path";
import { cn, slugify } from "@/lib/utils";

/**
 * Minimal, safe Markdown renderer for CMS content. Output is built from React elements
 * only – raw HTML in the source is shown as text, never injected.
 *
 * Supported: # / ## / ### / #### headings, paragraphs, **bold**, _italic_ / *italic*,
 * `code`, [links](url) (http/https/mailto/relative only), ![images](url), unordered &
 * ordered lists, > blockquotes, | tables |, horizontal rules and ``` fenced code blocks.
 *
 * This module is SERVER-SAFE on purpose (no "use client"): the blog article page builds its
 * table of contents on the server with {@link extractHeadings} and the chatbot renders replies
 * with {@link Markdown}. Keep it free of hooks and browser globals.
 */

function safeHref(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  if (/^(\/|#|\.\/)/.test(u)) return u;
  if (!u.includes(":")) return u; // bare relative path such as "courses"
  return null;
}

/**
 * Body images are stricter than links: only an app-absolute path or an https URL is allowed,
 * so a pasted `javascript:`/`data:` payload can never reach an `src`. App-absolute paths go
 * through `withBasePath()` because — unlike `<Link>` — nothing applies the deployment sub-path
 * to an image source: `next/image` prefixes its own `/_next/image` endpoint but passes `src`
 * through untouched, and the optimizer then fetches that path from this very server.
 */
function safeImageSrc(url: string): string | null {
  const u = safeHref(url);
  if (!u) return null;
  if (/^https:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return withBasePath(u);
  return null;
}

const INLINE_RE = /(\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w])\*(?!\s)(.+?)(?<!\s)\*(?![\w])|(?<![\w])_(?!\s)(.+?)(?<!\s)_(?![\w]))/;

function renderInline(text: string, keyPrefix = "i"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length) {
    const m = INLINE_RE.exec(rest);
    if (!m || m.index === undefined) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const key = `${keyPrefix}${i++}`;
    if (m[2] !== undefined || m[3] !== undefined) {
      out.push(<strong key={key}>{renderInline(m[2] ?? m[3] ?? "", key)}</strong>);
    } else if (m[4] !== undefined) {
      out.push(
        <code key={key} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.9em] text-navy">
          {m[4]}
        </code>
      );
    } else if (m[5] !== undefined && m[6] !== undefined) {
      const href = safeHref(m[6]);
      if (!href) out.push(m[5]);
      else if (/^https?:\/\//i.test(href)) {
        out.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {renderInline(m[5], key)}
          </a>
        );
      } else if (href.startsWith("mailto:")) {
        out.push(
          <a key={key} href={href}>
            {renderInline(m[5], key)}
          </a>
        );
      } else {
        out.push(
          <Link key={key} href={href}>
            {renderInline(m[5], key)}
          </Link>
        );
      }
    } else if (m[7] !== undefined || m[8] !== undefined) {
      out.push(<em key={key}>{renderInline(m[7] ?? m[8] ?? "", key)}</em>);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

/**
 * The plain-text twin of {@link renderInline}: same grammar, same alternatives, same order,
 * but it returns a string instead of React nodes. Written as a mirror of the renderer rather
 * than as a pile of `.replace()` calls so a heading's TOC label can never disagree with what
 * the page actually shows — `**Why** it _matters_` reads "Why it matters" in both.
 */
function inlineText(text: string): string {
  let out = "";
  let rest = text;
  while (rest.length) {
    const m = INLINE_RE.exec(rest);
    if (!m || m.index === undefined) {
      out += rest;
      break;
    }
    if (m.index > 0) out += rest.slice(0, m.index);
    if (m[2] !== undefined || m[3] !== undefined) out += inlineText(m[2] ?? m[3] ?? "");
    else if (m[4] !== undefined) out += m[4];
    // A link contributes its label whether or not the href survives safeHref, exactly as the renderer does.
    else if (m[5] !== undefined) out += inlineText(m[5]);
    else if (m[7] !== undefined || m[8] !== undefined) out += inlineText(m[7] ?? m[8] ?? "");
    rest = rest.slice(m.index + m[0].length);
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * The anchor id for one heading, and THE only place an id is ever derived.
 *
 * `seen` is the caller's de-duplication map and is MUTATED: the first "Eligibility" keeps the
 * bare `eligibility`, the next becomes `eligibility-2`, then `-3` — the same convention as
 * `uniqueContentSlug()` in src/server/cms-admin.ts, so a repeated heading behaves the way a
 * repeated slug does. An empty or symbol-only heading falls back to `section`.
 *
 * Both {@link Markdown} and {@link extractHeadings} call this, walking the SAME headings in the
 * SAME order through one map. That is the whole contract: if a second parser ever derives ids
 * on its own, every table-of-contents link silently points at nothing.
 */
export function headingId(text: string, seen: Map<string, number>): string {
  const base = slugify(inlineText(text)) || "section";
  const nth = (seen.get(base) ?? 0) + 1;
  seen.set(base, nth);
  return nth === 1 ? base : `${base}-${nth}`;
}

/**
 * One row of a table of contents. `level` is the RENDERED tag level, not the number of `#`
 * characters: `#` renders as `<h2>` (the article's own `<h1>` is the page title), `##` as
 * `<h3>`, and both `###` and `####` flatten to `<h4>` — the `Math.min(4, level + 1)` rule
 * below. Consumers indent on this value, so it has to be what is actually in the DOM.
 */
export type TocHeading = { id: string; level: 2 | 3 | 4 | 5; text: string };

/** `#` → h2, `##` → h3, `###`/`####` → h4. Shared by the renderer and the extractor. */
function renderedLevel(level: number): 2 | 3 | 4 | 5 {
  return Math.min(4, level + 1) as 2 | 3 | 4 | 5;
}

/**
 * Every heading in `source`, in document order, with the id it will carry once rendered.
 *
 * The walk visits EVERY heading block — including the `###`/`####` ones a shallow TOC throws
 * away — before `maxLevel` filters the result. That ordering is load-bearing: the `seen` map
 * has to advance on the skipped headings too, otherwise a `##` that follows two identical
 * `####`s would be numbered differently here than it is in the rendered article.
 */
export function extractHeadings(source: string, opts?: { maxLevel?: 2 | 3 | 4 }): TocHeading[] {
  const maxLevel = opts?.maxLevel ?? 3;
  const seen = new Map<string, number>();
  const all: TocHeading[] = [];
  for (const block of parseMarkdown(source ?? "")) {
    if (block.type !== "heading") continue;
    all.push({ id: headingId(block.text, seen), level: renderedLevel(block.level), text: inlineText(block.text) });
  }
  return all.filter((h) => h.level <= maxLevel);
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "code"; text: string };

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isSeparatorRow = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** A whole line that is nothing but `![alt](src)` — an article illustration, not an inline icon. */
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) buf.push(lines[i++]!);
      i++;
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (h) {
      blocks.push({ type: "heading", level: h[1]!.length, text: h[2]!.replace(/\s#+$/, "") });
      i++;
      continue;
    }
    const img = IMAGE_RE.exec(trimmed);
    if (img) {
      blocks.push({ type: "image", src: img[2]!, alt: img[1]! });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (trimmed.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) buf.push(lines[i++]!.trim().replace(/^>\s?/, ""));
      blocks.push({ type: "quote", lines: buf });
      continue;
    }
    if (trimmed.startsWith("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1]!)) {
      const header = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(splitRow(lines[i++]!));
      blocks.push({ type: "table", header, rows });
      continue;
    }
    const ul = /^[-*+]\s+(.*)$/.exec(trimmed);
    const ol = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (ul || ol) {
      const ordered = !!ol;
      const re = ordered ? /^\d+[.)]\s+(.*)$/ : /^[-*+]\s+(.*)$/;
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i]!.trim();
        const m = re.exec(t);
        if (m) {
          items.push(m[1]!);
          i++;
        } else if (t && /^\s{2,}/.test(lines[i]!) && items.length) {
          items[items.length - 1] += " " + t;
          i++;
        } else break;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length) {
      const t = lines[i]!.trim();
      if (!t || /^(#{1,4})\s/.test(t) || t.startsWith(">") || t.startsWith("```") || IMAGE_RE.test(t) || /^[-*+]\s+/.test(t) || /^\d+[.)]\s+/.test(t) || /^(-{3,}|\*{3,}|_{3,})$/.test(t) || (t.startsWith("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1]!))) break;
      buf.push(t);
      i++;
    }
    blocks.push({ type: "paragraph", text: buf.join(" ") });
  }
  return blocks;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source ?? "");
  // ONE de-duplication map for the whole document, advanced in block order. `extractHeadings`
  // does exactly the same walk, which is what keeps every TOC link pointing at a real anchor.
  const seen = new Map<string, number>();
  return (
    <div className={cn("prose-content", className)}>
      {blocks.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.type) {
          case "heading": {
            const Tag = (`h${renderedLevel(b.level)}` as "h2" | "h3" | "h4" | "h5");
            const id = headingId(b.text, seen);
            return (
              <Tag key={key} id={id} className="group scroll-mt-28">
                {renderInline(b.text, key)}
                {/* Deliberately not aria-hidden: it is a real, focusable link to this section, just
                    a quiet one — invisible until the heading is hovered or the link is focused. */}
                <a href={`#${id}`} className="heading-anchor" aria-label={`Permalink to ${inlineText(b.text)}`}>
                  #
                </a>
              </Tag>
            );
          }
          case "image": {
            const src = safeImageSrc(b.src);
            // An unsafe or unparseable src is shown as the literal source line rather than dropped,
            // so an author can see what they typed instead of staring at a gap.
            if (!src) return <p key={key}>{`![${b.alt}](${b.src})`}</p>;
            return (
              <figure key={key}>
                {/* NOT `Media`: that is a FIXED-ratio fill frame (`media media-16x9`), and a body
                    illustration — a chart, a screenshot, a certificate — has an intrinsic ratio
                    nobody declared. So this is a plain, flowing image: `w-full h-auto` keeps its
                    own shape, while `width`/`height` are only the 16:9 hint next/image needs to
                    build a srcset (and to reserve roughly the right space before it loads).
                    Optimising matters here more than anywhere else on the page — a body image is
                    frequently the article's LCP element and is whatever size the author uploaded. */}
                <Image
                  src={src}
                  alt={b.alt}
                  width={1600}
                  height={900}
                  sizes="(min-width: 768px) 720px, 100vw"
                  loading="lazy"
                  className="h-auto w-full rounded-card"
                />
                {b.alt && <figcaption>{b.alt}</figcaption>}
              </figure>
            );
          }
          case "paragraph":
            return <p key={key}>{renderInline(b.text, key)}</p>;
          case "list":
            return b.ordered ? (
              <ol key={key}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </ol>
            ) : (
              <ul key={key}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote key={key}>
                {b.lines.map((l, j) => (
                  <p key={j} className="mb-1 last:mb-0">
                    {renderInline(l, `${key}-${j}`)}
                  </p>
                ))}
              </blockquote>
            );
          case "table":
            return (
              <div key={key} className="relative my-4 overflow-x-auto scrollbar-thin">
                <table>
                  <thead>
                    <tr>
                      {b.header.map((h, j) => (
                        <th key={j}>{renderInline(h, `${key}-h${j}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {b.header.map((_, c) => (
                          <td key={c}>{renderInline(row[c] ?? "", `${key}-${r}-${c}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={key} className="my-8 border-line" />;
          case "code":
            return (
              <pre key={key} className="relative my-4 overflow-x-auto rounded-card bg-navy p-4 text-body-sm text-white scrollbar-thin">
                <code>{b.text}</code>
              </pre>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/** Plain-text excerpt of markdown (for meta descriptions and cards). */
export function markdownExcerpt(source: string | null | undefined, max = 160) {
  if (!source) return "";
  const text = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

