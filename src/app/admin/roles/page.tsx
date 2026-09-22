import type { Metadata } from "next";
import Link from "next/link";
import { KeySquare, Lock, ShieldCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber } from "@/lib/utils";
import { listRoles } from "@/server/roles";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, IconButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { AppList, AppListRow, IconTile } from "@/components/admin/content/app-list";
import { CreateRoleButton } from "@/components/admin/roles/role-editor";

export const metadata: Metadata = { title: "Roles · Foundation Admin" };

export default async function RolesPage() {
  const user = await requireAdmin("roles.view");
  const roles = await listRoles();
  const canCreate = user.role === "SUPER_ADMIN" && hasPermission(user, "roles.create");
  const staffTotal = roles.reduce((n, r) => n + r.staffCount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Roles"
        mobileTitle="Roles"
        description={`${formatNumber(roles.length)} role${roles.length === 1 ? "" : "s"} held by ${formatNumber(staffTotal)} staff account${staffTotal === 1 ? "" : "s"}. The Super Admin holds every permission implicitly.`}
        actions={
          <>
            <ButtonLink href="/admin/permissions" variant="outline" size="sm" leftIcon={<KeySquare className="h-4 w-4" />}>
              Permission catalog
            </ButtonLink>
            <CreateRoleButton disabled={!canCreate} />
          </>
        }
        mobileActions={<IconButtonLink href="/admin/permissions" icon={<KeySquare className="h-5 w-5" />} aria-label="Permission catalog" />}
      />

      {roles.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-7 w-7" />} title="No roles yet" description="Roles bundle permissions so staff with the same job get the same access. Create one, then assign it from a staff profile." />
      ) : (
        <>
          {/* Phones: one row per role. */}
          <AppList aria-label="Roles" className="md:hidden">
            {roles.map((r) => (
              <AppListRow
                key={r.id}
                href={`/admin/roles/${r.id}`}
                leading={
                  <IconTile tone={r.isSystem ? "navy" : "lavender"}>
                    <ShieldCheck />
                  </IconTile>
                }
                title={r.name}
                subtitle={r.description || "No description"}
                meta={
                  <>
                    <Badge tone="neutral">
                      <span className="tabular-nums">{r.permissions.length}</span> permissions
                    </Badge>
                    <Badge tone="neutral">
                      <Users className="h-3 w-3" aria-hidden /> <span className="tabular-nums">{r.staffCount}</span> staff
                    </Badge>
                    {r.isSystem && (
                      <Badge tone="navy">
                        <Lock className="h-3 w-3" aria-hidden /> System
                      </Badge>
                    )}
                  </>
                }
              />
            ))}
          </AppList>

          {/* md+: table. */}
          <div className="hidden md:block">
            <TableWrap cards={false}>
              <THead>
                <tr>
                  <TH>Role</TH>
                  <TH>Description</TH>
                  <TH className="text-right">Permissions</TH>
                  <TH className="text-right">Staff</TH>
                  <TH>Type</TH>
                  <TH>Updated</TH>
                </tr>
              </THead>
              <TBody>
                {roles.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/admin/roles/${r.id}`} className="ring-focus flex items-center gap-3 rounded-md">
                        <IconTile size="sm" tone={r.isSystem ? "navy" : "lavender"}>
                          <ShieldCheck />
                        </IconTile>
                        <span className="min-w-0">
                          <span className="block font-semibold text-navy hover:underline">{r.name}</span>
                          <span className="block font-mono text-caption font-normal text-muted">{r.slug}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="max-w-md text-body-sm text-muted">{r.description || "—"}</TD>
                    <TD className="text-right tabular-nums">{r.permissions.length}</TD>
                    <TD className="text-right tabular-nums">
                      <Link href={`/admin/staff?roleId=${r.id}`} className="ring-focus inline-flex min-h-8 items-center rounded-md px-1 hover:underline" aria-label={`${r.staffCount} staff with the ${r.name} role`}>
                        {r.staffCount}
                      </Link>
                    </TD>
                    <TD>{r.isSystem ? <Badge tone="navy">System</Badge> : <Badge tone="neutral">Custom</Badge>}</TD>
                    <TD className="whitespace-nowrap text-muted">{formatDate(r.updatedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}

      <CreateRoleButton disabled={!canCreate} variant="fab" />
    </div>
  );
}
