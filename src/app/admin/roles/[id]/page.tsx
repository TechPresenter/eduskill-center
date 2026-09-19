import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/utils";
import { getRole } from "@/server/roles";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { orNotFound } from "@/components/admin/shared/server";
import { RoleEditor } from "@/components/admin/roles/role-editor";

export const metadata: Metadata = { title: "Role · Foundation Admin" };

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("roles.view");
  const { id } = await params;
  const role = await orNotFound(getRole(id));
  const superAdmin = user.role === "SUPER_ADMIN";
  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {role.name}
            {role.isSystem ? <Badge tone="navy">System role</Badge> : <Badge tone="neutral">Custom role</Badge>}
          </span>
        }
        mobileTitle={role.name}
        backHref="/admin/roles"
        description={role.description ?? "No description."}
        breadcrumbs={[{ label: "Roles", href: "/admin/roles" }, { label: role.name }]}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Permissions" description={`${role.permissions.length} permission${role.permissions.length === 1 ? "" : "s"} · last updated ${formatDateTime(role.updatedAt)}`} />
          <CardBody>
            <RoleEditor role={{ id: role.id, name: role.name, description: role.description, isSystem: role.isSystem, permissions: role.permissions, staffCount: role.staff.length }} editable={superAdmin && hasPermission(user, "roles.update")} deletable={superAdmin && hasPermission(user, "roles.delete")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Staff with this role" description={`${role.staff.length} account${role.staff.length === 1 ? "" : "s"}`} />
          <ul className="divide-y divide-line">
            {role.staff.length === 0 && <li className="px-5 py-4 text-sm text-muted">No staff assigned yet.</li>}
            {role.staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <Link href={`/admin/staff/${s.id}`} className="min-w-0">
                  <span className="block truncate font-medium text-navy hover:underline">{s.user.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {s.employeeCode}
                    {s.designation ? ` · ${s.designation}` : ""}
                  </span>
                </Link>
                <StatusBadge status={s.user.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
