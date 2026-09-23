import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Previous / Next article" — the two tiles at the foot of a post.
 *
 * Ordered by `publishedAt`, so "previous" means OLDER and "next" means NEWER. The arrows point
 * the way the reader is moving through the archive, not the way the DOM is laid out.
 *
 * A post can be at either end of the archive, so either tile can be missing; the remaining one
 * keeps its own half of the grid rather than stretching across, which would make an "only next"
 * page look like a different component from an "only previous" one.
 */

/**
 * Named `PrevNextPost`, not `AdjacentPost`, purely so a page can import this and
 * `AdjacentPost` from `@/server/blog-public` in the same file without aliasing one of them. The
 * service's type is a superset (it also carries the cover), so it drops straight in.
 */
export interface PrevNextPost {
  slug: string;
  title: string;
}

export function PrevNextPosts({ prev, next, className }: { prev?: PrevNextPost | null; next?: PrevNextPost | null; className?: string }) {
  if (!prev && !next) return null;

  return (
    <nav aria-label="More articles" className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {prev ? <Tile post={prev} direction="prev" /> : <span aria-hidden className="hidden sm:block" />}
      {next && <Tile post={next} direction="next" />}
    </nav>
  );
}

function Tile({ post, direction }: { post: PrevNextPost; direction: "prev" | "next" }) {
  const isNext = direction === "next";
  return (
    <article className={cn("group card card-hover relative flex min-h-11 flex-col card-p", isNext && "sm:text-right")}>
      <p className={cn("flex items-center gap-1.5 text-overline text-muted", isNext && "sm:justify-end")}>
        {!isNext && <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-orange transition-transform duration-micro group-hover:-translate-x-0.5 motion-reduce:transition-none" aria-hidden />}
        {isNext ? "Next article" : "Previous article"}
        {isNext && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-orange transition-transform duration-micro group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />}
      </p>
      {/* A `<p>`, not a heading: these two tiles are navigation, already named by the `<nav>`
          landmark, and two more h2s would put "Previous article" into the article's outline. */}
      <p className="mt-1 text-h4 text-navy">
        {/* Stretched link: the tile is the target, and there is nothing else inside it to click. */}
        <Link href={`/blog/${post.slug}`} className="transition-colors duration-micro after:absolute after:inset-0 hover:text-orange focus-visible:text-orange motion-reduce:transition-none">
          {post.title}
        </Link>
      </p>
    </article>
  );
}
