import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBranding, getSetting } from "@/lib/settings";
import { absoluteUrl, cn } from "@/lib/utils";
import { blogPostingJsonLd, breadcrumbJsonLd, extractHeadings } from "@/lib/blog";
import { getAdjacentPosts, getPublicPost, listRelatedPosts } from "@/server/blog-public";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";
import { SectionHeading } from "@/components/site/section-heading";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";
import { markdownExcerpt } from "@/components/site/markdown";
import { ArticleBody, AuthorByline, PostCard, ReadingProgress, TableOfContents, TocActive } from "@/components/site/blog";

/*
 * The public article.
 *
 * THIS ROUTE MUST STAY REQUEST-TIME DYNAMIC. Scheduling has no cron and no status flip: a post
 * becomes visible the moment `publishedAt` passes, because `getPublicPost()` evaluates
 * `new Date()` inside `livePostWhere()` on every query. Adding `export const revalidate`,
 * `export const dynamic = "force-static"` or `generateStaticParams` here would freeze that
 * cut-off into a cached render — a scheduled post would appear late, or worse, its 404 would be
 * cached and served after it went live. There is no ISR anywhere in this app; keep it that way.
 *
 * Nothing in this file touches `db` directly. Every read goes through `@/server/blog-public`,
 * which is the only module allowed to query posts for a visitor, so the live/scheduled gate can
 * never be forgotten in one branch of one page.
 */

type Props = { params: Promise<{ slug: string }> };

/**
 * `generateMetadata` and the page body both need the post, and Next runs them as two separate
 * calls. `cache()` de-duplicates them WITHIN a single request (the same trick
 * `training-centers/page.tsx` uses for its search), so the article costs one query instead of
 * two. It is per-request memoisation, not a cache across requests, so the `new Date()` inside
 * `livePostWhere()` is still fresh on every hit.
 */
const loadPost = cache((slug: string) => getPublicPost(slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post, defaultOgImage] = await Promise.all([loadPost(slug), getSetting<string>("seo.ogImage")]);
  if (!post) return { title: "Post not found" };

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || markdownExcerpt(post.content, 160);
  // A syndicated piece points its canonical at the original; everything else owns its own URL.
  const canonical = post.canonicalUrl || absoluteUrl(`/blog/${post.slug}`);
  const published = (post.publishedAt ?? post.createdAt).toISOString();
  const byline = post.author?.name ?? post.authorName ?? null;

  /*
   * Share image, best crop first: an authored 1200×630 OG card, else the 16:9 cover (wrong
   * aspect, but on-brand and specific to the post), else the site-wide default. EVERY one of
   * those is a STORED path — `absoluteUrl()` is what makes it a real URL under a `/center`
   * sub-path deployment. The previous version of this page handed `post.coverImage` to
   * `openGraph.images` raw, which produced a relative path every scraper resolved wrongly.
   */
  const ogSource = post.ogImage || post.coverImage || String(defaultOgImage ?? "");
  const ogUrl = ogSource ? absoluteUrl(ogSource) : undefined;
  const images = ogUrl ? [{ url: ogUrl, width: 1200, height: 630, alt: post.coverImageAlt ?? post.title }] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    // `follow` stays true on a no-indexed post: the page is kept out of the index, but the links
    // out of it (to the category, the author, the rest of the site) still carry their weight.
    robots: post.noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      publishedTime: published,
      modifiedTime: post.updatedAt.toISOString(),
      authors: byline ? [byline] : undefined,
      section: post.category?.name,
      tags: post.tags.length > 0 ? post.tags : undefined,
      images,
    },
    // Without an image Twitter renders a `summary_large_image` card as a broken box, so the card
    // type follows whether we actually have one.
    twitter: { card: ogUrl ? "summary_large_image" : "summary", title, description, images: ogUrl ? [ogUrl] : undefined },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, branding] = await Promise.all([loadPost(slug), getBranding()]);
  // A draft, an archived post, an unknown slug and a scheduled post whose time has not come are
  // all the same thing to a visitor: this article does not exist.
  if (!post) notFound();

  const [related, adjacent] = await Promise.all([
    listRelatedPosts(post, 3),
    // A live post always carries `publishedAt` (the gate requires it); `createdAt` only satisfies
    // the type so this cannot become a non-null assertion that lies later.
    getAdjacentPosts({ id: post.id, publishedAt: post.publishedAt ?? post.createdAt }),
  ]);

  /*
   * The table of contents is built on the SERVER from the same `parseMarkdown` walk that
   * `<Markdown>` uses to emit its heading ids, so the anchors cannot drift. h4s are excluded
   * from the list (`maxLevel: 3`) but still consume their slot in the shared `seen` map inside
   * `extractHeadings`, which is why the ids match byte for byte. Zero client JavaScript.
   */
  const headings = extractHeadings(post.content, { maxLevel: 3 });
  const hasToc = headings.length > 1;
  const shareUrl = absoluteUrl(`/blog/${post.slug}`);

  return (
    <>
      <JsonLd data={blogPostingJsonLd({ post, author: post.author, category: post.category, siteName: branding.siteName, logoUrl: branding.logoUrl })} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          ...(post.category ? [{ name: post.category.name, path: `/blog/category/${post.category.slug}` }] : []),
          { name: post.title },
        ])}
      />

      {/* Measured against the body card, not the document, so the hero and the related rail do not
          count towards "how much of the article is left". */}
      <ReadingProgress targetId="article-body" />

      <PageHero
        compact
        eyebrow={post.category?.name ?? "Blog"}
        title={post.title}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
          ...(post.category ? [{ label: post.category.name, href: `/blog/category/${post.category.slug}` }] : []),
          { label: post.title },
        ]}
      >
        {/* `AuthorByline` already renders the date + reading-time meta row underneath the name, and
            degrades to that row alone when a post has no byline at all — a second `<PostMeta>`
            here would print the same date twice. */}
        <AuthorByline
          author={post.author}
          authorName={post.authorName}
          publishedAt={post.publishedAt}
          createdAt={post.createdAt}
          readingMinutes={post.readingMinutes}
          tone="dark"
        />
      </PageHero>

      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="grid" />
        <div className="container-x relative z-10">
          {/*
            From `lg` up: a fixed 16rem contents rail beside a reading column capped at 48rem, the
            pair centred in the container. Below `lg` there is no second column at all — the
            contents render as a collapsed disclosure inside `ArticleBody` — so the grid classes
            only ever apply at `lg`, and a post with fewer than two headings keeps the plain
            centred column rather than reserving an empty 16rem gutter beside it.
          */}
          <div className={cn(hasToc && "lg:grid lg:grid-cols-[minmax(0,48rem)_16rem] lg:justify-center lg:gap-10")}>
            <ArticleBody post={post} headings={headings} shareUrl={shareUrl} prev={adjacent.prev} next={adjacent.next} className={hasToc ? undefined : "lg:mx-auto"} />

            {hasToc && (
              <aside className="hidden lg:block">
                <TableOfContents headings={headings} variant="aside" />
                {/* Progressive enhancement only: the rail above is already a working list of
                    anchors, and this island just paints the "you are here" row. */}
                <TocActive ids={headings.map((h) => h.id)} navId="blog-toc" />
              </aside>
            )}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="blog-related-title">
          <SectionBg variant="dots" />
          <div className="container-x relative z-10">
            <SectionHeading id="blog-related-title" label="Keep reading" title="More from the [[Blog]]" />
            <ul className="mt-10 grid gap-5 md:grid-cols-3 lg:gap-6">
              {related.map((r) => (
                <li key={r.id}>
                  <PostCard post={r} variant="compact" headingLevel={3} sizes="(max-width: 768px) 100vw, 33vw" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand title="Be part of the [[change]]" description="Learn a skill, teach one, or fund a student's training." primary={{ label: "Apply Now", href: "/register" }} secondary={{ label: "Donate", href: "/donate" }} />
    </>
  );
}
