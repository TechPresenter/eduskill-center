import { CalendarDays, Clock, UserRound } from "lucide-react";
import { cn, formatDate, toDate } from "@/lib/utils";

/**
 * The one meta row for a blog post — date, reading time, byline — used on every card, on the
 * archives and inside the navy article hero.
 *
 * Before this existed the index card and the article hero each built their own version, with
 * different icon sizes, different separators and no reading time on either. Having exactly one
 * makes the `<time dateTime>` machine-readable everywhere, which the JSON-LD and the RSS feed
 * both assume.
 *
 * NOTE: there is deliberately no view count here. The blog stores no `viewCount` and exposes no
 * public write endpoint to increment one — an unauthenticated public write is attack surface
 * this product does not need.
 */

export type PostMetaTone = "light" | "dark";

export interface PostMetaProps {
  /** `publishedAt`, with `createdAt` as the fallback for a row that never got stamped. */
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
  /** `Blog.readingMinutes` — stored at save time, never recomputed from the body here. */
  readingMinutes?: number | null;
  /** Byline text. Omit on cards that already render an `AuthorByline` with an avatar. */
  authorName?: string | null;
  /** `dark` is the navy `PageHero`; `light` is a white card. */
  tone?: PostMetaTone;
  className?: string;
}

export function PostMeta({ publishedAt, createdAt, readingMinutes, authorName, tone = "light", className }: PostMetaProps) {
  const date = toDate(publishedAt) ?? toDate(createdAt);
  const minutes = typeof readingMinutes === "number" && readingMinutes > 0 ? readingMinutes : null;

  // Nothing to say is better said by rendering nothing than by an empty row that still takes
  // vertical rhythm on the card.
  if (!date && !minutes && !authorName) return null;

  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-caption", tone === "dark" ? "text-white/80" : "text-muted", className)}>
      {date && (
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-orange" aria-hidden />
          <time dateTime={date.toISOString()}>{formatDate(date)}</time>
        </span>
      )}
      {minutes && (
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-orange" aria-hidden />
          {minutes} min read
        </span>
      )}
      {authorName && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-orange" aria-hidden />
          <span className="truncate">{authorName}</span>
        </span>
      )}
    </p>
  );
}
