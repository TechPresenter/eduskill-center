import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * The blog's category filter row: "All" plus one chip per category that actually has live posts.
 *
 * SERVER COMPONENT, and the chips are LINKS, not buttons. `CourseCatalog` filters an
 * already-loaded array in the browser; the blog is paginated server-side, so each category is a
 * real, indexable, shareable URL (`/blog/category/<slug>`). That also means the row works with
 * JavaScript off and needs no hydration on the index, the article page or the three archives.
 *
 * Below `lg` it is one edge-to-edge swipe row (`hscroll`, which is `position: relative` so an
 * `sr-only` descendant can never stretch `document.scrollWidth`); from `lg` up it wraps.
 */

/**
 * Shape accepted from `listPublicCategories()`. Structural on purpose — any Prisma `select` with
 * these fields satisfies it, so this file never has to import the service and the service never
 * has to know a component exists.
 */
export interface CategoryChipItem {
  id: string;
  name: string;
  slug: string;
  /** A `BadgeTone` name from `BlogCategory.colorTone`. Unknown / null falls back to the neutral chip. */
  colorTone?: string | null;
  /**
   * Live post count. `listPublicCategories()` flattens it to `postCount`; the raw Prisma shape is
   * `_count.posts`. Both are accepted so a caller can pass either without reshaping the row — and
   * either way it is a real, live-gated count, never a number written into the markup.
   */
  postCount?: number | null;
  _count?: { posts: number } | null;
}

/**
 * Tints for a chip at rest, keyed by the tone name an editor picked in the admin. Only the four
 * tones that read as a *category* are offered — `success` / `warning` / `danger` carry status
 * meaning elsewhere in the product and would say the wrong thing on a blog taxonomy chip.
 *
 * The active chip ignores the tone entirely (see below): one filled navy chip is easier to find
 * in a scrolling row than six differently-tinted ones, and it matches the course catalogue.
 */
const CHIP_REST_DEFAULT = "border-line bg-white text-navy hover:border-navy/40 hover:bg-lavender";

const TONE_REST: Partial<Record<BadgeTone, string>> = {
  navy: "border-navy/15 bg-navy-soft text-navy hover:border-navy/40",
  orange: "border-orange/20 bg-orange-light text-orange hover:border-orange/45",
  info: "border-info/20 bg-info-light text-info-dark hover:border-info/45",
  neutral: CHIP_REST_DEFAULT,
};

export interface CategoryChipsProps {
  categories: CategoryChipItem[];
  /** The category archive currently open, or undefined on `/blog` where "All" is current. */
  activeSlug?: string | null;
  /** Where the "All" chip goes. Kept overridable so a filtered index can return to its own base URL. */
  allHref?: string;
  className?: string;
}

export function CategoryChips({ categories, activeSlug, allHref = "/blog", className }: CategoryChipsProps) {
  // A row with nothing but "All" is a control that cannot control anything. Render nothing.
  if (categories.length === 0) return null;

  return (
    <div
      className={cn(
        "hscroll gap-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0",
        className
      )}
      role="group"
      aria-label="Filter posts by category"
    >
      <Chip href={allHref} active={!activeSlug} rest={CHIP_REST_DEFAULT}>
        All posts
      </Chip>
      {categories.map((c) => {
        const count = typeof c.postCount === "number" ? c.postCount : c._count?.posts;
        return (
          <Chip key={c.id} href={`/blog/category/${c.slug}`} active={c.slug === activeSlug} rest={TONE_REST[c.colorTone as BadgeTone] ?? CHIP_REST_DEFAULT}>
            {c.name}
            {/* Real counts or nothing: a chip that says "0" is a link to an empty page, and a
                hard-coded number would be a lie the moment a post is scheduled. */}
            {typeof count === "number" && count > 0 && (
              <span className="text-caption tabular-nums opacity-70">{count}</span>
            )}
          </Chip>
        );
      })}
    </div>
  );
}

function Chip({ href, active, rest, children }: { href: string; active: boolean; rest: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "ring-focus inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-body-sm font-semibold whitespace-nowrap transition-colors duration-micro tap-highlight-none motion-reduce:transition-none",
        active ? "border-navy bg-navy text-white" : rest
      )}
    >
      {children}
    </Link>
  );
}
