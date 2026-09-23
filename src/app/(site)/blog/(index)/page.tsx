import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, Search, SearchX, X } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { absoluteUrl, buildQuery, slugify } from "@/lib/utils";
import { getBranding } from "@/lib/settings";
import { blogIndexJsonLd, breadcrumbJsonLd } from "@/lib/blog/jsonld";
import { getFeaturedPost, getPublicTag, listPublicCategories, listPublicPosts, listPublicTags, type PublicBlogTag } from "@/server/blog-public";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { JsonLd } from "@/components/site/json-ld";
import { SitePagination } from "@/components/site/pagination";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { CategoryChips, PostCard, TagPill } from "@/components/site/blog";

/**
 * The public blog index.
 *
 * NO ISR, DELIBERATELY. There is no `export const revalidate`, no `export const dynamic` and no
 * `generateStaticParams` here, and none may be added. Scheduling is implemented entirely by the
 * `new Date()` inside `livePostWhere()` (see `src/lib/blog/visibility.ts`), which is evaluated when
 * the query runs — cache the render and a post scheduled for 9am appears whenever the cache happens
 * to expire instead. Every read below goes through `@/server/blog-public`, which is the only module
 * that touches `db.blog` for the public site; this file imports no Prisma client at all.
 */

const PAGE_SIZE = 9;
const DESCRIPTION = "Stories, updates and insights from EduSkill India Foundation on skill development, education and community impact.";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The one place the URL is interpreted, so `generateMetadata` and the page can never disagree. */
function readParams(sp: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const page = Math.max(1, Math.trunc(Number(one(sp.page))) || 1);
  // Capped rather than rejected: a long query is a typo or a crawler, not an error worth a 404.
  const q = (one(sp.q) ?? "").trim().slice(0, 80) || undefined;
  // `?tag=` carries the LABEL exactly as it is stored in `Blog.tags` — that is what every link
  // printed before the tag archives existed, and those links must keep working.
  const tag = (one(sp.tag) ?? "").trim().slice(0, 80) || undefined;
  return { page, q, tag };
}

/**
 * Resolve a legacy `?tag=` label onto its `BlogTag` row so the page can point at the canonical
 * archive. The label is not the slug, and the service only looks tags up by slug, so we slugify
 * and then verify the round trip: a slug collision (`ai-2`) would otherwise canonicalise this page
 * onto a completely different tag.
 */
async function resolveTag(label: string): Promise<PublicBlogTag | null> {
  const slug = slugify(label);
  if (!slug) return null;
  const tag = await getPublicTag(slug);
  return tag && tag.name.toLowerCase() === label.toLowerCase() ? tag : null;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page, q, tag } = readParams(await searchParams);
  const canonicalTag = tag ? await resolveTag(tag) : null;

  // A self-referencing canonical per page: page 2 used to declare itself page 1, which asks Google
  // to drop every post that is not in the first nine. A `?tag=` view points at the real archive
  // instead, because that route is the indexable home of a tag.
  const canonicalPath = canonicalTag ? `/blog/tag/${canonicalTag.slug}` : page > 1 ? `/blog?page=${page}` : "/blog";
  const title = page > 1 ? `Blog — page ${page}` : "Blog";

  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: absoluteUrl(canonicalPath) },
    // A search result page is a thin, query-shaped slice of pages that are already indexed. Follow
    // the links out of it, but do not let it into the index.
    ...(q ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description: "Updates and insights from EduSkill India Foundation.", url: absoluteUrl(canonicalPath), type: "website" },
  };
}

export default async function BlogIndexPage({ searchParams }: Props) {
  const { page, q, tag } = readParams(await searchParams);
  const filtered = Boolean(q || tag);

  // The featured post is loaded BEFORE the grid, not alongside it, because its id is what keeps it
  // out of the grid: with both in one `Promise.all` the lead story would also be the first card
  // under it, and the pagination total would count it twice. One extra round trip, on page 1 only.
  const featured = page === 1 && !filtered ? await getFeaturedPost() : null;

  const [{ items, total, totalPages }, categories, topTags, activeTag, branding] = await Promise.all([
    listPublicPosts({ page, limit: PAGE_SIZE, q, tagName: tag, excludeIds: featured ? [featured.id] : undefined }),
    listPublicCategories(),
    listPublicTags(12),
    tag ? resolveTag(tag) : Promise.resolve(null),
    getBranding(),
  ]);

  const hrefFor = (p: number) => `/blog${buildQuery({ q, tag, page: p > 1 ? p : undefined })}`;
  const heading = q ? `Search results for ${q}` : tag ? `Posts tagged ${tag}` : "Latest posts";

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog" }])} />
      {/* The collection itself is described once, on the unfiltered first page. Page 2 and the
          filtered views are the same collection sliced differently, not new collections. */}
      {page === 1 && !filtered && <JsonLd data={blogIndexJsonLd({ siteName: branding.siteName, description: DESCRIPTION, posts: featured ? [featured, ...items] : items })} />}

      <PageHero compact eyebrow="Blog" title="News, Stories & [[Insights]]" description="Updates from our centers, trainers and students across India." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]} />

      <section className="relative overflow-x-clip bg-surface section-y" aria-labelledby="blog-list-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10">
          <h2 id="blog-list-title" className="sr-only">
            {heading}
          </h2>

          {/* A plain GET form: shareable URLs, no hydration, and it works before (or without) any
              JavaScript. `withBasePath` because a native <form action> never gets the deployment
              sub-path that <Link> applies for us. */}
          <form role="search" action={withBasePath("/blog")} method="get" className="flex w-full max-w-xl items-center gap-2">
            <Field label={<span className="sr-only">Search posts</span>} className="min-w-0 flex-1 space-y-0">
              <Input
                id="blog-q"
                name="q"
                type="search"
                defaultValue={q ?? ""}
                maxLength={80}
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Search posts by title, summary or tag"
                leftIcon={<Search className="h-4 w-4" aria-hidden />}
              />
            </Field>
            {/* Searching inside a tag keeps the tag: without this the filter would silently vanish
                the first time a reader typed anything. */}
            {tag && <input type="hidden" name="tag" value={tag} />}
            <Button type="submit" variant="navy" className="shrink-0">
              Search
            </Button>
          </form>

          {filtered && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-body text-muted">
                {q && (
                  <>
                    Showing posts matching <span className="font-semibold text-navy">{q}</span>
                  </>
                )}
                {q && tag && " "}
                {tag && (
                  <>
                    {q ? "within" : "Showing posts"} tagged{" "}
                    {/* The tag archive is where a tag actually lives; this row is the bridge from
                        the legacy query-param view to it. */}
                    {activeTag ? (
                      <Link href={`/blog/tag/${activeTag.slug}`} className="ring-focus font-semibold text-navy underline underline-offset-4 hover:text-orange">
                        #{tag}
                      </Link>
                    ) : (
                      <span className="font-semibold text-navy">#{tag}</span>
                    )}
                  </>
                )}
              </p>
              <Link
                href={q && tag ? `/blog${buildQuery({ tag })}` : "/blog"}
                className="ring-focus inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-body-sm font-semibold text-navy transition-colors duration-micro hover:bg-lavender motion-reduce:transition-none"
              >
                <X className="h-4 w-4" aria-hidden /> {q ? "Clear search" : "Clear filter"}
              </Link>
            </div>
          )}

          <CategoryChips categories={categories} className="mt-6" />

          {featured && (
            <Reveal className="mt-8">
              <PostCard post={featured} variant="featured" headingLevel={3} priority sizes="(max-width: 1024px) 100vw, 50vw" />
            </Reveal>
          )}

          {/* The featured card is a post: with exactly one live post on the site it fills the hero
              slot and leaves the grid empty, and "the first posts are on their way" underneath it
              would plainly contradict the article sitting above. */}
          {items.length === 0 && !featured ? (
            <EmptyState
              className="mx-auto mt-8 max-w-2xl"
              icon={q ? <SearchX className="h-7 w-7" /> : <Newspaper className="h-7 w-7" />}
              title={q ? "No posts match that search" : tag ? "No posts with this tag" : "The first posts are on their way"}
              description={
                q
                  ? "Try a shorter phrase, a single word, or browse the categories above."
                  : tag
                    ? "Nothing has been published under this tag yet. Clear the filter to read everything we have."
                    : "Updates from our centres, notes from trainers and news about new courses will all be published here."
              }
              action={
                filtered ? (
                  <ButtonLink href="/blog" variant="navy">
                    {q ? "Clear search" : "Read all posts"}
                  </ButtonLink>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <ButtonLink href="/events" variant="navy">
                      See upcoming events
                    </ButtonLink>
                    <ButtonLink href="/about" variant="outline">
                      About the Foundation
                    </ButtonLink>
                  </div>
                )
              }
            />
          ) : items.length === 0 ? null : (
            <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {items.map((p, i) => (
                <Reveal as="li" key={p.id} delay={Math.min(i, 5) * 60}>
                  <PostCard post={p} headingLevel={3} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                </Reveal>
              ))}
            </ul>
          )}

          {topTags.length > 0 && (
            <nav className="mt-12 border-t border-line pt-8" aria-labelledby="blog-tag-cloud-title">
              <h2 id="blog-tag-cloud-title" className="text-h4 text-navy">
                Browse by tag
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {topTags.map((t) => (
                  <li key={t.id}>
                    <TagPill name={t.name} slug={t.slug} active={activeTag?.id === t.id} />
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <SitePagination page={page} totalPages={totalPages} total={total} limit={PAGE_SIZE} hrefFor={hrefFor} className="mt-12" />
        </div>
      </section>

      <CtaBand title="Be part of the [[change]]" description="Learn a skill, teach one, or fund a student's training." primary={{ label: "Apply Now", href: "/register" }} secondary={{ label: "Donate", href: "/donate" }} />
    </>
  );
}
