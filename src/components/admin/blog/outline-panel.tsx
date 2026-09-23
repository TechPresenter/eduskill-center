"use client";

import * as React from "react";
import { AlertTriangle, ListTree } from "lucide-react";
import { extractHeadings, headingId, type TocHeading } from "@/lib/blog/markdown";
import { cn } from "@/lib/utils";

/**
 * The live document outline, beside the editor.
 *
 * It is built with the SAME `extractHeadings` the article page uses to build its table of
 * contents, which is the same walk `<Markdown>` uses to stamp `id`s on the rendered headings.
 * That is the whole point: what an author sees here is exactly what the reader's table of
 * contents will say, anchors included. A second heading parser here would drift from the
 * renderer and every TOC link would quietly scroll to the wrong place.
 *
 * Recomputed on every keystroke rather than memoised, because `parseMarkdown` is pure and the
 * panel only mounts on `xl+` (or inside a closed `<details>` below it).
 *
 * It also reports the two structural mistakes a Markdown author cannot see:
 *
 *   SKIPPED LEVEL     `#` straight to `###`. Screen-reader users navigate by heading level, and a
 *                     gap reads as a missing section.
 *   DUPLICATE ANCHOR  two headings with the same text. The renderer keeps the links working by
 *                     suffixing the second one `-2`, so this is a warning, not an error — but the
 *                     author should see the real id before someone shares a link to it.
 */

/** `#` renders as `<h2>`, `##` as `<h3>`, `###`/`####` as `<h4>` — turn that back into what the author typed. */
function marker(level: TocHeading["level"]): string {
  return "#".repeat(Math.max(1, level - 1));
}

/** Left padding per rendered level, so the outline reads as a tree without an extra list per level. */
const INDENT: Record<TocHeading["level"], string> = { 2: "", 3: "pl-4", 4: "pl-8", 5: "pl-12" };

interface DuplicateGroup {
  text: string;
  ids: string[];
}

function analyse(headings: TocHeading[]) {
  const skipped: { text: string; from: string; to: string }[] = [];
  const byBase = new Map<string, DuplicateGroup>();

  headings.forEach((h, i) => {
    const previous = headings[i - 1];
    // No complaint about the first heading: a post that opens at `##` is unusual but coherent.
    if (previous && h.level > previous.level + 1) skipped.push({ text: h.text, from: marker(previous.level), to: marker(h.level) });

    // A FRESH `seen` map gives the bare slug this heading would have had on its own; grouping by
    // it catches collisions the way `headingId` itself does — after slugifying, so "Step 1" and
    // "step  1" are correctly reported as the same anchor.
    const base = headingId(h.text, new Map());
    const group = byBase.get(base);
    if (group) group.ids.push(h.id);
    else byBase.set(base, { text: h.text, ids: [h.id] });
  });

  return { skipped, duplicates: [...byBase.values()].filter((g) => g.ids.length > 1) };
}

export function OutlinePanel({ content, className }: { content: string; className?: string }) {
  const headings = extractHeadings(content, { maxLevel: 4 });
  const { skipped, duplicates } = analyse(headings);

  return (
    <div className={cn("space-y-3", className)}>
      <p className="flex items-center gap-2 text-overline text-muted">
        <ListTree className="h-4 w-4" aria-hidden />
        Outline
        {headings.length > 0 && <span className="font-semibold tracking-normal normal-case tabular-nums text-muted/80">{headings.length}</span>}
      </p>

      {headings.length === 0 ? (
        <p className="text-body-sm text-muted">
          Add <code className="rounded bg-surface px-1 py-0.5 font-mono text-[0.9em] text-navy">##</code> headings and they will appear here — and as a table of contents on the live page.
        </p>
      ) : (
        <ol className="space-y-0.5">
          {headings.map((h) => (
            <li key={h.id} className={INDENT[h.level]}>
              <span className="flex min-h-8 items-baseline gap-2 text-body-sm break-words text-ink">
                <span className="shrink-0 font-mono text-caption text-muted/70" aria-hidden>
                  {marker(h.level)}
                </span>
                <span className="min-w-0 flex-1">
                  {h.text}
                  <span className="ml-1.5 font-mono text-caption text-muted/70 break-all">#{h.id}</span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {skipped.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-light p-2.5 text-caption text-warning-dark" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {skipped.length === 1 ? (
              <>
                &ldquo;{skipped[0]!.text}&rdquo; jumps from <span className="font-mono">{skipped[0]!.from}</span> to <span className="font-mono">{skipped[0]!.to}</span>.
              </>
            ) : (
              <>{skipped.length} headings skip a level.</>
            )}{" "}
            Step one level at a time so the page reads correctly with a screen reader.
          </span>
        </p>
      )}

      {duplicates.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-light p-2.5 text-caption text-warning-dark" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {duplicates.map((g) => (
              <span key={g.ids[0]} className="block">
                {g.ids.length} headings are called &ldquo;{g.text}&rdquo;, so their links are <span className="font-mono break-all">#{g.ids.join(", #")}</span>.
              </span>
            ))}
            Rename one of them if you plan to share a link to it.
          </span>
        </p>
      )}
    </div>
  );
}
