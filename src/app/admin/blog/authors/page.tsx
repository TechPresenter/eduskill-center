import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listBlogAuthors } from "@/server/blog";
import { PageHeader } from "@/components/ui/misc";
import { BlogAuthorManager } from "@/components/admin/blog/author-manager";

export const metadata: Metadata = { title: "Blog Authors · Foundation Admin" };

export default async function BlogAuthorsPage() {
  const user = await requireAdmin("cms.view");
  const authors = await listBlogAuthors();
  // The `cms` module has exactly view / update / publish — there is no `cms.create` or
  // `cms.delete`. The three flags are kept separate so a future split is a change here and
  // nowhere else, but today they all resolve to the one permission that owns website content.
  const canWrite = hasPermission(user, "cms.update");

  return (
    <div>
      <PageHeader
        title="Blog authors"
        mobileTitle="Authors"
        description="An author gives an article a face: a photo, a role, a short bio and links, plus an archive page listing everything they have written."
        backHref="/admin/blog"
        breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "Authors" }]}
      />
      <BlogAuthorManager
        authors={authors.map((a) => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          role: a.role,
          bio: a.bio,
          avatar: a.avatar,
          email: a.email,
          linkedinUrl: a.linkedinUrl,
          twitterUrl: a.twitterUrl,
          websiteUrl: a.websiteUrl,
          isActive: a.isActive,
          sortOrder: a.sortOrder,
          posts: a._count.posts,
        }))}
        canCreate={canWrite}
        canUpdate={canWrite}
        canDelete={canWrite}
      />
    </div>
  );
}
