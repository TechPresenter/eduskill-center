import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Newspaper, UserRound, X } from "lucide-react";
import { db } from "@/lib/db";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SitePagination } from "@/components/site/pagination";
import { PageHero } from "@/components/site/page-hero";
import { Media } from "@/components/site/safe-image";
import { markdownExcerpt } from "@/components/site/markdown";
import { SectionBg } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";

const PAGE_SIZE = 9;
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "Blog",
  description: "Stories, updates and insights from EduSkill India Foundation on skill development, education and community impact.",
  alternates: { canonical: absoluteUrl("/blog") },
  openGraph: { title: "Blog", description: "Updates and insights from EduSkill India Foundation.", url: absoluteUrl("/blog"), type: "website" },
};

/** A tag pill. Sits above the card's stretched link on its own raised layer so it stays clickable. */
const TAG = "ring-focus inline-flex min-h-11 items-center rounded-full bg-lavender px-4 text-body-sm font-semibold text-navy transition-colors duration-micro hover:bg-navy hover:text-white motion-reduce:transition-none";

export default async function BlogIndexPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const tag = typeof sp.tag === "string" ? sp.tag : undefined;
  const where = { status: "PUBLISHED" as const, ...(tag ? { tags: { has: tag } } : {}) };
  const [posts, total] = await Promise.all([
    db.blog.findMany({ where, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.blog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHero compact eyebrow="Blog" title="News, Stories & [[Insights]]" description="Updates from our centers, trainers and students across India." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]} />

      <section className="relative overflow-x-clip bg-surface section-y" aria-labelledby="blog-list-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10">
          <h2 id="blog-list-title" className="sr-only">
            {tag ? `Posts tagged ${tag}` : "Latest posts"}
          </h2>

          {tag && (
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <p className="text-body text-muted">
                Showing posts tagged <span className="font-semibold text-navy">#{tag}</span>
              </p>
              <Link href="/blog" className="ring-focus inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-body-sm font-semibold text-navy transition-colors duration-micro hover:bg-lavender motion-reduce:transition-none">
                <X className="h-4 w-4" aria-hidden /> Clear filter
              </Link>
            </div>
          )}

          {posts.length === 0 ? (
            <EmptyState
              className="mx-auto max-w-2xl"
              icon={<Newspaper className="h-7 w-7" />}
              title={tag ? "No posts with this tag" : "The first posts are on their way"}
              description={
                tag
                  ? "Nothing has been published under this tag yet. Clear the filter to read everything we have."
                  : "Updates from our centres, notes from trainers and news about new courses will all be published here."
              }
              action={
                tag ? (
                  <ButtonLink href="/blog" variant="navy">
                    Read all posts
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
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {posts.map((p, i) => (
                <Reveal as="li" key={p.id} delay={Math.min(i, 5) * 60}>
                  <article className="group card card-hover relative flex h-full flex-col overflow-hidden">
                    <div className="rounded-t-card">
                      <Media src={p.coverImage} alt={p.coverImage ? p.title : ""} seed={p.slug} ratio="16x9" tone="navy" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                    </div>
                    <div className="flex flex-1 flex-col card-p">
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-orange" aria-hidden /> {formatDate(p.publishedAt ?? p.createdAt)}
                        </span>
                        {p.authorName && (
                          <span className="inline-flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5 text-orange" aria-hidden /> {p.authorName}
                          </span>
                        )}
                      </p>
                      <h3 className="mt-2 text-h3 text-navy">
                        {/* Stretched link: one tab stop, one announcement, the whole card is the target. */}
                        <Link href={`/blog/${p.slug}`} className="transition-colors duration-micro after:absolute after:inset-0 hover:text-orange focus-visible:text-orange motion-reduce:transition-none">
                          {p.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 flex-1 text-body text-muted">{p.excerpt || markdownExcerpt(p.content, 140)}</p>
                      {p.tags.length > 0 && (
                        <ul className="relative z-raised mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
                          {p.tags.slice(0, 3).map((t) => (
                            <li key={t}>
                              <Link href={`/blog?tag=${encodeURIComponent(t)}`} className={TAG}>
                                #{t}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                </Reveal>
              ))}
            </ul>
          )}

          <SitePagination page={page} totalPages={totalPages} total={total} limit={PAGE_SIZE} hrefFor={(p) => `/blog?${new URLSearchParams({ ...(tag ? { tag } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`} className="mt-12" />
        </div>
      </section>

      <CtaBand title="Be part of the [[change]]" description="Learn a skill, teach one, or fund a student's training." primary={{ label: "Apply Now", href: "/register" }} secondary={{ label: "Donate", href: "/donate" }} />
    </>
  );
}
