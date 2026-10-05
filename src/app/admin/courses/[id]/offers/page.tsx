import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getCourseAdmin } from "@/server/courses";
import { getCourseFeePlan, getEffectiveOffer, listCourseOffers } from "@/server/course-cms";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";
import { orNotFound } from "@/components/admin/shared/server";
import { CourseTabs } from "@/components/admin/courses/course-tabs";
import { OffersManager, type OfferRow } from "@/components/admin/courses/offers-manager";
import { offerState } from "@/components/admin/courses/offer-status";

export const metadata: Metadata = { title: "Course offers · Foundation Admin" };

export default async function CourseOffersPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("courses.view");
  const { id } = await params;
  const course = await orNotFound(getCourseAdmin(id));
  const now = new Date();
  // Pooled client, not a transaction client, so Promise.all is safe here (see CLAUDE.md).
  const [offers, effective, plan] = await Promise.all([listCourseOffers(course.id), getEffectiveOffer(course.id, now), getCourseFeePlan(course.id)]);

  // Which offer the site is showing comes from the service (`getEffectiveOffer`), never from a date
  // comparison written here; `offerState` only decides which side of its window the rest sit on.
  const rows: OfferRow[] = offers.map((offer) => ({ ...offer, state: offerState(offer, effective?.id ?? null, now) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers"
        description={`${course.name} · ${course.code}`}
        backHref={`/admin/courses/${course.id}`}
        mobileTitle="Offers"
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.code, href: `/admin/courses/${course.id}` }, { label: "Offers" }]}
      />
      <CourseTabs courseId={course.id} />
      <Alert tone="info" title="Offers are not shown on the website yet">
        Admission still bills the full fees on the course record — an offer price or coupon code is not applied when a student is charged. Until it is,
        the public course page does not show offers, so nobody is promised a price they will not pay. You can still prepare offers here.
      </Alert>
      <OffersManager courseId={course.id} offers={rows} currency={plan?.currency ?? "INR"} canEdit={hasPermission(user, "courses.update")} />
    </div>
  );
}
