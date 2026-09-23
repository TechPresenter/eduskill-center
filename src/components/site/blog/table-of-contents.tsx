import { ChevronDown } from "lucide-react";
import type { TocHeading } from "@/lib/blog/markdown";
import { cn } from "@/lib/utils";

/**
 * The article's table of contents — pure links, rendered on the SERVER.
 *
 * The `headings` come from `extractHeadings(post.content)`, which walks the same blocks through
 * the same `headingId()` as `<Markdown>` does when it renders. That shared walk is the whole
 * contract: derive ids anywhere else and every link here silently jumps to nothing.
 *
 * NO JavaScript is required for this to work — it is a list of in-page anchors, and the article's
 * headings already carry `scroll-margin-top` so the sticky header does not cover the landing
 * spot. `<TocActive>` is a separate, optional island that only adds the "you are here" highlight.
 *
 * Both variants can be in the DOM at once on the article page (the disclosure below `lg`, the
 * aside from `lg` up), so `id` MUST differ between the two instances — hence a per-variant
 * default rather than one shared constant. Duplicate ids would break both the heading association
 * and `TocActive`'s `navId` lookup.
 */

export interface TableOfContentsProps {
  headings: TocHeading[];
  /** `aside` is the sticky desktop rail; `disclosure` is the collapsed `<details>` for phones. */
  variant?: "aside" | "disclosure";
  /** The `<nav>`/`<details>` id. Pass the same value to `<TocActive navId>`. */
  id?: string;
  className?: string;
}

/**
 * `level` is the RENDERED heading tag (`#` → h2, `##` → h3, `###`/`####` → h4), so the indent
 * steps off the real document outline rather than off the number of hashes an author typed.
 */
const INDENT: Record<number, string> = { 2: "", 3: "ml-3", 4: "ml-6", 5: "ml-9" };

export function TableOfContents({ headings, variant = "aside", id, className }: TableOfContentsProps) {
  // One heading is not a table of contents — it is a link to the top of the article the reader is
  // already looking at. Render nothing rather than an empty box.
  if (headings.length < 2) return null;

  const navId = id ?? (variant === "aside" ? "blog-toc" : "blog-toc-mobile");
  const titleId = `${navId}-title`;

  const list = (
    <ol className={cn("space-y-0.5", variant === "disclosure" && "mt-2")}>
      {headings.map((h) => (
        <li key={h.id} className={INDENT[h.level] ?? ""}>
          {/*
            A plain `<a href="#…">`, never a next/link: this is an in-page jump, and the router
            would add a history entry and re-run the scroll restoration for no benefit.
            `toc-link` is already `flex min-h-11 items-center`, so each row clears 44px.
          */}
          <a href={`#${h.id}`} className="toc-link">
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "disclosure") {
    return (
      // Never `open`: on a phone this sits between the hero and the first paragraph, and an
      // expanded fifteen-row list there pushes the article itself off the screen.
      <details id={navId} className={cn("group card card-p", className)}>
        <summary className="ring-focus -m-2 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md p-2 text-body-sm font-semibold text-navy marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="text-overline text-muted">On this page</span>
          <span className="text-caption font-normal text-muted">· {headings.length} sections</span>
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted transition-transform duration-micro group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        {list}
      </details>
    );
  }

  return (
    <nav id={navId} aria-labelledby={titleId} className={cn("lg:sticky lg:top-24", className)}>
      <h2 id={titleId} className="text-overline text-muted">
        On this page
      </h2>
      {/* No rail of its own: `toc-link` already carries the 2px left border that IS the active
          indicator, and a second hairline beside it reads as a rendering mistake. */}
      <div className="mt-3">{list}</div>
    </nav>
  );
}
