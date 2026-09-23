import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * One blog tag, as a pill link.
 *
 * WHY THIS EXISTS: the class string below was copy-pasted verbatim as a local `TAG` constant in
 * BOTH blog pages, which is how the two drifted — the index rendered `#tag` filters as
 * `/blog?tag=…` while the article page rendered the same pill pointing somewhere else. One
 * component, one class string, one default destination.
 *
 * SERVER COMPONENT: a pill is a link with a hover colour. Nothing here needs JavaScript.
 */

/** `md` is the comfortable 44px pill. `sm` is the 36px pill dense rows can afford. */
export type TagPillSize = "sm" | "md";

/**
 * The pill's classes, exported for the rare caller that needs the look on an element this
 * component cannot render (a non-navigating chip in a form, for instance). Prefer `<TagPill>`.
 *
 * `relative` is not decorative: the `sm` size pads its hit area back out to 44px with a
 * transparent `::after`, and that pseudo-element has to anchor to the pill. Deliberately NOT
 * `overflow-hidden` — that would clip the padded target away again, which is exactly the bug the
 * same recipe avoids in `social-links.tsx`.
 */
export function tagPillClasses({ active, size = "md", className }: { active?: boolean; size?: TagPillSize; className?: string } = {}) {
  return cn(
    "ring-focus relative inline-flex items-center rounded-full font-semibold transition-colors duration-micro tap-highlight-none motion-reduce:transition-none",
    size === "sm"
      ? // 36px pill, 44px target: the transparent ::after adds 4px on every side.
        "min-h-9 px-3 text-caption after:absolute after:-inset-1 after:rounded-full after:content-['']"
      : "min-h-11 px-4 text-body-sm",
    active
      ? // The current tag is the destination you are already on: filled, and it stays filled on
        // hover so it never pretends to be another place to go.
        "bg-navy text-white"
      : "bg-lavender text-navy hover:bg-navy hover:text-white",
    className
  );
}

export interface TagPillProps {
  /** The exact label stored in `Blog.tags` — what the reader sees, `#` prefix added here. */
  name: string;
  /** `BlogTag.slug`. Only needed for the default href. */
  slug?: string | null;
  /** Overrides the destination — e.g. an index page that filters in place with `?tag=`. */
  href?: string;
  /** Marks the tag whose archive is currently open. Adds `aria-current="page"`. */
  active?: boolean;
  size?: TagPillSize;
  className?: string;
}

export function TagPill({ name, slug, href, active, size = "md", className }: TagPillProps) {
  // The tag archive is the canonical home of a tag, but it resolves its segment through
  // `BlogTag.slug` — so the LABEL must never be substituted for one. `Blog.tags` stores labels
  // ("digital literacy"), and feeding those to `/blog/tag/[slug]` 404s every tag whose label is
  // not already its own slug. It cannot be fixed by slugifying here either, because
  // `uniqueContentSlug` may have disambiguated a colliding slug to `ai-2`, which no amount of
  // slugifying the label would reproduce.
  //
  // So: use the archive only when a real slug was handed to us, and otherwise fall back to the
  // index's `?tag=` filter, which matches on the label exactly as stored.
  const to = href ?? (slug ? `/blog/tag/${encodeURIComponent(slug)}` : `/blog?tag=${encodeURIComponent(name)}`);
  return (
    <Link href={to} aria-current={active ? "page" : undefined} className={tagPillClasses({ active, size, className })}>
      {/* The hash is typography, not content: it is how a tag is written, but a screen reader
          announcing "number sign tailoring" on every pill in a cloud is noise. Hidden, so the
          accessible name of the link is the tag itself. */}
      <span aria-hidden>#</span>
      {name}
    </Link>
  );
}
