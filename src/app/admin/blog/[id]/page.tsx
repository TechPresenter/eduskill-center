import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/utils";
import { getBlog } from "@/server/content";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { ContentEditor } from "@/components/admin/content/content-editor";
import { toDateTimeLocal } from "@/components/admin/content/fields";
import { blogFields } from "../fields";

export const metadata = { title: "Edit Blog Post" };

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("cms.view");
  const { id } = await params;
  const blog = await getBlog(id).catch(() => null);
  if (!blog) notFound();
  const canEdit = hasPermission(user, "cms.update");
  const canPublish = hasPermission(user, "cms.publish");

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: blog.title }]}
        mobileTitle={blog.title}
        backHref="/admin/blog"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {blog.title}
            <StatusBadge status={blog.status} />
          </span>
        }
        description={<span className="font-mono">/blog/{blog.slug}</span>}
      />
      <ContentEditor
        publicPrefix="/blog"
        endpoint="/api/admin/blog"
        id={blog.id}
        itemLabel="blog post"
        backHref="/admin/blog"
        canEdit={canEdit}
        viewHref={blog.status === "PUBLISHED" ? `/blog/${blog.slug}` : null}
        fields={blogFields({ canPublish })}
        initial={{ title: blog.title, slug: blog.slug, status: blog.status, publishedAt: toDateTimeLocal(blog.publishedAt), authorName: blog.authorName ?? "", tags: blog.tags, excerpt: blog.excerpt ?? "", coverImage: blog.coverImage ?? "", content: blog.content, seoTitle: blog.seoTitle ?? "", seoDescription: blog.seoDescription ?? "" }}
        meta={`Last saved ${formatDateTime(blog.updatedAt)}${blog.publishedAt ? ` · published ${formatDateTime(blog.publishedAt)}` : ""}`}
      />
    </div>
  );
}
