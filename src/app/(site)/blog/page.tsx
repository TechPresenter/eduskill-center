import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Newspaper, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/feedback";
import { SitePagination } from "@/components/site/pagination";
import { PageHero } from "@/components/site/page-hero";
import { SafeImage } from "@/components/site/safe-image";
import { markdownExcerpt } from "@/components/site/markdown";
import { Reveal } from "@/components/site/reveal";

const PAGE_SIZE = 9;
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "Blog",
  description: "Stories, updates and insights from EduSkill India Foundation on skill development, education and community impact.",
  alternates: { canonical: absoluteUrl("/blog") },
  openGraph: { title: "Blog", description: "Updates and insights from EduSkill India Foundation.", url: absoluteUrl("/blog"), type: "website" },
};

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
      <section className="bg-lavender py-14 sm:py-20">
        <div className="container-x">
          {tag && (
            <p className="mb-6 text-sm text-muted">
              Showing posts tagged <span className="font-semibold text-navy">#{tag}</span> ·{" "}
              <Link href="/blog" className="font-semibold text-orange">
                clear
              </Link>
            </p>
          )}
          {posts.length === 0 ? (
            <EmptyState icon={<Newspaper className="h-7 w-7" />} title="No posts yet" description="Articles will appear here once published." />
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p, i) => (
                <Reveal as="li" key={p.id} delay={Math.min(i, 5) * 60}>
                  <article className="card card-hover flex h-full flex-col overflow-hidden">
                    <Link href={`/blog/${p.slug}`} className="relative block h-48 bg-navy" aria-hidden tabIndex={-1}>
                      {p.coverImage ? (
                        <SafeImage src={p.coverImage} alt="" sizes="(max-width: 768px) 100vw, 33vw" />
                      ) : (
                        <span className="flex h-full items-center justify-center bg-linear-to-br from-navy to-navy-light">
                          <Newspaper className="h-10 w-10 text-white/60" />
                        </span>
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-orange" aria-hidden /> {formatDate(p.publishedAt ?? p.createdAt)}
                        </span>
                        {p.authorName && (
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-3.5 w-3.5 text-orange" aria-hidden /> {p.authorName}
                          </span>
                        )}
                      </p>
                      <h2 className="mt-2 text-lg font-bold leading-snug text-navy">
                        <Link href={`/blog/${p.slug}`} className="hover:text-orange">
                          {p.title}
                        </Link>
                      </h2>
                      <p className="mt-2 flex-1 text-sm text-muted">{p.excerpt || markdownExcerpt(p.content, 140)}</p>
                      {p.tags.length > 0 && (
                        <ul className="mt-4 flex flex-wrap gap-1.5">
                          {p.tags.slice(0, 3).map((t) => (
                            <li key={t}>
                              <Link href={`/blog?tag=${encodeURIComponent(t)}`} className="rounded-full bg-lavender px-2.5 py-0.5 text-xs font-medium text-navy hover:bg-navy hover:text-white">
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
          <SitePagination page={page} totalPages={totalPages} total={total} limit={PAGE_SIZE} hrefFor={(p) => `/blog?${new URLSearchParams({ ...(tag ? { tag } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`} className="mt-10" />
        </div>
      </section>
    </>
  );
}
