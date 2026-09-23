import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { displayStatus, isLive, isScheduled } from "@/lib/blog/visibility";
import { formatDateTime, formatNumber, toDate } from "@/lib/utils";
import { getBlog, listBlogAuthors, listBlogCategories } from "@/server/blog";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { BlogEditor } from "@/components/admin/blog/blog-editor";
import type { BlogFormValues, RelatedOption } from "@/components/admin/blog/types";

export const metadata = { title: "Edit Blog Post" };

/**
 * `Date` → the value an `<input type="datetime-local">` expects, in local time.
 *
 * The repo's `toDateTimeLocal()` lives in `@/components/admin/content/fields`, which carries
 * `"use client"` — importing it here compiles, but calling it during a SERVER render throws
 * "Attempted to call toDateTimeLocal() from the server", which React only survives by throwing
 * the whole page away and re-rendering it in the browser. This page is a server component, so it
 * needs its own copy; it is four lines and produces a byte-identical string.
 *
 * Note the shape must NOT be an ISO/UTC string: `datetime-local` has no timezone, so `new Date()`
 * in the browser would read the Z-suffixed value back as UTC and shift the go-live time by the
 * offset. Formatting from the local parts is what keeps the round trip stable, and matches every
 * other date the admin renders (`formatDateTime` is server-local too).
 */
function dateTimeLocalValue(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Titles for the posts already pinned in `relatedPostIds`.
 *
 * The column stores ids and nothing else, so without this the picker would open showing three
 * opaque uuids. It is a bare `select` on an admin screen — no `livePostWhere()` — deliberately:
 * a pinned draft must still be visible (and removable) in the editor, and nothing here reaches a
 * public surface. `listRelatedPosts` in `@/server/blog-public` is what a READER goes through, and
 * that one is gated.
 *
 * The rows come back in whatever order Postgres likes, so they are re-sorted onto the pinned
 * order — that order is the running order on the article, so losing it would silently reshuffle
 * the reader's "keep reading" strip on the next save.
 */
async function loadPinned(ids: string[]): Promise<RelatedOption[]> {
  if (!ids.length) return [];
  const rows = await db.blog.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, slug: true } });
  // A pin whose post has since been deleted simply drops out, which is also what the article does.
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is RelatedOption => Boolean(r));
}

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("cms.view");
  const { id } = await params;
  // Unlike the create screen these lists are NOT filtered to active rows. A post attached to a
  // category or author that was later retired must keep showing it: a `<Select>` whose value is
  // missing from its options renders blank, and the next save would quietly detach the post.
  const [blog, categories, authors] = await Promise.all([getBlog(id).catch(() => null), listBlogCategories(), listBlogAuthors()]);
  if (!blog) notFound();

  const relatedInitial = await loadPinned(blog.relatedPostIds);
  // Blog writes — create, update AND delete — all sit on `cms.update`; the catalog has no
  // `cms.delete`, so existing Content Staff keep the ability they have today.
  const canEdit = hasPermission(user, "cms.update");
  const scheduled = isScheduled(blog);

  const initial: BlogFormValues = {
    title: blog.title,
    slug: blog.slug,
    excerpt: blog.excerpt ?? "",
    content: blog.content,
    coverImage: blog.coverImage ?? "",
    coverImageAlt: blog.coverImageAlt ?? "",
    authorId: blog.authorId ?? "",
    authorName: blog.authorName ?? "",
    categoryId: blog.categoryId ?? "",
    tags: blog.tags,
    status: blog.status,
    publishedAt: dateTimeLocalValue(blog.publishedAt),
    isFeatured: blog.isFeatured,
    relatedPostIds: blog.relatedPostIds,
    seoTitle: blog.seoTitle ?? "",
    seoDescription: blog.seoDescription ?? "",
    canonicalUrl: blog.canonicalUrl ?? "",
    ogImage: blog.ogImage ?? "",
    noIndex: blog.noIndex,
  };

  const meta = [
    `Last saved ${formatDateTime(blog.updatedAt)}`,
    blog.publishedAt ? `${scheduled ? "scheduled for" : "published"} ${formatDateTime(blog.publishedAt)}` : null,
    `${formatNumber(blog.wordCount)} words · ${blog.readingMinutes} min read`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: blog.title }]}
        mobileTitle={blog.title}
        backHref="/admin/blog"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {blog.title}
            {/* Derived, not `blog.status`: a post published-dated into next week reads "Scheduled". */}
            <StatusBadge status={displayStatus(blog)} />
          </span>
        }
        description={<span className="font-mono">/blog/{blog.slug}</span>}
      />
      <BlogEditor
        id={blog.id}
        initial={initial}
        categories={categories.map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name} (inactive)` }))}
        authors={authors.map((a) => ({ value: a.id, label: a.isActive ? a.name : `${a.name} (inactive)` }))}
        relatedInitial={relatedInitial}
        canEdit={canEdit}
        canPublish={hasPermission(user, "cms.publish")}
        canDelete={canEdit}
        // A live post gets its real address; a draft, an archived post or one still under embargo
        // gets the staff-only preview, which renders the same template without publishing anything.
        viewHref={isLive(blog) ? `/blog/${blog.slug}` : `/blog/preview/${blog.id}`}
        meta={meta}
      />
    </div>
  );
}
