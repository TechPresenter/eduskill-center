import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/cms";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { Markdown, markdownExcerpt } from "@/components/site/markdown";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";

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

/**
 * A published CMS page: navy hero, then the markdown body on a white sheet.
 *
 * The body sits in a `card` rather than loose on the background so a wall of legal text still reads
 * as a document, and the measure is capped at `max-w-3xl` (~70 characters) — long-form copy is the
 * one place on this site where line length matters more than filling the grid.
 */
export async function CmsPageView({ slug, eyebrow, fallbackTitle }: { slug: string; eyebrow?: string; fallbackTitle: string }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <>
      <PageHero compact eyebrow={eyebrow} title={page.title || fallbackTitle} description={page.excerpt ?? undefined} breadcrumbs={[{ label: "Home", href: "/" }, { label: page.title }]} />
      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="grid" className="opacity-60" />
        <div className="container-x relative z-10">
          <article className="mx-auto max-w-3xl card rounded-card-lg p-6 sm:p-10">
            <Markdown source={page.content} />
            <p className="mt-10 border-t border-line pt-4 text-caption text-muted">Last updated {formatDate(page.updatedAt)}</p>
          </article>
        </div>
      </section>
    </>
  );
}
