/**
 * Markdown text measurements for the blog — plain text, word count and reading time.
 *
 * Pure and JSX-free so a service, a Zod transform or a test can call it without pulling the
 * renderer's React tree in. `readingMinutes` and `markdownWordCount` are what `blogData()`
 * stores on `Blog.readingMinutes` / `Blog.wordCount` at save time, so a card can show
 * "6 min read" without the 200 KB body column ever leaving the database.
 *
 * Heading parsing lives ONE level up, in `@/components/site/markdown`, and is only re-exported
 * from here so consumers have a single `@/lib/blog` import path. Do not re-implement it: a
 * second heading parser is exactly how the table-of-contents anchors drift out of sync with
 * the ids the article actually renders.
 */

export { extractHeadings, headingId, type TocHeading } from "@/components/site/markdown";

/**
 * Markdown → readable plain text: fenced code, heading hashes, list markers, table pipes,
 * blockquote markers, emphasis and link/image syntax all come off, whitespace collapses.
 *
 * Deliberately lossy and order-dependent — fences go first so a `#` inside a code sample is
 * never mistaken for a heading, and link labels are kept while their URLs are dropped so a
 * word count measures what a person reads rather than what they click.
 */
export function stripMarkdown(source: string | null | undefined): string {
  if (!source) return "";
  return (
    source
      .replace(/\r\n?/g, "\n")
      // Fenced code first: everything inside it is sample text, not prose.
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]*)`/g, "$1")
      // Images contribute nothing to reading time; their alt text is a caption, not a sentence.
      .replace(/!\[[^\]]*\]\([^)\s]*\)/g, " ")
      // Links keep the label, lose the target.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+[.)]\s+/gm, "")
      // A table separator row (|---|---|) is layout, not words; other rows keep their cells.
      .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, " ")
      .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, " ")
      .replace(/\|/g, " ")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "$1")
      .replace(/(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Words a reader actually reads, counted on {@link stripMarkdown} output. */
export function markdownWordCount(source: string | null | undefined): number {
  const text = stripMarkdown(source);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Reading time in whole minutes, never below 1 — "0 min read" is worse than slightly wrong.
 * 200 wpm is the conservative end of the usual 200–250 range, which suits a mixed-language
 * audience reading on a phone better than an optimistic estimate.
 */
export function readingMinutes(source: string | null | undefined, wpm = 200): number {
  return Math.max(1, Math.ceil(markdownWordCount(source) / Math.max(1, wpm)));
}
