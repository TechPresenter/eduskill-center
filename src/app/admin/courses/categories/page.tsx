import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listCategories } from "@/server/courses";
import { PageHeader } from "@/components/ui/misc";
import { CategoryManager } from "@/components/admin/courses/category-manager";

export const metadata: Metadata = { title: "Course Categories · Foundation Admin" };

export default async function CourseCategoriesPage() {
  const user = await requireAdmin("courses.view");
  const categories = await listCategories();
  return (
    <div>
      <PageHeader title="Course categories" description="Categories group courses on the website and in filters." breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: "Categories" }]} />
      <CategoryManager
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, icon: c.icon, sortOrder: c.sortOrder, isActive: c.isActive, courses: c._count.courses }))}
        canCreate={hasPermission(user, "courses.create")}
        canUpdate={hasPermission(user, "courses.update")}
        canDelete={hasPermission(user, "courses.delete")}
      />
    </div>
  );
}
