import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatNumber, titleCase } from "@/lib/utils";
import { getStaff } from "@/server/staff";
import { listRoles } from "@/server/roles";
import { PageHeader, KeyValue, Avatar } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { orNotFound } from "@/components/admin/shared/server";
import { StaffHeaderActions, StaffPermissionsCard, StaffRoleCard, type StaffProfile } from "@/components/admin/staff/staff-detail";

export const metadata: Metadata = { title: "Staff Member · Foundation Admin" };

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("users.view");
  const { id } = await params;
  const [staff, roles] = await Promise.all([orNotFound(getStaff(id)), listRoles()]);
  const superAdmin = user.role === "SUPER_ADMIN";
  const perms = { update: hasPermission(user, "users.update"), superAdmin: superAdmin && hasPermission(user, "users.update"), delete: superAdmin && hasPermission(user, "users.delete"), isSelf: staff.userId === user.id };
  const profile: StaffProfile = {
    id: staff.id,
    employeeCode: staff.employeeCode,
    name: staff.user.name,
    email: staff.user.email ?? "",
    mobile: staff.user.mobile,
    designation: staff.designation,
    department: staff.department,
    status: staff.user.status,
    roleId: staff.roleId,
    permissions: staff.permissions,
    rolePermissions: staff.rolePermissions,
  };
  const effective = new Set([...staff.rolePermissions, ...staff.permissions]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar name={staff.user.name} src={staff.user.avatarUrl} size={44} />
            {staff.user.name}
            <StatusBadge status={staff.user.status} />
            {perms.isSelf && <Badge tone="info">This is you</Badge>}
          </span>
        }
        description={`${staff.employeeCode}${staff.designation ? ` · ${staff.designation}` : ""}${staff.department ? ` · ${staff.department}` : ""}`}
        breadcrumbs={[{ label: "Staff", href: "/admin/staff" }, { label: staff.employeeCode }]}
        actions={<StaffHeaderActions staff={profile} perms={perms} />}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Profile" />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <KeyValue label="Email" value={staff.user.email ?? "—"} />
              <KeyValue label="Mobile" value={staff.user.mobile ?? "—"} />
              <KeyValue label="Employee code" value={<span className="font-mono">{staff.employeeCode}</span>} />
              <KeyValue label="Account status" value={<StatusBadge status={staff.user.status} />} />
              <KeyValue label="Last login" value={staff.user.lastLoginAt ? formatDateTime(staff.user.lastLoginAt) : "Never"} />
              <KeyValue label="Active sessions" value={formatNumber(staff.activeSessions)} />
              <KeyValue label="Created" value={formatDateTime(staff.user.createdAt)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Role" description={superAdmin ? "Changing the role takes effect at the next request." : "Only the Super Admin can change roles."} />
            <CardBody>
              <StaffRoleCard staff={profile} roles={roles.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions }))} editable={perms.superAdmin} />
              {staff.role && (
                <p className="mt-3 text-xs text-muted">
                  <Link href={`/admin/roles/${staff.role.id}`} className="font-semibold text-navy hover:underline">
                    {staff.role.name}
                  </Link>{" "}
                  grants {staff.rolePermissions.length} permission{staff.rolePermissions.length === 1 ? "" : "s"}.
                </p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent activity" description="Latest audit entries by this person." action={<Link href={`/admin/audit-logs?userId=${staff.userId}`} className="text-xs font-semibold text-orange hover:underline">All</Link>} />
            <ul className="divide-y divide-line">
              {staff.recentAudit.length === 0 && <li className="px-5 py-4 text-sm text-muted">No activity yet.</li>}
              {staff.recentAudit.map((a) => (
                <li key={a.id} className="px-5 py-3 text-sm">
                  <p className="text-ink">{a.description}</p>
                  <p className="text-xs text-muted">
                    {titleCase(a.module)} · {a.action} · {formatDateTime(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Permissions" description={`${effective.size} effective permission${effective.size === 1 ? "" : "s"}: ${staff.rolePermissions.length} from the role, ${staff.permissions.length} granted directly.${superAdmin ? "" : " Only the Super Admin can change direct grants."}`} />
            <CardBody>
              <StaffPermissionsCard staff={profile} editable={perms.superAdmin} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Login history" description="Latest 20 login attempts for this account." />
            <TableWrap className="rounded-none border-0">
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Result</TH>
                  <TH>Identifier</TH>
                  <TH>IP</TH>
                  <TH>Device</TH>
                </tr>
              </THead>
              <TBody>
                {staff.loginHistory.length === 0 && <EmptyRow colSpan={5}>No login attempts recorded.</EmptyRow>}
                {staff.loginHistory.map((h) => (
                  <TR key={h.id}>
                    <TD className="whitespace-nowrap">{formatDateTime(h.createdAt)}</TD>
                    <TD>
                      <Badge tone={h.success ? "success" : "danger"} dot>
                        {h.success ? "Success" : `Failed${h.reason ? ` · ${titleCase(h.reason)}` : ""}`}
                      </Badge>
                    </TD>
                    <TD className="text-xs">{h.identifier}</TD>
                    <TD className="font-mono text-xs">{h.ip ?? "—"}</TD>
                    <TD className="max-w-xs truncate text-xs text-muted" title={h.userAgent ?? undefined}>
                      {h.userAgent ?? "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </Card>
        </div>
      </div>
    </div>
  );
}
