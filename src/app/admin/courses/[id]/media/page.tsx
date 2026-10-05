import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getCourseAdmin } from "@/server/courses";
import { listCourseMedia } from "@/server/course-cms";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { orNotFound } from "@/components/admin/shared/server";
import { CourseTabs } from "@/components/admin/courses/course-tabs";
import { MediaManager } from "@/components/admin/courses/media-manager";

export const metadata: Metadata = { title: "Course media · Foundation Admin" };

export default async function CourseMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("courses.view");
  const { id } = await params;
  const course = await orNotFound(getCourseAdmin(id));
  // Pooled client, not a transaction client, so Promise.all is safe here (see CLAUDE.md).
  const [media, slotRow] = await Promise.all([
    listCourseMedia(course.id),
    db.course.findUniqueOrThrow({ where: { id: course.id }, select: { bannerImage: true, instructorImage: true, promoVideoUrl: true, videoThumbnail: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media"
        description={`${course.name} · ${course.code}`}
        backHref={`/admin/courses/${course.id}`}
        mobileTitle="Media"
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.code, href: `/admin/courses/${course.id}` }, { label: "Media" }]}
      />
      <CourseTabs courseId={course.id} />
      <MediaManager
        courseId={course.id}
        slots={{
          bannerImage: slotRow.bannerImage ?? "",
          instructorImage: slotRow.instructorImage ?? "",
          promoVideoUrl: slotRow.promoVideoUrl ?? "",
          videoThumbnail: slotRow.videoThumbnail ?? "",
        }}
        gallery={media.filter((m) => m.kind === "GALLERY")}
        promotional={media.filter((m) => m.kind === "PROMOTIONAL")}
        canEdit={hasPermission(user, "courses.update")}
      />
    </div>
  );
}
