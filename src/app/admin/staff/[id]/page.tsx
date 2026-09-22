import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, History, KeyRound, LogIn, ShieldCheck, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatNumber, titleCase } from "@/lib/utils";
import { getStaff } from "@/server/staff";
import { listRoles } from "@/server/roles";
import { PageHeader, KeyValue, Avatar } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { orNotFound } from "@/components/admin/shared/server";
import { IconTile } from "@/components/admin/content/app-list";
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
  const subtitle = [staff.employeeCode, staff.designation, staff.department].filter(Boolean).join(" · ");

  const stats = [
    { label: "Permissions", value: formatNumber(effective.size), icon: <ShieldCheck />, tone: "lavender" as const },
    { label: "Direct grants", value: formatNumber(staff.permissions.length), icon: <KeyRound />, tone: "orange" as const },
    { label: "Sessions", value: formatNumber(staff.activeSessions), icon: <LogIn />, tone: "info" as const },
    { label: "Last login", value: staff.user.lastLoginAt ? formatDate(staff.user.lastLoginAt) : "Never", icon: <History />, tone: "neutral" as const },
  ];

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar name={staff.user.name} src={staff.user.avatarUrl} size={44} />
            {staff.user.name}
            <StatusBadge status={staff.user.status} />
            {perms.isSelf && <Badge tone="info">This is you</Badge>}
          </span>
        }
        mobileTitle={staff.user.name}
        backHref="/admin/staff"
        description={subtitle ? <span className="hidden lg:inline">{subtitle}</span> : undefined}
        breadcrumbs={[{ label: "Staff", href: "/admin/staff" }, { label: staff.employeeCode }]}
        actions={<StaffHeaderActions staff={profile} perms={perms} />}
        mobileActions={<StaffHeaderActions staff={profile} perms={perms} variant="menu" />}
      />

      {/* Phones: identity card (the app bar only has room for the name). */}
      <Card className="flex items-center gap-4 p-4 lg:hidden">
        <Avatar name={staff.user.name} src={staff.user.avatarUrl} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="text-h4 break-words text-navy">{staff.user.name}</h2>
          {subtitle && <p className="mt-0.5 text-body-sm text-muted">{subtitle}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={staff.user.status} />
            {staff.role ? <Badge tone="navy">{staff.role.name}</Badge> : <Badge tone="neutral">No role</Badge>}
            {perms.isSelf && <Badge tone="info">This is you</Badge>}
          </div>
        </div>
      </Card>

      {/* At-a-glance numbers. */}
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card flex items-center gap-3 p-4">
            <IconTile tone={s.tone} className="max-sm:hidden">
              {s.icon}
            </IconTile>
            <div className="min-w-0">
              <dt className="truncate text-caption font-semibold tracking-wide text-muted uppercase">{s.label}</dt>
              <dd className="truncate text-body font-bold text-navy tabular-nums">{s.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Profile" />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <KeyValue label="Email" value={staff.user.email ? <a href={`mailto:${staff.user.email}`} className="break-all text-navy hover:underline">{staff.user.email}</a> : "—"} />
              <KeyValue label="Mobile" value={staff.user.mobile ? <a href={`tel:${staff.user.mobile}`} className="text-navy tabular-nums hover:underline">{staff.user.mobile}</a> : "—"} />
              <KeyValue label="Employee code" value={<span className="font-mono">{staff.employeeCode}</span>} />
              <KeyValue label="Account status" value={<StatusBadge status={staff.user.status} />} />
              <KeyValue label="Created" value={formatDateTime(staff.user.createdAt)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Role" description={superAdmin ? "Changing the role takes effect at the next request." : "Only the Super Admin can change roles."} />
            <CardBody>
              <StaffRoleCard staff={profile} roles={roles.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions }))} editable={perms.superAdmin} />
              {staff.role && (
                <p className="mt-3 text-caption text-muted">
                  <Link href={`/admin/roles/${staff.role.id}`} className="inline-flex min-h-11 items-center font-semibold text-navy hover:underline md:min-h-0">
                    {staff.role.name}
                  </Link>{" "}
                  grants {staff.rolePermissions.length} permission{staff.rolePermissions.length === 1 ? "" : "s"}.
                </p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Recent activity"
              description="Latest audit entries by this person."
              action={
                <Link href={`/admin/audit-logs?userId=${staff.userId}`} className="ring-focus inline-flex min-h-11 items-center rounded-md px-2 text-body-sm font-semibold text-orange hover:underline md:min-h-0">
                  View all
                </Link>
              }
            />
            {staff.recentAudit.length === 0 ? (
              <EmptyState bare size="sm" icon={<History className="h-6 w-6" />} title="No activity yet" description="Actions this person takes in the admin appear here." />
            ) : (
              <ul className="divide-y divide-line">
                {staff.recentAudit.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                    <IconTile size="sm" tone="neutral">
                      <History />
                    </IconTile>
                    <div className="min-w-0">
                      <p className="text-body-sm text-ink">{a.description}</p>
                      <p className="mt-0.5 text-caption text-muted">
                        {titleCase(a.module)} · {a.action} · {formatDateTime(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
            <CardHeader title="Login history" description="Latest 20 sign-in attempts for this account." />
            {staff.loginHistory.length === 0 ? (
              <EmptyState bare size="sm" icon={<LogIn className="h-6 w-6" />} title="No sign-ins recorded" description="Successful and failed sign-in attempts appear here." />
            ) : (
              <>
                {/* Phones: one row per attempt. */}
                <ul className="divide-y divide-line md:hidden">
                  {staff.loginHistory.map((h) => (
                    <li key={h.id} className="flex items-start gap-3 px-4 py-3">
                      <IconTile size="sm" tone={h.success ? "success" : "danger"}>
                        {h.success ? <CheckCircle2 /> : <XCircle />}
                      </IconTile>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm font-semibold text-ink">{h.success ? "Signed in" : `Failed${h.reason ? ` · ${titleCase(h.reason)}` : ""}`}</p>
                        <p className="truncate text-caption text-muted">
                          {h.identifier} · <span className="font-mono">{h.ip ?? "no IP"}</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-caption text-muted tabular-nums">{formatDateTime(h.createdAt)}</span>
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block">
                  <TableWrap cards={false} className="rounded-none border-0 shadow-none">
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
                          <TD className="whitespace-nowrap tabular-nums">{formatDateTime(h.createdAt)}</TD>
                          <TD>
                            <Badge tone={h.success ? "success" : "danger"} dot>
                              {h.success ? "Success" : `Failed${h.reason ? ` · ${titleCase(h.reason)}` : ""}`}
                            </Badge>
                          </TD>
                          <TD className="text-caption">{h.identifier}</TD>
                          <TD className="font-mono text-caption">{h.ip ?? "—"}</TD>
                          <TD className="max-w-xs truncate text-caption text-muted" title={h.userAgent ?? undefined}>
                            {h.userAgent ?? "—"}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </TableWrap>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
