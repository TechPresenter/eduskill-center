import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, buildQuery } from "@/lib/utils";
import { blogIndexJsonLd, breadcrumbJsonLd } from "@/lib/blog";
import { getPublicCategory, listPublicCategories, listPublicPosts } from "@/server/blog-public";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import { SitePagination } from "@/components/site/pagination";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";
import { CategoryChips, PostCard } from "@/components/site/blog";

/**
 * `/blog/category/[slug]` — one category's archive.
 *
 * A static segment beside `/blog/[slug]`, so Next resolves it first; `category` is also in
 * `RESERVED_BLOG_SLUGS`, so no post can ever be slugged into shadowing this route.
 *
 * NO ISR HERE, deliberately: no `export const revalidate`, no `export const dynamic`, no
 * `generateStaticParams`. Visibility is `status = PUBLISHED AND published_at <= now()`, and that
 * `now()` is stamped when the query runs. Caching a render would freeze the cut-off and a
 * scheduled post would show up late — or a 404 would be cached for an article that has since
 * gone live. Every read below goes through `@/server/blog-public`, which is the only place the
 * gate is spelled out.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Matches the index grid: 3 columns x 3 rows at `lg`. */
const PAGE_SIZE = 9;

/**
 * Memoised for the request, exactly as `/blog/[slug]` memoises its post. Next calls
 * `generateMetadata` and the page body separately and both need the category, so without
 * this every category archive ran its lookup twice on every request.
 */
const loadCategory = cache((slug: string) => getPublicCategory(slug));

/** `?page=` as a positive integer; anything else (absent, "abc", "-2") is page 1. */
function pageParam(sp: Record<string, string | string[] | undefined>): number {
  const raw = typeof sp.page === "string" ? Number(sp.page) : NaN;
  return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 1;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await loadCategory(slug);
  if (!category) return { title: "Category not found" };

  const page = pageParam(sp);
  const title = category.seoTitle || `${category.name} — Blog`;
  const description =
    category.seoDescription || category.description || `Articles from EduSkill India Foundation filed under ${category.name}.`;
  // Page 2+ is its own canonical, not a duplicate of page 1: the posts on it are different, and
  // pointing every page at page 1 would keep the rest of the archive out of the index entirely.
  const url = absoluteUrl(`/blog/category/${category.slug}${buildQuery({ page: page > 1 ? page : undefined })}`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "website" } };
}

export default async function BlogCategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = pageParam(sp);

  // Loaded first and on its own: an unknown or deactivated category is a 404, and there is no
  // point paying for the posts, the chip row and the branding settings to render one.
  const category = await loadCategory(slug);
  if (!category) notFound();

  const [list, allCategories, branding] = await Promise.all([
    listPublicPosts({ page, limit: PAGE_SIZE, categorySlug: category.slug }),
    // `includeEmpty` so the row can still show the category the reader is standing in even when
    // everything filed under it is currently scheduled — a chip row with no current chip reads
    // as a broken filter. Everything else empty is dropped just below.
    listPublicCategories({ includeEmpty: true }),
    getBranding(),
  ]);

  const chips = allCategories.filter((c) => c.postCount > 0 || c.slug === category.slug);

  const jsonLd: Record<string, unknown>[] = [
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }, { name: category.name }]),
  ];
  // The ItemList describes the posts actually served on THIS page, so it only makes sense on the
  // first one — a crawler asking for page 4 does not need the collection re-declared.
  if (page === 1 && list.items.length > 0) {
    jsonLd.push(
      blogIndexJsonLd({
        siteName: branding.siteName,
        description: category.seoDescription || category.description,
        posts: list.items,
      })
    );
  }

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHero
        compact
        eyebrow="Blog"
        title={category.name}
        description={category.description || undefined}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: category.name }]}
      />

      {/* `grid`, not the hero's `mesh`: two neighbouring sections wearing the same decoration read
          as one long band with a colour change in the middle. */}
      <section className="relative overflow-x-clip bg-surface section-y" aria-labelledby="blog-category-title">
        <SectionBg variant="grid" />
        <div className="container-x relative z-10">
          {/* The h1 in the hero already names the category; this is the list's own label, for the
              landmark below and for anyone navigating by heading. */}
          <h2 id="blog-category-title" className="sr-only">
            Posts in {category.name}
          </h2>

          <CategoryChips categories={chips} activeSlug={category.slug} className="mb-8" />

          {list.items.length === 0 ? (
            <EmptyState
              className="mx-auto max-w-2xl"
              icon={<FolderOpen className="h-7 w-7" />}
              title={page > 1 ? "Nothing on this page" : `No posts in ${category.name} yet`}
              description={
                page > 1
                  ? "This archive is shorter than it used to be. Start from the first page to see everything in it."
                  : "Nothing has been published under this category so far. Everything else we have written is on the main blog."
              }
              action={
                <ButtonLink href={page > 1 ? `/blog/category/${category.slug}` : "/blog"} variant="navy">
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
            hrefFor={(p) => `/blog/category/${category.slug}${buildQuery({ page: p > 1 ? p : undefined })}`}
            className="mt-12"
          />
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
