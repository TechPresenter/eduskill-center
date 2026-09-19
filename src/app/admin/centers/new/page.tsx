import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { CenterForm } from "@/components/admin/centers/center-form";
import { centerCourseOptions } from "@/app/admin/centers/queries";

export const metadata: Metadata = { title: "New Training Center · Foundation Admin" };

export default async function NewCenterPage() {
  const user = await requireAdmin("centers.create");
  const [courses, prefix, format] = await Promise.all([centerCourseOptions(), getSetting<string>("codes.centerPrefix"), getSetting<string>("codes.centerFormat")]);
  const codeFormat = format.replace("{PREFIX}", prefix);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add a training center" mobileTitle="New center" backHref="/admin/centers" description="Register a center at block level. The center code is generated automatically and never changes." breadcrumbs={[{ label: "Training Centers", href: "/admin/centers" }, { label: "New" }]} />
      <Alert tone="info" className="mb-4" title={`Code format: ${codeFormat}`}>
        STATE and DISTRICT are the codes configured under Locations; SEQ is a per-district running number. Change the format under Settings → ID Formats (existing codes are never rewritten).
      </Alert>
      <Card>
        <CardBody>
          <CenterForm courses={courses} canVerify={hasPermission(user, "centers.verify")} codeFormat={codeFormat} />
        </CardBody>
      </Card>
    </div>
  );
}
