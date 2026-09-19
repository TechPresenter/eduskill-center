import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { listRoles } from "@/server/roles";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { StaffCreateForm } from "@/components/admin/staff/staff-form";

export const metadata: Metadata = { title: "New Staff Account · Foundation Admin" };

export default async function NewStaffPage() {
  const user = await requireAdmin("users.create");
  if (user.role !== "SUPER_ADMIN") redirect("/admin/forbidden");
  const roles = await listRoles();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Add a staff account" description="Creates a Foundation Staff login. The employee code is generated automatically." breadcrumbs={[{ label: "Staff", href: "/admin/staff" }, { label: "New" }]} />
      <Card>
        <CardBody>
          <StaffCreateForm roles={roles.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions }))} />
        </CardBody>
      </Card>
    </div>
  );
}
