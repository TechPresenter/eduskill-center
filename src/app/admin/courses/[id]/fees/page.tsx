import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getCourseAdmin } from "@/server/courses";
import { getCourseFeePlan } from "@/server/course-cms";
import { feePlanFromCourse, formatMoney } from "@/lib/course-pricing";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";
import { orNotFound } from "@/components/admin/shared/server";
import { CourseTabs } from "@/components/admin/courses/course-tabs";
import { FeePlanEditor } from "@/components/admin/courses/fee-plan-editor";

export const metadata: Metadata = { title: "Course fees · Foundation Admin" };

export default async function CourseFeesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("courses.view");
  const { id } = await params;
  const course = await orNotFound(getCourseAdmin(id));
  const plan = await getCourseFeePlan(course.id);
  const fallback = feePlanFromCourse({ courseFee: course.courseFee, registrationFee: course.registrationFee });

  // The plan is what the site shows; admission bills the course record. Say so when they differ,
  // because a student would otherwise be charged an amount the course page never showed them.
  const billedTotal = course.courseFee + course.registrationFee + course.examFee + course.certificateFee;
  const mismatches: string[] = [];
  if (plan) {
    const currency = plan.currency || "INR";
    if (plan.feeType === "FREE" && billedTotal > 0) mismatches.push(`The plan is “No fee”, but admission bills ${formatMoney(billedTotal, currency)}. The site shows the billed fees instead.`);
    if ((plan.feeType === "ONE_TIME" || plan.feeType === "MONTHLY") && plan.baseFee !== course.courseFee) {
      mismatches.push(`The plan's ${plan.feeType === "MONTHLY" ? "monthly" : "course"} fee is ${formatMoney(plan.baseFee, currency)}, but the course record bills ${formatMoney(course.courseFee, currency)}.`);
    }
    if (plan.discountedFee != null || plan.offerPrice != null) mismatches.push("The plan's discounted fee or offer price is shown on the site, but admission does not apply it.");
    if (plan.enrolmentFee !== course.registrationFee) {
      mismatches.push(`The plan's enrolment fee is ${formatMoney(plan.enrolmentFee, currency)}, but the registration fee billed is ${formatMoney(course.registrationFee, currency)}.`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees"
        description={`${course.name} · ${course.code}`}
        backHref={`/admin/courses/${course.id}`}
        mobileTitle="Fees"
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.code, href: `/admin/courses/${course.id}` }, { label: "Fees" }]}
      />
      <CourseTabs courseId={course.id} />
      <Alert tone="info" title="This sets how the price is shown, not what is billed">
        <span>
          The amounts a student is actually charged stay on the{" "}
          <Link href={`/admin/courses/${course.id}/edit`} className="font-semibold text-orange hover:underline">
            course record
          </Link>{" "}
          (course, registration, exam and certificate fee) and are unchanged by this screen.
        </span>
      </Alert>
      {mismatches.length > 0 && (
        <Alert tone="warning" title="The public price does not match what admission bills">
          <ul className="list-disc space-y-1 pl-5">
            {mismatches.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      )}
      <FeePlanEditor
        courseId={course.id}
        plan={plan}
        fallback={fallback}
        billed={{ courseFee: course.courseFee, registrationFee: course.registrationFee, examFee: course.examFee, certificateFee: course.certificateFee }}
        // Offers are not shown on the public page yet (billing does not apply them), so none is previewed.
        offer={null}
        canEdit={hasPermission(user, "courses.update")}
      />
    </div>
  );
}
