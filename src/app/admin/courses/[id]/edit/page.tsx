import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getCourseAdmin, listCategories, studentDocumentTypes } from "@/server/courses";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { CourseForm } from "@/components/admin/courses/course-form";
import { orNotFound } from "@/components/admin/shared/server";
import { parseSyllabus } from "@/app/admin/courses/syllabus";

export const metadata: Metadata = { title: "Edit Course · Foundation Admin" };

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("courses.update");
  const { id } = await params;
  const [course, categories, documentTypes] = await Promise.all([orNotFound(getCourseAdmin(id)), listCategories(), studentDocumentTypes()]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Edit ${course.name}`} description={<span className="font-mono">{course.code}</span>} breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.code, href: `/admin/courses/${course.id}` }, { label: "Edit" }]} />
      <Card>
        <CardBody>
          <CourseForm
            initial={{
              id: course.id,
              name: course.name,
              code: course.code,
              categoryId: course.categoryId,
              shortDescription: course.shortDescription,
              description: course.description,
              image: course.image,
              icon: course.icon,
              durationText: course.durationText,
              durationWeeks: course.durationWeeks,
              level: course.level,
              mode: course.mode,
              eligibility: course.eligibility,
              minAge: course.minAge,
              maxAge: course.maxAge,
              syllabus: parseSyllabus(course.syllabus),
              totalClasses: course.totalClasses,
              courseFee: course.courseFee,
              registrationFee: course.registrationFee,
              examFee: course.examFee,
              certificateFee: course.certificateFee,
              scholarshipAvailable: course.scholarshipAvailable,
              scholarshipNote: course.scholarshipNote,
              certificateEligibility: course.certificateEligibility,
              minAttendancePct: course.minAttendancePct,
              passingMarksPct: course.passingMarksPct,
              requiredDocuments: course.requiredDocuments,
              status: course.status,
              isFeatured: course.isFeatured,
              sortOrder: course.sortOrder,
              seoTitle: course.seoTitle,
              seoDescription: course.seoDescription,
            }}
            categories={categories.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive }))}
            documentTypes={documentTypes}
          />
        </CardBody>
      </Card>
    </div>
  );
}
