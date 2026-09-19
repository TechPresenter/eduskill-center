import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSetting } from "@/lib/settings";
import { dateInputValue } from "@/lib/utils";
import { getCenterAdmin } from "@/server/centers";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { CenterForm } from "@/components/admin/centers/center-form";
import { orNotFound } from "@/components/admin/shared/server";
import { centerCourseOptions } from "@/app/admin/centers/queries";

export const metadata: Metadata = { title: "Edit Training Center · Foundation Admin" };

export default async function EditCenterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("centers.update");
  const { id } = await params;
  const center = await orNotFound(getCenterAdmin(id));
  const courseIds = center.courses.map((c) => c.courseId);
  const [courses, prefix, format] = await Promise.all([centerCourseOptions(courseIds), getSetting<string>("codes.centerPrefix"), getSetting<string>("codes.centerFormat")]);
  const openingHours = center.openingHours && typeof center.openingHours === "object" && !Array.isArray(center.openingHours) ? (Object.fromEntries(Object.entries(center.openingHours as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])) as Record<string, string>) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit ${center.name}`} mobileTitle={`Edit ${center.code}`} backHref={`/admin/centers/${center.id}`} description={<span className="font-mono">{center.code}</span>} breadcrumbs={[{ label: "Training Centers", href: "/admin/centers" }, { label: center.code, href: `/admin/centers/${center.id}` }, { label: "Edit" }]} />
      <Card>
        <CardBody>
          <CenterForm
            initial={{
              id: center.id,
              code: center.code,
              name: center.name,
              stateId: center.stateId,
              districtId: center.districtId,
              blockId: center.blockId,
              address: center.address,
              landmark: center.landmark,
              villageTown: center.villageTown,
              pincode: center.pincode,
              latitude: center.latitude,
              longitude: center.longitude,
              phone: center.phone,
              whatsapp: center.whatsapp,
              email: center.email,
              contactPerson: center.contactPerson,
              openingHours,
              capacity: center.capacity,
              facilities: center.facilities,
              description: center.description,
              coverImage: center.coverImage,
              isVerified: center.isVerified,
              status: center.status,
              establishedOn: center.establishedOn ? dateInputValue(center.establishedOn) : null,
              courseIds,
            }}
            courses={courses}
            canVerify={hasPermission(user, "centers.verify")}
            codeFormat={format.replace("{PREFIX}", prefix)}
          />
        </CardBody>
      </Card>
    </div>
  );
}
