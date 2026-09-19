import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { SafeImage } from "@/components/site/safe-image";
import { Markdown, markdownExcerpt } from "@/components/site/markdown";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";

type Props = { params: Promise<{ slug: string }> };

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
  const related = await db.blog.findMany({ where: { status: "PUBLISHED", id: { not: post.id } }, orderBy: [{ publishedAt: "desc" }], take: 3, select: { id: true, slug: true, title: true, publishedAt: true, createdAt: true } });
  const published = post.publishedAt ?? post.createdAt;

  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.excerpt ?? markdownExcerpt(post.content), datePublished: published.toISOString(), dateModified: post.updatedAt.toISOString(), author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@type": "Organization", name: branding.siteName }, publisher: { "@type": "Organization", name: branding.siteName }, image: post.coverImage ?? undefined, mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`), keywords: post.tags.join(", ") || undefined }} />
      <PageHero compact eyebrow="Blog" title={post.title} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.title }]}>
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-orange" aria-hidden /> {formatDate(published)}
          </span>
          {post.authorName && (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4 text-orange" aria-hidden /> {post.authorName}
            </span>
          )}
        </p>
      </PageHero>
      <article className="container-x py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          {post.coverImage && (
            <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-card-lg bg-lavender">
              <SafeImage src={post.coverImage} alt={post.title} priority sizes="(max-width: 768px) 100vw, 768px" />
            </div>
          )}
          {post.excerpt && <p className="mb-6 text-lg leading-relaxed text-muted">{post.excerpt}</p>}
          <Markdown source={post.content} />
          {post.tags.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t}>
                  <Link href={`/blog?tag=${encodeURIComponent(t)}`} className="rounded-full bg-lavender px-3 py-1 text-xs font-semibold text-navy hover:bg-navy hover:text-white">
                    #{t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-10 flex flex-col gap-6 border-t border-line pt-6 sm:flex-row sm:items-start sm:justify-between">
            <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-orange">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to blog
            </Link>
            {related.length > 0 && (
              <nav aria-label="More posts" className="sm:max-w-sm">
                <p className="text-xs font-bold tracking-wide text-muted uppercase">More from the blog</p>
                <ul className="mt-2 space-y-1.5">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link href={`/blog/${r.slug}`} className="text-sm font-semibold text-navy hover:text-orange">
                        {r.title}
                      </Link>
                      <span className="ml-2 text-xs text-muted">{formatDate(r.publishedAt ?? r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </div>
      </article>
      <CtaBand title="Be part of the [[change]]" description="Learn a skill, teach one, or fund a student's training." primary={{ label: "Apply Now", href: "/register" }} secondary={{ label: "Donate", href: "/donate" }} />
    </>
  );
}
