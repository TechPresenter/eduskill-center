import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listBlogCategories } from "@/server/blog";
import { PageHeader } from "@/components/ui/misc";
import { BlogCategoryManager } from "@/components/admin/blog/category-manager";

export const metadata: Metadata = { title: "Blog Categories · Foundation Admin" };

export default async function BlogCategoriesPage() {
  const user = await requireAdmin("cms.view");
  const categories = await listBlogCategories();
  // The `cms` module has exactly view / update / publish — there is no `cms.create` or
  // `cms.delete`. The three flags are kept separate so a future split is a change here and
  // nowhere else, but today they all resolve to the one permission that owns website content.
  const canWrite = hasPermission(user, "cms.update");

  return (
    <div>
      <PageHeader
        title="Blog categories"
        mobileTitle="Categories"
        description="Categories group articles on the blog and give each group its own page, chip colour and search listing."
        backHref="/admin/blog"
        breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "Categories" }]}
      />
      <BlogCategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          icon: c.icon,
          colorTone: c.colorTone,
          sortOrder: c.sortOrder,
          isActive: c.isActive,
          seoTitle: c.seoTitle,
          seoDescription: c.seoDescription,
          posts: c._count.posts,
        }))}
        canCreate={canWrite}
        canUpdate={canWrite}
        canDelete={canWrite}
      />
    </div>
  );
}
