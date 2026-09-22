import type { Metadata } from "next";
import { ShieldCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/utils";
import { getRole } from "@/server/roles";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { orNotFound } from "@/components/admin/shared/server";
import { AppListRow, IconTile } from "@/components/admin/content/app-list";
import { RoleEditor } from "@/components/admin/roles/role-editor";

export const metadata: Metadata = { title: "Role · Foundation Admin" };

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("roles.view");
  const { id } = await params;
  const role = await orNotFound(getRole(id));
  const superAdmin = user.role === "SUPER_ADMIN";
  const typeBadge = role.isSystem ? <Badge tone="navy">System role</Badge> : <Badge tone="neutral">Custom role</Badge>;

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {role.name}
            {typeBadge}
          </span>
        }
        mobileTitle={role.name}
        backHref="/admin/roles"
        description={<span className="hidden lg:inline">{role.description ?? "No description."}</span>}
        breadcrumbs={[{ label: "Roles", href: "/admin/roles" }, { label: role.name }]}
      />

      {/* Phones: identity card. */}
      <Card className="flex items-start gap-4 p-4 lg:hidden">
        <IconTile size="lg" tone={role.isSystem ? "navy" : "lavender"}>
          <ShieldCheck />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h2 className="text-h4 break-words text-navy">{role.name}</h2>
          <p className="mt-0.5 text-body-sm text-muted">{role.description ?? "No description."}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {typeBadge}
            <Badge tone="neutral">
              <span className="tabular-nums">{role.permissions.length}</span> permissions
            </Badge>
            <Badge tone="neutral">
              <span className="tabular-nums">{role.staff.length}</span> staff
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Permissions" description={`${role.permissions.length} permission${role.permissions.length === 1 ? "" : "s"} · last updated ${formatDateTime(role.updatedAt)}`} />
          <CardBody>
            <RoleEditor role={{ id: role.id, name: role.name, description: role.description, isSystem: role.isSystem, permissions: role.permissions, staffCount: role.staff.length }} editable={superAdmin && hasPermission(user, "roles.update")} deletable={superAdmin && hasPermission(user, "roles.delete")} />
          </CardBody>
        </Card>
        <Card className="self-start">
          <CardHeader title="Staff with this role" description={`${role.staff.length} account${role.staff.length === 1 ? "" : "s"}`} />
          {role.staff.length === 0 ? (
            <EmptyState bare size="sm" icon={<Users className="h-6 w-6" />} title="No staff yet" description="Assign this role from a staff member's profile." />
          ) : (
            <ul className="divide-y divide-line">
              {role.staff.map((s) => (
                <AppListRow
                  key={s.id}
                  href={`/admin/staff/${s.id}`}
                  leading={<Avatar name={s.user.name} size={40} />}
                  title={s.user.name}
                  subtitle={[s.employeeCode, s.designation].filter(Boolean).join(" · ")}
                  clamp={1}
                  trailing={<StatusBadge status={s.user.status} />}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
