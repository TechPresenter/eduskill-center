import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tag } from "lucide-react";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, buildQuery } from "@/lib/utils";
import { blogIndexJsonLd, breadcrumbJsonLd } from "@/lib/blog";
import { getPublicTag, listPublicPosts, listPublicTags } from "@/server/blog-public";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { SitePagination } from "@/components/site/pagination";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";
import { PostCard, TagPill } from "@/components/site/blog";

/**
 * `/blog/tag/[slug]` — one tag's archive.
 *
 * `Blog.tags` is still a plain `String[]`; `BlogTag` is a lookup table whose `name` holds the
 * EXACT label stored in that array. So the slug in the URL is resolved to a tag row first and the
 * row's `name` is what filters the posts — which is what lets a tag carry a slug, a description
 * and its own SEO copy without changing the shape of the array or breaking the older
 * `/blog?tag=<label>` links.
 *
 * NO ISR HERE, deliberately: no `export const revalidate`, no `export const dynamic`, no
 * `generateStaticParams`. A post is live only once `published_at <= now()`, and that `now()` is
 * stamped when the query runs — a cached render would freeze the cut-off and a scheduled post
 * would appear early or late. Every read goes through `@/server/blog-public`, the only module
 * allowed to query posts for a visitor.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Matches the index grid: 3 columns x 3 rows at `lg`. */
const PAGE_SIZE = 9;

/** How many tags the cloud under the grid offers — enough to browse sideways, not a wall of pills. */
const CLOUD_SIZE = 24;

/** `?page=` as a positive integer; anything else (absent, "abc", "-2") is page 1. */
function pageParam(sp: Record<string, string | string[] | undefined>): number {
  const raw = typeof sp.page === "string" ? Number(sp.page) : NaN;
  return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 1;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tag = await getPublicTag(slug);
  if (!tag) return { title: "Tag not found" };

  const page = pageParam(sp);
  const title = tag.seoTitle || `#${tag.name} — Blog`;
  const description = tag.seoDescription || tag.description || `Every EduSkill India Foundation article tagged ${tag.name}.`;
  // Page 2+ is its own canonical, not a duplicate of page 1: the posts on it are different, and
  // collapsing the archive onto its first page would keep the rest of it out of the index.
  const url = absoluteUrl(`/blog/tag/${tag.slug}${buildQuery({ page: page > 1 ? page : undefined })}`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "website" } };
}

export default async function BlogTagPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = pageParam(sp);

  // An unknown tag is a 404 before anything else is paid for. Note that `getPublicTag` does NOT
  // filter on `postCount`: that column is a maintained cache, so a tag whose count is briefly
  // stale still renders its archive, and the grid below is what decides whether it has anything
  // in it.
  const tag = await getPublicTag(slug);
  if (!tag) notFound();

  const [list, topTags, branding] = await Promise.all([
    // The LABEL, not the slug — `Blog.tags` stores the label verbatim.
    listPublicPosts({ page, limit: PAGE_SIZE, tagName: tag.name }),
    listPublicTags(CLOUD_SIZE),
    getBranding(),
  ]);

  // `listPublicTags` drops anything at zero, so a tag whose posts are all still scheduled would be
  // missing from its own cloud. Put it back at the front rather than leaving the reader with no
  // indication of where they are standing.
  const cloud = topTags.some((t) => t.id === tag.id) ? topTags : [tag, ...topTags];

  const jsonLd: Record<string, unknown>[] = [
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }, { name: `#${tag.name}` }]),
  ];
  // The ItemList describes the posts actually served on THIS page, so only page 1 declares the
  // collection — a crawler asking for page 4 does not need it restated.
  if (page === 1 && list.items.length > 0) {
    jsonLd.push(blogIndexJsonLd({ siteName: branding.siteName, description: tag.seoDescription || tag.description, posts: list.items }));
  }

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHero
        compact
        eyebrow="Blog"
        title={`#${tag.name}`}
        description={tag.description || `Everything we have written about ${tag.name}.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: `#${tag.name}` }]}
      />

      {/* `grid`, not the hero's `mesh`: two neighbouring bands wearing the same decoration read as
          one long section with a colour change in the middle. */}
      <section className="relative overflow-x-clip bg-surface section-y" aria-labelledby="blog-tag-title">
        <SectionBg variant="grid" />
        <div className="container-x relative z-10">
          {/* The hero's h1 already names the tag; this labels the list itself, for the landmark
              below and for anyone navigating by heading. */}
          <h2 id="blog-tag-title" className="sr-only">
            Posts tagged {tag.name}
          </h2>

          {list.items.length === 0 ? (
            <EmptyState
              className="mx-auto max-w-2xl"
              icon={<Tag className="h-7 w-7" />}
              title={page > 1 ? "Nothing on this page" : `No posts tagged #${tag.name} yet`}
              description={
                page > 1
                  ? "This archive is shorter than it used to be. Start from the first page to see everything in it."
                  : "Nothing has been published under this tag so far. Everything else we have written is on the main blog."
              }
              action={
                <ButtonLink href={page > 1 ? `/blog/tag/${tag.slug}` : "/blog"} variant="navy">
                  {page > 1 ? "Back to the first page" : "Read all posts"}
                </ButtonLink>
              }
            />
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {list.items.map((post, i) => (
                <Reveal as="li" key={post.id} delay={Math.min(i, 5) * 60}>
                  <PostCard post={post} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                </Reveal>
              ))}
            </ul>
          )}

          <SitePagination
            page={list.page}
            totalPages={list.totalPages}
            total={list.total}
            limit={list.limit}
            hrefFor={(p) => `/blog/tag/${tag.slug}${buildQuery({ page: p > 1 ? p : undefined })}`}
            className="mt-12"
          />
        </div>
      </section>

      {/* The sideways exit from a tag archive. Its own band, on white and with a third decoration,
          so it reads as somewhere else to go rather than as more of the grid above. The pills wrap
          instead of scrolling: a cloud is a block of text, not a one-line filter row. */}
      <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="blog-tag-cloud-title">
        <SectionBg variant="dots" />
        <div className="container-x relative z-10">
          <SectionHeading
            id="blog-tag-cloud-title"
            label="Browse"
            title="More [[topics]]"
            description="Every subject our centres, trainers and students write about."
          />
          <ul className="mt-8 flex flex-wrap gap-2">
            {cloud.map((t) => (
              <li key={t.id}>
                <TagPill name={t.name} slug={t.slug} active={t.id === tag.id} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Be part of the [[change]]"
        description="Learn a skill, teach one, or fund a student's training."
        primary={{ label: "Apply Now", href: "/register" }}
        secondary={{ label: "Donate", href: "/donate" }}
      />
    </>
  );
}
