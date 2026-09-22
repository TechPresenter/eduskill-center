import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/ui/misc";
import { ContentEditor } from "@/components/admin/content/content-editor";
import { blogFields } from "../fields";

export const metadata = { title: "New Blog Post" };

export default async function NewBlogPage() {
  const user = await requireAdmin("cms.update");
  const canPublish = hasPermission(user, "cms.publish");
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "New post" }]} title="New blog post" mobileTitle="New post" backHref="/admin/blog" description="Write in Markdown. Save as a draft first, then publish when ready." />
      <ContentEditor
        publicPrefix="/blog"
        endpoint="/api/admin/blog"
        itemLabel="blog post"
        backHref="/admin/blog"
        canEdit
        fields={blogFields({ canPublish })}
        initial={{ title: "", slug: "", status: "DRAFT", publishedAt: "", authorName: user.name, tags: [], excerpt: "", coverImage: "", content: "", seoTitle: "", seoDescription: "" }}
      />
    </div>
  );
}
