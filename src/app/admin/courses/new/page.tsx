import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { listCategories, studentDocumentTypes } from "@/server/courses";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { CourseForm } from "@/components/admin/courses/course-form";

export const metadata: Metadata = { title: "New Course · Foundation Admin" };

export default async function NewCoursePage() {
  await requireAdmin("courses.create");
  const [categories, documentTypes] = await Promise.all([listCategories(), studentDocumentTypes()]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Add a course" description="New courses start as drafts. Activate them once the syllabus and fees are final." breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: "New" }]} />
      <Card>
        <CardBody>
          <CourseForm categories={categories.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive }))} documentTypes={documentTypes} />
        </CardBody>
      </Card>
    </div>
  );
}
