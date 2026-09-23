import Link from "next/link";
import { Avatar } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { PostMeta, type PostMetaTone } from "./post-meta";

/**
 * The compact "who wrote this and when" line for the top of an article.
 *
 * `Blog` carries BOTH a real `author` relation and the legacy `authorName` string, and the string
 * is not dead weight: it is still the way a one-off guest byline is written, and it is what every
 * pre-migration post has. So the byline takes both and prefers the row — a real author gets an
 * avatar, a role and a link to their archive; a bare name gets initials and no link, which is
 * honest about there being nothing to click through to.
 */

export interface BylineAuthor {
  name: string;
  slug: string;
  avatar?: string | null;
  role?: string | null;
}

export interface AuthorBylineProps {
  author?: BylineAuthor | null;
  /** `Blog.authorName` — the fallback byline when there is no author row. */
  authorName?: string | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
  readingMinutes?: number | null;
  /** `dark` for the navy article hero, `light` on white. */
  tone?: PostMetaTone;
  className?: string;
}

export function AuthorByline({ author, authorName, publishedAt, createdAt, readingMinutes, tone = "light", className }: AuthorBylineProps) {
  const name = author?.name ?? authorName ?? null;
  const dark = tone === "dark";

  // No byline at all: fall back to the plain meta row rather than an avatar of nobody.
  if (!name) return <PostMeta publishedAt={publishedAt} createdAt={createdAt} readingMinutes={readingMinutes} tone={tone} className={className} />;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar name={name} src={author?.avatar} size={40} className={cn("shrink-0", dark ? "ring-2 ring-white/25" : "ring-2 ring-lavender")} />
      <div className="min-w-0">
        <p className={cn("truncate text-body-sm font-semibold", dark ? "text-white" : "text-navy")}>
          {author ? (
            <Link
              href={`/blog/author/${author.slug}`}
              className={cn("ring-focus rounded-sm underline-offset-4 transition-colors duration-micro hover:underline motion-reduce:transition-none", dark ? "ring-focus-inverse hover:text-orange-light" : "hover:text-orange")}
            >
              {author.name}
            </Link>
          ) : (
            name
          )}
          {author?.role && <span className={cn("font-normal", dark ? "text-white/70" : "text-muted")}> · {author.role}</span>}
        </p>
        {/* The name is already above, so the meta row drops the byline and keeps date + reading time. */}
        <PostMeta publishedAt={publishedAt} createdAt={createdAt} readingMinutes={readingMinutes} tone={tone} className="mt-0.5" />
      </div>
    </div>
  );
}
