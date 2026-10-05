import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getCourseAdmin } from "@/server/courses";
import { listCourseFaqs } from "@/server/course-cms";
import { PageHeader } from "@/components/ui/misc";
import { orNotFound } from "@/components/admin/shared/server";
import { CourseTabs } from "@/components/admin/courses/course-tabs";
import { CourseFaqManager } from "@/components/admin/courses/course-faq-manager";

export const metadata: Metadata = { title: "Course FAQs · Foundation Admin" };

export default async function CourseFaqsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("courses.view");
  const { id } = await params;
  const course = await orNotFound(getCourseAdmin(id));
  const faqs = await listCourseFaqs(course.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="FAQs"
        description={`${course.name} · ${course.code}`}
        backHref={`/admin/courses/${course.id}`}
        mobileTitle="FAQs"
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.code, href: `/admin/courses/${course.id}` }, { label: "FAQs" }]}
      />
      <CourseTabs courseId={course.id} />
      <CourseFaqManager courseId={course.id} faqs={faqs} canEdit={hasPermission(user, "courses.update")} />
    </div>
  );
}
