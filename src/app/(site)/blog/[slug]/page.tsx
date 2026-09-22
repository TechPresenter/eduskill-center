import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, cn, formatDate } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { Media } from "@/components/site/safe-image";
import { SectionBg } from "@/components/site/decor";
import { SectionHeading } from "@/components/site/section-heading";
import { Markdown, markdownExcerpt } from "@/components/site/markdown";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";

type Props = { params: Promise<{ slug: string }> };

const TAG = "ring-focus inline-flex min-h-11 items-center rounded-full bg-lavender px-4 text-body-sm font-semibold text-navy transition-colors duration-micro hover:bg-navy hover:text-white motion-reduce:transition-none";

async function loadPost(slug: string) {
  return db.blog.findFirst({ where: { slug, status: "PUBLISHED" } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: "Post not found" };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || markdownExcerpt(post.content);
  const url = absoluteUrl(`/blog/${post.slug}`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "article", publishedTime: (post.publishedAt ?? post.createdAt).toISOString(), authors: post.authorName ? [post.authorName] : undefined, images: post.coverImage ? [{ url: post.coverImage }] : undefined } };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, branding] = await Promise.all([loadPost(slug), getBranding()]);
  if (!post) notFound();
  const related = await db.blog.findMany({ where: { status: "PUBLISHED", id: { not: post.id } }, orderBy: [{ publishedAt: "desc" }], take: 3, select: { id: true, slug: true, title: true, coverImage: true, excerpt: true, publishedAt: true, createdAt: true } });
  const published = post.publishedAt ?? post.createdAt;

  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.excerpt ?? markdownExcerpt(post.content), datePublished: published.toISOString(), dateModified: post.updatedAt.toISOString(), author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@type": "Organization", name: branding.siteName }, publisher: { "@type": "Organization", name: branding.siteName }, image: post.coverImage ?? undefined, mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`), keywords: post.tags.join(", ") || undefined }} />

      <PageHero compact eyebrow="Blog" title={post.title} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.title }]}>
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-body text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0 text-orange" aria-hidden /> <time dateTime={published.toISOString()}>{formatDate(published)}</time>
          </span>
          {post.authorName && (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4 shrink-0 text-orange" aria-hidden /> {post.authorName}
            </span>
          )}
        </p>
      </PageHero>

      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="grid" />
        <div className="container-x relative z-10">
          <article className="mx-auto max-w-3xl">
            {/* Only when the post actually has a cover. See the note in events/[slug]. */}
            {post.coverImage && (
              <div className="rounded-card-lg shadow-e1">
                <Media src={post.coverImage} alt={post.title} seed={post.slug} ratio="16x9" tone="navy" priority sizes="(max-width: 768px) 100vw, 768px" />
              </div>
            )}

            <div className={cn("card rounded-card-lg p-6 sm:p-10", post.coverImage && "mt-8")}>
              {/* The excerpt is the lede: one step larger than body copy, set apart by a rule. */}
              {post.excerpt && <p className="mb-6 border-l-4 border-orange pl-4 text-body-lg font-medium text-ink">{post.excerpt}</p>}
              <Markdown source={post.content} />
              {post.tags.length > 0 && (
                <ul className="mt-8 flex flex-wrap gap-2 border-t border-line pt-6" aria-label="Tags">
                  {post.tags.map((t) => (
                    <li key={t}>
                      <Link href={`/blog?tag=${encodeURIComponent(t)}`} className={TAG}>
                        #{t}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-8">
              <Link href="/blog" className="ring-focus inline-flex min-h-11 items-center gap-2 rounded-md text-body-sm font-semibold text-orange underline-offset-4 hover:underline">
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back to all posts
              </Link>
            </div>
          </article>
        </div>
      </section>

      {related.length > 0 && (
        <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="blog-related-title">
          <SectionBg variant="dots" />
          <div className="container-x relative z-10">
            <SectionHeading id="blog-related-title" label="Keep reading" title="More from the [[Blog]]" />
            <ul className="mt-10 grid gap-5 md:grid-cols-3 lg:gap-6">
              {related.map((r) => (
                <li key={r.id}>
                  <article className="group card card-hover relative flex h-full flex-col overflow-hidden">
                    <div className="rounded-t-card">
                      <Media src={r.coverImage} alt="" seed={r.slug} ratio="16x9" tone="navy" sizes="(max-width: 768px) 100vw, 33vw" />
                    </div>
                    <div className="flex flex-1 flex-col card-p">
                      <p className="text-caption text-muted">{formatDate(r.publishedAt ?? r.createdAt)}</p>
                      <h3 className="mt-2 text-h4 text-navy">
                        <Link href={`/blog/${r.slug}`} className="transition-colors duration-micro after:absolute after:inset-0 hover:text-orange focus-visible:text-orange motion-reduce:transition-none">
                          {r.title}
                        </Link>
                      </h3>
                      {r.excerpt && <p className="mt-2 line-clamp-2 flex-1 text-body-sm text-muted">{r.excerpt}</p>}
                      <span className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-orange">
                        Read post <ArrowRight className="h-4 w-4 transition-transform duration-micro group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                      </span>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand title="Be part of the [[change]]" description="Learn a skill, teach one, or fund a student's training." primary={{ label: "Apply Now", href: "/register" }} secondary={{ label: "Donate", href: "/donate" }} />
    </>
  );
}
