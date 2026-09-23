import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, buildQuery, truncate } from "@/lib/utils";
import { breadcrumbJsonLd } from "@/lib/blog";
import { getPublicAuthor, listPublicPosts } from "@/server/blog-public";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import { SitePagination } from "@/components/site/pagination";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";
import { AuthorCard, PostCard } from "@/components/site/blog";

/**
 * `/blog/author/[slug]` — everything one author has published.
 *
 * `BlogAuthor` is deliberately not the staff `User` table: a `User` row has no avatar, bio or
 * socials, so a byline built on it would have nothing to show. A deactivated author 404s rather
 * than rendering an empty profile, which is how an author is retired from the public site
 * without deleting the posts they wrote.
 *
 * NO ISR HERE, deliberately: no `export const revalidate`, no `export const dynamic`, no
 * `generateStaticParams`. A post is live only once `published_at <= now()`, and that `now()` is
 * stamped when the query runs — caching a render would freeze the cut-off and leak (or hide) a
 * scheduled post. Every read goes through `@/server/blog-public`.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Matches the index grid: 3 columns x 3 rows at `lg`. */
const PAGE_SIZE = 9;

/** `?page=` as a positive integer; anything else (absent, "abc", "-2") is page 1. */
function pageParam(sp: Record<string, string | string[] | undefined>): number {
  const raw = typeof sp.page === "string" ? Number(sp.page) : NaN;
  return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 1;
}

/** The author's own profiles elsewhere, for `sameAs`. Empty fields are simply absent. */
function sameAsUrls(author: { linkedinUrl: string | null; twitterUrl: string | null; websiteUrl: string | null }): string[] {
  return [author.linkedinUrl, author.twitterUrl, author.websiteUrl].filter((url): url is string => Boolean(url));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const author = await getPublicAuthor(slug);
  if (!author) return { title: "Author not found" };

  const page = pageParam(sp);
  const title = `${author.name} — Blog`;
  // A profile page's description is the person, not the archive: their own bio first, then the
  // role, then a plain sentence, so a search result never reads as an empty listing page.
  const description =
    truncate(author.bio ?? "", 160) ||
    (author.role ? `${author.name}, ${author.role} at EduSkill India Foundation.` : `Articles written by ${author.name} for EduSkill India Foundation.`);
  // Page 2+ is its own canonical: the posts on it are different, and collapsing the archive onto
  // its first page would keep the rest of it out of the index.
  const url = absoluteUrl(`/blog/author/${author.slug}${buildQuery({ page: page > 1 ? page : undefined })}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "profile",
      images: author.avatar ? [{ url: absoluteUrl(author.avatar), alt: author.name }] : undefined,
    },
  };
}

export default async function BlogAuthorPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = pageParam(sp);

  // An unknown or deactivated author is a 404; there is no point loading their posts to find out.
  const author = await getPublicAuthor(slug);
  if (!author) notFound();

  const [list, branding] = await Promise.all([listPublicPosts({ page, limit: PAGE_SIZE, authorSlug: author.slug }), getBranding()]);

  const sameAs = sameAsUrls(author);
  const jsonLd: Record<string, unknown>[] = [
    // `undefined` members disappear during `JSON.stringify`, which is how the optional fields are
    // omitted — an explicit null where schema.org expects a URL is read as a broken field.
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: author.name,
      url: absoluteUrl(`/blog/author/${author.slug}`),
      image: author.avatar ? absoluteUrl(author.avatar) : undefined,
      jobTitle: author.role || undefined,
      description: author.bio || undefined,
      // The organisation name is DB-driven branding, like every other publisher node on the site.
      worksFor: { "@type": "Organization", name: branding.siteName },
      sameAs: sameAs.length > 0 ? sameAs : undefined,
    },
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }, { name: author.name }]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHero
        compact
        eyebrow="Author"
        title={author.name}
        // A real count from the live-gated query, never a number written into the markup. The role
        // and the bio are not repeated here — the card below carries both.
        description={list.total === 1 ? "1 article on the EduSkill blog." : `${list.total} articles on the EduSkill blog.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: author.name }]}
      >
        {/* `dark` drops the card chrome so the profile sits directly on the navy band; `showMore`
            is off because its button links to this very page. */}
        <AuthorCard author={author} tone="dark" showMore={false} className="max-w-3xl" />
      </PageHero>

      {/* `grid`, not the hero's `mesh`: two neighbouring bands wearing the same decoration read as
          one long section with a colour change in the middle. */}
      <section className="relative overflow-x-clip bg-surface section-y" aria-labelledby="blog-author-title">
        <SectionBg variant="grid" />
        <div className="container-x relative z-10">
          {/* The hero's h1 is the author's name; this labels the list itself, for the landmark
              below and for anyone navigating by heading. */}
          <h2 id="blog-author-title" className="sr-only">
            Articles by {author.name}
          </h2>

          {list.items.length === 0 ? (
            <EmptyState
              className="mx-auto max-w-2xl"
              icon={<UserRound className="h-7 w-7" />}
              title={page > 1 ? "Nothing on this page" : `Nothing from ${author.name} yet`}
              description={
                page > 1
                  ? "This archive is shorter than it used to be. Start from the first page to see everything in it."
                  : "Their first article has not been published yet. Everything else we have written is on the main blog."
              }
              action={
                <ButtonLink href={page > 1 ? `/blog/author/${author.slug}` : "/blog"} variant="navy">
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
            hrefFor={(p) => `/blog/author/${author.slug}${buildQuery({ page: p > 1 ? p : undefined })}`}
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
