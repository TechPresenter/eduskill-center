import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Minimal, safe Markdown renderer for CMS content. Output is built from React elements
 * only – raw HTML in the source is shown as text, never injected.
 *
 * Supported: # / ## / ### / #### headings, paragraphs, **bold**, _italic_ / *italic*,
 * `code`, [links](url) (http/https/mailto/relative only), unordered & ordered lists,
 * > blockquotes, | tables |, horizontal rules and ``` fenced code blocks.
 */

function safeHref(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  if (/^(\/|#|\.\/)/.test(u)) return u;
  if (!u.includes(":")) return u; // bare relative path such as "courses"
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

type Block =
  | { type: "heading"; level: number; text: string }
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
      if (!t || /^(#{1,4})\s/.test(t) || t.startsWith(">") || t.startsWith("```") || /^[-*+]\s+/.test(t) || /^\d+[.)]\s+/.test(t) || /^(-{3,}|\*{3,}|_{3,})$/.test(t) || (t.startsWith("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1]!))) break;
      buf.push(t);
      i++;
    }
    blocks.push({ type: "paragraph", text: buf.join(" ") });
  }
  return blocks;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source ?? "");
  return (
    <div className={cn("prose-content", className)}>
      {blocks.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.type) {
          case "heading": {
            const Tag = (`h${Math.min(4, b.level + 1)}` as "h2" | "h3" | "h4" | "h5");
            return <Tag key={key}>{renderInline(b.text, key)}</Tag>;
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
              <div key={key} className="my-4 overflow-x-auto">
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
              <pre key={key} className="my-4 overflow-x-auto rounded-xl bg-navy p-4 text-sm text-white">
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
