import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";
import { Markdown, markdownExcerpt } from "@/components/site/markdown";
import { absoluteUrl } from "@/lib/utils";
import type { TermsKey } from "@/lib/terms/documents";
import { getTerms, type Terms } from "@/server/terms";
import type { TermsProp } from "@/components/site/terms-reader";

/** What an application form's `TermsReader` needs, rendered here on the server. */
export function termsProp(terms: Terms): TermsProp {
  return {
    title: terms.title,
    version: terms.version,
    updatedLabel: terms.updatedLabel,
    path: terms.path,
    // Inside the scroll box: no permalink per heading (one extra Tab stop each before the consent box).
    body: <Markdown source={terms.content} anchors={false} />,
  };
}

/** Metadata for a public terms page: the CMS page's SEO fields, else its title and excerpt. */
export async function termsPageMetadata(key: TermsKey): Promise<Metadata> {
  const terms = await getTerms(key);
  const title = terms.seoTitle || terms.title;
  const description = terms.seoDescription || terms.excerpt || markdownExcerpt(terms.content) || undefined;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(terms.path) },
    openGraph: { title, description, url: absoluteUrl(terms.path), type: "article" },
  };
}

/**
 * A Terms & Conditions document on its own page — linked from the application it gates (and from
 * that form's "Open in a new tab") — with the blank declaration below, so it can be printed and signed.
 */
export async function TermsPageView({
  termsKey,
  eyebrow,
  breadcrumbs,
  declaration,
  cta,
}: {
  termsKey: TermsKey;
  eyebrow: string;
  breadcrumbs: { label: string; href?: string }[];
  /** The blank, printable declaration (`<… blank headingLevel={2} />`). */
  declaration: React.ReactNode;
  /** The application these terms come before; omitted while applications are closed. */
  cta?: { href: string; label: string; note: string } | null;
}) {
  const terms = await getTerms(termsKey);
  return (
    <>
      <PageHero compact eyebrow={eyebrow} title={terms.title} description={terms.excerpt ?? undefined} breadcrumbs={breadcrumbs} />
      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="grid" className="opacity-60" />
        <div className="container-x relative z-10">
          <article className="mx-auto max-w-3xl card rounded-card-lg p-6 sm:p-10">
            {/* The clauses are `###` in the source: raised to h2 under the page's h1, at the size they have everywhere else. */}
            <div lang="hi">
              <Markdown source={terms.content} topHeadingLevel={2} headingClassName="mt-6! mb-2! text-h4!" />
            </div>
            <div className="mt-8">{declaration}</div>
            <p className="mt-10 border-t border-line pt-4 text-caption text-muted">{terms.updatedLabel ? `Last updated ${terms.updatedLabel}` : "EduSkill India Foundation"}</p>
          </article>

          {cta && (
            <div className="mx-auto mt-8 flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body text-muted">{cta.note}</p>
              <ButtonLink href={cta.href} rightIcon={<ArrowRight className="h-4 w-4" />} className="shrink-0">
                {cta.label}
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
