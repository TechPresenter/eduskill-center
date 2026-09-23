import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PencilLine } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { absoluteUrl, cn } from "@/lib/utils";
import { extractHeadings } from "@/lib/blog";
import { getPostForPreview, listRelatedPosts } from "@/server/blog-public";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";
import { ArticleBody, AuthorByline, TableOfContents, TocActive } from "@/components/site/blog";

/*
 * The staff-only proof of an unpublished post.
 *
 * A draft or a scheduled article is invisible everywhere else on the public site by design, which
 * until now left an editor with no way to see their own work in its real typography before it
 * went out. This page closes that gap WITHOUT opening a hole:
 *
 *  - `requireAdmin("cms.view")` runs before anything is read, and it redirects rather than
 *    returning, so an anonymous visitor never reaches the query at all;
 *  - `getPostForPreview()` is the single export in `@/server/blog-public` that skips
 *    `livePostWhere()`, and this is its only permitted caller;
 *  - the route is `noindex, nofollow`, nothing links to it from a public surface, and `preview`
 *    is a RESERVED blog slug (enforced in `uniqueContentSlug`), so no post can ever shadow it
 *    and make `/blog/preview/<id>` resolve to an article instead.
 *
 * It renders the very same `<ArticleBody>` as `/blog/[slug]`, under the same `(site)` layout, so
 * what a reviewer approves is what a reader gets. Any divergence between the two would be a bug
 * discovered by the public rather than by the editor.
 */

type Props = { params: Promise<{ id: string }> };

/*
 * Never statically rendered and never cached: the whole point is to show the CURRENT draft, and
 * the page is behind a session cookie anyway. As on the live article, no `revalidate` and no
 * `generateStaticParams`.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Post preview",
  // `nofollow` as well as `noindex` here, unlike a no-indexed live post: a crawler that somehow
  // reached this URL must not walk on into the rest of the draft's links either.
  robots: { index: false, follow: false },
};

export default async function BlogPreviewPage({ params }: Props) {
  await requireAdmin("cms.view");
  const { id } = await params;

  const post = await getPostForPreview(id);
  // An unknown id, or one that is not a uuid at all — the service shape-checks it so a slug-like
  // string becomes a 404 here instead of a Postgres cast error.
  if (!post) notFound();

  // Related posts still go through the live gate, so a preview cannot become a side door onto
  // another unpublished article.
  const related = await listRelatedPosts(post, 3);

  const headings = extractHeadings(post.content, { maxLevel: 3 });
  const hasToc = headings.length > 1;
  // The address the post WILL have. It is what `ShareRow` copies, which is correct: the reviewer
  // is proofing the finished article, not a preview link.
  const shareUrl = absoluteUrl(`/blog/${post.slug}`);

  return (
    <>
      <PageHero
        compact
        eyebrow={post.category?.name ?? "Preview"}
        title={post.title}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Blog", href: "/admin/blog" }, { label: post.title }]}
      >
        <AuthorByline
          author={post.author}
          authorName={post.authorName}
          publishedAt={post.publishedAt}
          createdAt={post.createdAt}
          readingMinutes={post.readingMinutes}
          tone="dark"
        />
        <ButtonLink href={`/admin/blog/${post.id}`} variant="white" size="md" className="mt-5" leftIcon={<PencilLine className="h-4 w-4" />}>
          Back to the editor
        </ButtonLink>
      </PageHero>

      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="grid" />
        <div className="container-x relative z-10">
          <div className={cn(hasToc && "lg:grid lg:grid-cols-[minmax(0,48rem)_16rem] lg:justify-center lg:gap-10")}>
            {/*
              `preview` adds the "this is not live" banner and the derived status badge —
              Draft / Scheduled / Archived, computed by `displayStatus()` from the status and the
              publish date, never read from a column (there is no SCHEDULED enum value).

              `related` is passed HERE, unlike on the live article: this route has no full-width
              sections of its own, so the strip renders inside the reading column instead.
            */}
            <ArticleBody
              post={post}
              headings={headings}
              shareUrl={shareUrl}
              related={related}
              preview
              className={hasToc ? undefined : "lg:mx-auto"}
            />

            {hasToc && (
              <aside className="hidden lg:block">
                <TableOfContents headings={headings} variant="aside" />
                <TocActive ids={headings.map((h) => h.id)} navId="blog-toc" />
              </aside>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
