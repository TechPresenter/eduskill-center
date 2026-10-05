import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getCourseAdmin } from "@/server/courses";
import { getCourseCurriculum } from "@/server/course-cms";
import { PageHeader } from "@/components/ui/misc";
import { orNotFound } from "@/components/admin/shared/server";
import { CourseTabs } from "@/components/admin/courses/course-tabs";
import { CurriculumEditor } from "@/components/admin/courses/curriculum-editor";

export const metadata: Metadata = { title: "Curriculum · Foundation Admin" };

export default async function CourseCurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("courses.view");
  const { id } = await params;
  const course = await orNotFound(getCourseAdmin(id));
  const tree = await getCourseCurriculum(course.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum"
        description={`${course.name} · ${course.code}`}
        backHref={`/admin/courses/${course.id}`}
        mobileTitle="Curriculum"
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.code, href: `/admin/courses/${course.id}` }, { label: "Curriculum" }]}
      />
      <CourseTabs courseId={course.id} />
      <CurriculumEditor courseId={course.id} tree={tree} canEdit={hasPermission(user, "courses.update")} />
    </div>
  );
}
