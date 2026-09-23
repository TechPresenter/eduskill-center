import Link from "next/link";
import { Star } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Media } from "@/components/site/safe-image";
import { cn } from "@/lib/utils";
import { PostMeta } from "./post-meta";
import { TagPill } from "./tag-pill";

/**
 * ONE card for every blog post on the public site: the index grid, the three archives, the
 * "keep reading" strip and the featured slot.
 *
 * Before this there were two cards — the index's and the article page's related strip — which had
 * already drifted (different heading step, different meta row, one of them with no tags and a
 * "Read post" affordance the other lacked). A single component is also what makes the branded
 * placeholder consistent: `seed` and `mark` below ARE the no-photography fallback, so a post with
 * no cover gets deterministic on-brand geometry in the identical 16:9 box instead of a grey
 * rectangle or a layout shift when a cover is added later.
 *
 * SERVER COMPONENT. Everything here is links and CSS.
 */

/**
 * The fields a card needs. Structural, with everything optional that a caller might not select,
 * so `PublicPostCard` from `@/server/blog-public` satisfies it without this file importing the
 * service (and without the service having to know about components).
 */
export interface PostCardPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  coverImage?: string | null;
  coverImageAlt?: string | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
  readingMinutes?: number | null;
  tags?: string[] | null;
  isFeatured?: boolean | null;
  category?: { id?: string; name: string; slug: string; colorTone?: string | null } | null;
  author?: { name: string; slug?: string | null } | null;
  authorName?: string | null;
}

export type PostCardVariant = "default" | "compact" | "featured";

export interface PostCardProps {
  post: PostCardPost;
  /** `compact` drops the tag row (dense "keep reading" strips); `featured` is the 2-column hero card. */
  variant?: PostCardVariant;
  /** Only for the one card that can be above the fold — the featured slot on page 1. */
  priority?: boolean;
  sizes?: string;
  /**
   * The rendered heading tag. Cards live under an `<h2>` section heading on the index and under
   * the article's own `<h1>` in the related strip, so the outline only stays correct if the
   * caller says which step it is at.
   */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** A category chip's tone, restricted to the ones that read as taxonomy rather than status. */
function categoryTone(tone: string | null | undefined): BadgeTone {
  return tone === "navy" || tone === "orange" || tone === "info" || tone === "neutral" ? tone : "navy";
}

export function PostCard({ post, variant = "default", priority, sizes, headingLevel = 3, className }: PostCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const featured = variant === "featured";
  const compact = variant === "compact";
  const tags = (post.tags ?? []).slice(0, 3);
  const href = `/blog/${post.slug}`;

  const cover = (
    <Media
      src={post.coverImage}
      // An empty alt when there is no cover: the placeholder is decoration, and repeating the
      // title there would make a screen reader announce it twice in one card.
      alt={post.coverImageAlt ?? (post.coverImage ? post.title : "")}
      seed={post.slug}
      mark={post.category?.name ?? post.title}
      ratio="16x9"
      tone="navy"
      sizes={sizes}
      priority={priority}
    >
      {(post.category || (featured && post.isFeatured)) && (
        <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {post.category && <Badge tone={categoryTone(post.category.colorTone)}>{post.category.name}</Badge>}
          {featured && post.isFeatured && (
            <Badge tone="orange">
              <Star className="h-3.5 w-3.5" aria-hidden /> Featured
            </Badge>
          )}
        </span>
      )}
    </Media>
  );

  return (
    <article
      className={cn(
        // `relative` anchors the stretched link; `overflow-hidden` clips the cover to the radius.
        "group card card-hover relative flex h-full flex-col overflow-hidden",
        featured && "lg:grid lg:grid-cols-2 lg:items-center",
        className
      )}
    >
      {/* Zero-radius wrapper: `media` inherits its radius, so this is what rounds the corners that
          meet the card edge and leaves the inner edge square against the body. */}
      <div className={cn("rounded-t-card", featured && "lg:rounded-t-none lg:rounded-l-card")}>{cover}</div>

      <div className={cn("flex flex-1 flex-col", compact ? "p-4 sm:p-5" : "card-p", featured && "lg:p-8")}>
        <PostMeta publishedAt={post.publishedAt} createdAt={post.createdAt} readingMinutes={post.readingMinutes} authorName={post.author?.name ?? post.authorName} />

        <Heading className={cn("mt-2 text-navy", featured ? "text-h2" : compact ? "text-h4" : "text-h3")}>
          {/* Stretched link: one tab stop, one announcement, the whole card is the target. The tag
              row below is raised over it so the pills stay individually clickable. */}
          <Link href={href} className="transition-colors duration-micro after:absolute after:inset-0 hover:text-orange focus-visible:text-orange motion-reduce:transition-none">
            {post.title}
          </Link>
        </Heading>

        {post.excerpt && <p className={cn("mt-2 flex-1 text-muted", compact ? "line-clamp-2 text-body-sm" : "line-clamp-3 text-body")}>{post.excerpt}</p>}

        {/* `mt-auto` only when there is no excerpt to absorb the slack — with one, the excerpt's
            `flex-1` already pushes the tag row to the bottom and a margin keeps it off the rule. */}
        {!compact && tags.length > 0 && (
          <ul className={cn("relative z-raised flex flex-wrap gap-1.5 border-t border-line pt-4", post.excerpt ? "mt-4" : "mt-auto")} aria-label="Tags">
            {tags.map((t) => (
              <li key={t}>
                <TagPill name={t} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
