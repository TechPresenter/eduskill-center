import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listBlogTags } from "@/server/blog";
import { PageHeader } from "@/components/ui/misc";
import { BlogTagManager } from "@/components/admin/blog/tag-manager";

export const metadata: Metadata = { title: "Blog Tags · Foundation Admin" };

export default async function BlogTagsPage() {
  const user = await requireAdmin("cms.view");
  const tags = await listBlogTags();
  // Writes on the blog all sit on `cms.update` — the `cms` module has no create/delete of its own.
  const canWrite = hasPermission(user, "cms.update");

  return (
    <div>
      <PageHeader
        title="Blog tags"
        mobileTitle="Tags"
        // Tags have no "Add" button on purpose, so the description says where they come from
        // before anyone goes looking for one.
        description="Tags are created by typing them on a post. This screen is where near-duplicates get tidied up: rename a tag, merge two that mean the same thing, or remove one entirely."
        backHref="/admin/blog"
        breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "Tags" }]}
      />
      <BlogTagManager
        tags={tags.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          description: t.description,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
          postCount: t.postCount,
        }))}
        canUpdate={canWrite}
        canDelete={canWrite}
      />
    </div>
  );
}
