import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal, safe Markdown renderer used for live previews in the admin (pages, programs, blog, events).
 * Supports headings, paragraphs, bullet / numbered lists, block quotes, code fences, horizontal rules,
 * **bold**, *italic*, `code` and [links](url). Raw HTML is never rendered.
 */

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key} className="rounded bg-surface px-1 py-0.5 text-[0.9em] text-navy">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("*")) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (lm && SAFE_HREF.test(lm[2]!)) {
        out.push(
          <a key={key} href={lm[2]} className="font-medium text-orange underline underline-offset-2" target={/^https?:/i.test(lm[2]!) ? "_blank" : undefined} rel="noopener noreferrer">
            {lm[1]}
          </a>
        );
      } else out.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { type: "h"; level: number; text: string }
  | { type: "p"; lines: string[] }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "code"; lines: string[] }
  | { type: "hr" };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) code.push(lines[i++]!);
      i++;
      blocks.push({ type: "code", lines: code });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "h", level: h[1]!.length, text: h[2]! });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*+]\s+/, ""));
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push({ type: "ol", items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) q.push(lines[i++]!.replace(/^\s*>\s?/, ""));
      blocks.push({ type: "quote", lines: q });
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|\s*>|```)/.test(lines[i]!)) p.push(lines[i++]!);
    blocks.push({ type: "p", lines: p });
  }
  return blocks;
}

const H_CLASS: Record<number, string> = {
  1: "text-2xl font-extrabold text-navy",
  2: "text-xl font-bold text-navy",
  3: "text-lg font-bold text-navy",
  4: "text-base font-bold text-navy",
  5: "text-sm font-bold text-navy",
  6: "text-sm font-semibold text-navy",
};

export function MarkdownPreview({ content, className, emptyText = "Nothing to preview yet." }: { content: string; className?: string; emptyText?: string }) {
  const blocks = React.useMemo(() => parseBlocks(content || ""), [content]);
  if (!blocks.length) return <p className={cn("text-sm text-muted", className)}>{emptyText}</p>;
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed break-words text-ink", className)}>
      {blocks.map((b, bi) => {
        const key = `b${bi}`;
        switch (b.type) {
          case "h": {
            const Tag = `h${Math.min(6, Math.max(1, b.level))}` as keyof React.JSX.IntrinsicElements;
            return React.createElement(Tag, { key, className: H_CLASS[b.level] }, renderInline(b.text, key));
          }
          case "hr":
            return <hr key={key} className="border-line" />;
          case "code":
            return (
              <pre key={key} className="overflow-x-auto rounded-xl bg-navy-dark p-3 text-xs text-white">
                <code>{b.lines.join("\n")}</code>
              </pre>
            );
          case "quote":
            return (
              <blockquote key={key} className="border-l-4 border-orange/60 pl-3 text-muted italic">
                {b.lines.map((l, li) => (
                  <React.Fragment key={li}>
                    {renderInline(l, `${key}-${li}`)}
                    {li < b.lines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </blockquote>
            );
          case "ul":
          case "ol": {
            const Tag = b.type;
            return (
              <Tag key={key} className={cn("space-y-1 pl-5", b.type === "ul" ? "list-disc" : "list-decimal")}>
                {b.items.map((it, li) => (
                  <li key={li}>{renderInline(it, `${key}-${li}`)}</li>
                ))}
              </Tag>
            );
          }
          case "p":
          default:
            return (
              <p key={key}>
                {b.lines.map((l, li) => (
                  <React.Fragment key={li}>
                    {renderInline(l, `${key}-${li}`)}
                    {li < b.lines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
