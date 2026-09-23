"use client";

import * as React from "react";
import { Bold, Heading2, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Quote } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { MarkdownPreview } from "@/components/admin/content/markdown";
import { extractHeadings, markdownWordCount, readingMinutes } from "@/lib/blog/markdown";
import { cn } from "@/lib/utils";

/**
 * The blog body editor: a formatting toolbar, Write / Preview / Side-by-side, and a footer that
 * reports what the post is actually going to cost a reader.
 *
 * This is a deliberate FORK of the module-local `MarkdownTextarea` in
 * `@/components/admin/content/fields` (which is not exported, and which drives `/admin/cms/pages`
 * and `/admin/events` as well). Two things differ and neither belongs in the shared control: an
 * image button — only the blog's renderer accepts `![alt](src)` in the body — and a footer that
 * shows reading time and heading count, the two numbers a blog author edits against. The cost is
 * that a fix to the toolbar has to be applied in both files; that is cheaper than adding blog-only
 * branches to a control two other screens depend on.
 *
 * The word count and reading time come from `@/lib/blog/markdown`, the SAME functions the service
 * stores on `Blog.wordCount` / `Blog.readingMinutes` at save time — so the footer is a preview of
 * the stored number, not a second opinion about it.
 */

type MdView = "write" | "preview" | "split";
type MdTool = "bold" | "italic" | "h2" | "ul" | "ol" | "quote" | "link" | "image";

/** Wraps the selection (or inserts a placeholder) with Markdown syntax and restores the caret. */
function applyMarkdown(el: HTMLTextAreaElement, value: string, kind: MdTool) {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end);
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let next = value;
  let caretFrom = start;
  let caretTo = end;
  const wrap = (before: string, after: string, placeholder: string) => {
    const text = selected || placeholder;
    next = value.slice(0, start) + before + text + after + value.slice(end);
    caretFrom = start + before.length;
    caretTo = caretFrom + text.length;
  };
  const prefixLines = (prefix: (i: number) => string) => {
    const block = value.slice(lineStart, end) || "";
    const lines = (block || "List item").split("\n").map((l, i) => prefix(i) + l.replace(/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?)/, ""));
    const text = lines.join("\n");
    next = value.slice(0, lineStart) + text + value.slice(end);
    caretFrom = lineStart;
    caretTo = lineStart + text.length;
  };
  switch (kind) {
    case "bold":
      wrap("**", "**", "bold text");
      break;
    case "italic":
      wrap("*", "*", "italic text");
      break;
    case "link":
      wrap("[", "](https://)", "link text");
      break;
    case "image":
      // The selection becomes the ALT text, because that is the part an author forgets and the
      // part a screen reader needs. The site renderer only accepts `/…` and `https://…` sources,
      // so the placeholder target starts the author on a valid one.
      wrap("![", "](https://)", "describe the image");
      break;
    case "h2":
      prefixLines(() => "## ");
      break;
    case "ul":
      prefixLines(() => "- ");
      break;
    case "ol":
      prefixLines((i) => `${i + 1}. `);
      break;
    case "quote":
      prefixLines(() => "> ");
      break;
  }
  return { next, caretFrom, caretTo };
}

const MD_TOOLS: { kind: MdTool; label: string; icon: React.ReactNode }[] = [
  { kind: "bold", label: "Bold", icon: <Bold className="h-4 w-4" /> },
  { kind: "italic", label: "Italic", icon: <Italic className="h-4 w-4" /> },
  { kind: "h2", label: "Heading", icon: <Heading2 className="h-4 w-4" /> },
  { kind: "ul", label: "Bulleted list", icon: <List className="h-4 w-4" /> },
  { kind: "ol", label: "Numbered list", icon: <ListOrdered className="h-4 w-4" /> },
  { kind: "quote", label: "Quote", icon: <Quote className="h-4 w-4" /> },
  { kind: "link", label: "Link", icon: <LinkIcon className="h-4 w-4" /> },
  { kind: "image", label: "Image", icon: <ImageIcon className="h-4 w-4" /> },
];

export interface BlogMarkdownEditorProps {
  /** Id of the textarea, so `<Field label>` and the form's ErrorSummary can point at it. */
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** Rendered by the surrounding `<Field>`; used here only for the invalid border. */
  error?: string;
  disabled?: boolean;
}

export function BlogMarkdownEditor({ id, value, onChange, error, disabled }: BlogMarkdownEditorProps) {
  const [view, setView] = React.useState<MdView>("write");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const invalid = !!error;

  // One parse pass per keystroke over a body that is at most 200 KB and usually a few KB; both
  // helpers are pure string work with no allocation beyond the split, so this stays imperceptible.
  const stats = React.useMemo(
    () => ({ words: markdownWordCount(value), minutes: readingMinutes(value), headings: extractHeadings(value, { maxLevel: 4 }).length }),
    [value]
  );

  const tool = (kind: MdTool) => {
    const el = ref.current;
    if (!el) return;
    const { next, caretFrom, caretTo } = applyMarkdown(el, value, kind);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caretFrom, caretTo);
    });
  };

  const showEditor = view !== "preview";
  const showPreview = view !== "write";

  return (
    <div className={cn("overflow-hidden rounded-card border bg-white transition-colors duration-micro focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/20 motion-reduce:transition-none", invalid ? "border-danger" : "border-line")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/70 px-2 py-1.5">
        <div className="no-scrollbar relative flex min-w-0 items-center gap-0.5 overflow-x-auto" role="toolbar" aria-label="Formatting" aria-controls={id}>
          {MD_TOOLS.map((t) => (
            <IconButton key={t.kind} size="sm" icon={t.icon} aria-label={t.label} title={t.label} onClick={() => tool(t.kind)} disabled={disabled || !showEditor} />
          ))}
        </div>
        <SegmentedControl
          value={view}
          onChange={(v) => setView(v as MdView)}
          aria-label="Editor view"
          items={[
            { value: "write", label: "Write" },
            { value: "preview", label: "Preview" },
            { value: "split", label: "Side by side" },
          ]}
          /* Side-by-side needs two readable columns; below lg the segment is hidden rather than
             offered and then ignored. */
          className="[&>button:last-child]:hidden lg:[&>button:last-child]:inline-flex"
        />
      </div>
      <div className={cn("grid", view === "split" && "lg:grid-cols-2 lg:divide-x lg:divide-line")}>
        {showEditor && (
          <Textarea
            id={id}
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={20}
            placeholder={"Write in Markdown:\n\n# Section heading\n\nA paragraph. **Bold**, *italic*, [a link](https://…).\n\n- a list item"}
            invalid={invalid}
            disabled={disabled}
            className="rounded-none border-0 font-mono focus:ring-0"
          />
        )}
        {showPreview && (
          <div className={cn("max-h-[32rem] min-h-40 overflow-y-auto p-4", view === "split" && "max-lg:hidden")} aria-live="polite" aria-label="Preview">
            <MarkdownPreview content={value} />
          </div>
        )}
      </div>
      <p className="border-t border-line px-3 py-1.5 text-caption text-muted tabular-nums">
        {stats.words.toLocaleString("en-IN")} word{stats.words === 1 ? "" : "s"} · ~{stats.minutes} min read · {stats.headings} heading{stats.headings === 1 ? "" : "s"}
      </p>
    </div>
  );
}
