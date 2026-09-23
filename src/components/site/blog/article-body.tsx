import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/badge";
import { Markdown, type TocHeading } from "@/components/site/markdown";
import { Media } from "@/components/site/safe-image";
import { displayStatus, scheduledIn } from "@/lib/blog/visibility";
import { cn } from "@/lib/utils";
import { AuthorCard, type AuthorCardAuthor } from "./author-card";
import { PostCard, type PostCardPost } from "./post-card";
import { PrevNextPosts, type PrevNextPost } from "./prev-next";
import { ShareRow } from "./share-row";
import { TableOfContents } from "./table-of-contents";
import { TagPill } from "./tag-pill";

/**
 * The whole article column: cover, phone table of contents, body, tags, share row, author block
 * and the previous/next tiles.
 *
 * It exists as a component rather than as markup inside `/blog/[slug]` for one reason: the draft
 * preview at `/blog/preview/[id]` renders THIS, so what a reviewer approves is the thing that
 * ships. Every difference between preview and live would otherwise be a bug waiting to be found
 * by a reader.
 *
 * SERVER COMPONENT. `ShareRow` is the only client island underneath it, and `headings` are
 * extracted on the server by `extractHeadings(post.content)` — the table of contents costs no
 * JavaScript at all.
 */

export interface ArticleBodyPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt?: string | null;
  coverImage?: string | null;
  coverImageAlt?: string | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
  readingMinutes?: number | null;
  tags?: string[] | null;
  /** Only needed in `preview` mode, to say WHY a post is not live yet. */
  status?: string | null;
  category?: { id?: string; name: string; slug: string; colorTone?: string | null } | null;
  author?: AuthorCardAuthor | null;
  authorName?: string | null;
}

export interface ArticleBodyProps {
  post: ArticleBodyPost;
  /** From `extractHeadings(post.content, { maxLevel: 3 })`, on the server. */
  headings?: TocHeading[];
  /** `absoluteUrl(\`/blog/${post.slug}\`)`, computed server-side so it is `/center`-correct. */
  shareUrl: string;
  /**
   * Optional "keep reading" strip rendered INSIDE the column. Pass it on the preview route, which
   * has no sections of its own; the live article page renders its own full-width related section
   * instead and leaves this empty.
   */
  related?: PostCardPost[];
  prev?: PrevNextPost | null;
  next?: PrevNextPost | null;
  /** Draft preview: adds the "not live" banner and the derived status. */
  preview?: boolean;
  className?: string;
}

export function ArticleBody({ post, headings = [], shareUrl, related, prev, next, preview, className }: ArticleBodyProps) {
  const tags = post.tags ?? [];
  const status = post.status ? displayStatus({ status: post.status, publishedAt: post.publishedAt ?? null }) : null;
  const goesLive = post.status ? scheduledIn({ status: post.status, publishedAt: post.publishedAt ?? null }) : null;

  return (
    <article className={cn("mx-auto w-full max-w-3xl lg:mx-0", className)}>
      {preview && (
        <Alert tone="warning" title="This is a preview" className="mb-6">
          <p>
            The post is not live: nothing on the public site links to it and it is excluded from search engines, the sitemap and the feed.
            {goesLive ? ` ${goesLive}.` : ""}
          </p>
          {status && (
            <p className="mt-2">
              <StatusBadge status={status} />
            </p>
          )}
        </Alert>
      )}

      {/*
        The cover is rendered ONLY when the post has a real one. The branded `MediaPlaceholder` is
        deliberately not shown full-bleed here: on a card it stands in for a missing thumbnail, but
        320px of generated geometry above the first paragraph is decoration pretending to be
        content. Same decision as `events/[slug]`.
      */}
      {post.coverImage && (
        <div className="rounded-card-lg shadow-e1">
          <Media src={post.coverImage} alt={post.coverImageAlt ?? post.title} seed={post.slug} ratio="16x9" tone="navy" priority sizes="(max-width: 768px) 100vw, 768px" />
        </div>
      )}

      {/* Phones and tablets get the contents as a collapsed disclosure above the body; from `lg`
          up the page renders the sticky `aside` variant in its own column, so this one steps
          aside. Distinct ids — both are in the DOM, only one is visible. */}
      <TableOfContents headings={headings} variant="disclosure" className={cn("lg:hidden", post.coverImage && "mt-6")} />

      <div id="article-body" className={cn("card rounded-card-lg p-6 sm:p-10", (post.coverImage || headings.length > 1) && "mt-6")}>
        {/* The excerpt is the lede: one step larger than body copy, set apart by a rule. */}
        {post.excerpt && <p className="mb-6 border-l-4 border-orange pl-4 text-body-lg font-medium text-ink">{post.excerpt}</p>}

        <Markdown source={post.content} />

        {tags.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-2 border-t border-line pt-6" aria-label="Tags">
            {tags.map((t) => (
              <li key={t}>
                <TagPill name={t} />
              </li>
            ))}
          </ul>
        )}

        {/* Sharing belongs at the end of the body, where a reader has decided the piece is worth
            passing on — not at the top, where it asks before they have read a word. */}
        <ShareRow url={shareUrl} title={post.title} className="mt-8 border-t border-line pt-6" />
      </div>

      {post.author && <AuthorCard author={post.author} className="mt-8" />}

      {related && related.length > 0 && (
        <section aria-labelledby="article-related-title" className="mt-10">
          <h2 id="article-related-title" className="text-h3 text-navy">
            Keep reading
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id}>
                <PostCard post={r} variant="compact" headingLevel={3} sizes="(max-width: 640px) 100vw, 50vw" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <PrevNextPosts prev={prev} next={next} className="mt-8" />

      <div className="mt-8">
        <Link href="/blog" className="ring-focus inline-flex min-h-11 items-center gap-2 rounded-md text-body-sm font-semibold text-orange underline-offset-4 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to all posts
        </Link>
      </div>
    </article>
  );
}
