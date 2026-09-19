import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/cms";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { Markdown, markdownExcerpt } from "@/components/site/markdown";
import { PageHero } from "@/components/site/page-hero";

/** Metadata for a CMS-backed page (legal pages, volunteer, etc.). */
export async function cmsPageMetadata(slug: string, path: string, fallbackTitle: string): Promise<Metadata> {
  const page = await getPage(slug);
  const title = page?.seoTitle || page?.title || fallbackTitle;
  const description = page?.seoDescription || page?.excerpt || markdownExcerpt(page?.content) || undefined;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: { title, description, url: absoluteUrl(path), type: "article" },
  };
}

/** Renders a published CMS page with a navy hero and safe markdown body. */
export async function CmsPageView({ slug, eyebrow, fallbackTitle }: { slug: string; eyebrow?: string; fallbackTitle: string }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <>
      <PageHero compact eyebrow={eyebrow} title={page.title || fallbackTitle} description={page.excerpt ?? undefined} breadcrumbs={[{ label: "Home", href: "/" }, { label: page.title }]} />
      <article className="container-x py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <Markdown source={page.content} />
          <p className="mt-10 border-t border-line pt-4 text-xs text-muted">Last updated {formatDate(page.updatedAt)}</p>
        </div>
      </article>
    </>
  );
}
