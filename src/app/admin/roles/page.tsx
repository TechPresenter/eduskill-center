import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber } from "@/lib/utils";
import { listRoles } from "@/server/roles";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { CreateRoleButton } from "@/components/admin/roles/role-editor";

export const metadata: Metadata = { title: "Roles · Foundation Admin" };

export default async function RolesPage() {
  const user = await requireAdmin("roles.view");
  const roles = await listRoles();
  const canCreate = user.role === "SUPER_ADMIN" && hasPermission(user, "roles.create");
  return (
    <div>
      <PageHeader
        title="Roles"
        mobileTitle="Roles"
        description={`${formatNumber(roles.length)} role${roles.length === 1 ? "" : "s"}. The Super Admin holds every permission implicitly; staff get permissions from a role plus direct grants.`}
        actions={
          <>
            <ButtonLink href="/admin/permissions" variant="outline" size="sm">
              Permission catalog
            </ButtonLink>
            <CreateRoleButton disabled={!canCreate} />
          </>
        }
      />
      <TableWrap>
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
          {roles.length === 0 && <EmptyRow colSpan={6}>No roles yet.</EmptyRow>}
          {roles.map((r) => (
            <TR key={r.id}>
              <TD mobile="full">
                <Link href={`/admin/roles/${r.id}`} className="block tap-highlight-none md:inline">
                  <span className="font-semibold text-navy md:hover:underline">{r.name}</span>
                  <span className="block font-mono text-xs font-normal text-muted">{r.slug}</span>
                </Link>
              </TD>
              <TD label="Description" className="max-w-md text-sm text-muted max-md:text-left">
                {r.description || "—"}
              </TD>
              <TD label="Permissions" className="text-right tabular-nums">
                {r.permissions.length}
              </TD>
              <TD label="Staff" className="text-right tabular-nums">
                <Link href={`/admin/staff?roleId=${r.id}`} className="inline-flex min-h-8 items-center hover:underline">
                  {r.staffCount}
                </Link>
              </TD>
              <TD label="Type">{r.isSystem ? <Badge tone="navy">System</Badge> : <Badge tone="neutral">Custom</Badge>}</TD>
              <TD label="Updated" className="text-muted md:whitespace-nowrap">
                {formatDate(r.updatedAt)}
              </TD>
              <TD mobile="actions" className="md:hidden">
                <ButtonLink href={`/admin/roles/${r.id}`} variant="outline" size="sm" className="w-full">
                  Open role
                </ButtonLink>
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
    </div>
  );
}
