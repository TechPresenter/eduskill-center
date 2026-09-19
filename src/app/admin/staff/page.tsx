import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { listStaff, staffListSchema } from "@/server/staff";
import { listRoles } from "@/server/roles";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, Pagination } from "@/components/ui/table";
import { FilterBar, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";

export const metadata: Metadata = { title: "Staff · Foundation Admin" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("users.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(staffListSchema, sp);
  const [data, roles] = await Promise.all([listStaff(q), listRoles()]);
  const canCreate = user.role === "SUPER_ADMIN" && hasPermission(user, "users.create");
  const filtered = Object.keys(sp).some((k) => k !== "page");

  return (
    <div>
      <PageHeader
        title="Foundation Staff"
        description={`${formatNumber(data.meta.total)} staff account${data.meta.total === 1 ? "" : "s"}. Staff receive permissions from their role plus any direct grants.`}
        actions={
          canCreate ? (
            <ButtonLink href="/admin/staff/new" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              Add staff
            </ButtonLink>
          ) : undefined
        }
      />

      <FilterBar>
        <SearchInput placeholder="Name, email, mobile, employee code or designation" />
        <SelectFilter name="roleId" label="Role" options={roles.map((r) => ({ value: r.id, label: r.name }))} placeholder="All roles" className="min-w-[13rem]" />
        <SelectFilter
          name="status"
          label="Status"
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
            { value: "SUSPENDED", label: "Suspended" },
          ]}
        />
      </FilterBar>

      {data.meta.total === 0 && !filtered ? (
        <EmptyState icon={<UserCog className="h-7 w-7" />} title="No staff accounts yet" description="Create accounts for Foundation staff and assign them a role." action={canCreate ? <ButtonLink href="/admin/staff/new">Add staff</ButtonLink> : undefined} />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Staff member</TH>
                <TH>Employee code</TH>
                <TH>Designation</TH>
                <TH>Role</TH>
                <TH className="text-right">Direct permissions</TH>
                <TH>Status</TH>
                <TH>Last login</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={7}>No staff match these filters.</EmptyRow>}
              {data.items.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/admin/staff/${s.id}`} className="flex items-center gap-3 hover:text-navy">
                      <Avatar name={s.user.name} src={s.user.avatarUrl} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{s.user.name}</span>
                        <span className="block truncate text-xs text-muted">{s.user.email ?? s.user.mobile}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD className="font-mono text-xs font-semibold text-navy">{s.employeeCode}</TD>
                  <TD>
                    {s.designation ?? <span className="text-muted">—</span>}
                    {s.department && <span className="block text-xs text-muted">{s.department}</span>}
                  </TD>
                  <TD>
                    {s.role ? (
                      <Link href={`/admin/roles/${s.role.id}`} className="hover:underline">
                        <Badge tone="navy">{s.role.name}</Badge>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">No role</span>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums">{s.permissions.length}</TD>
                  <TD>
                    <StatusBadge status={s.user.status} />
                  </TD>
                  <TD className="whitespace-nowrap text-muted">{s.user.lastLoginAt ? formatDateTime(s.user.lastLoginAt) : "Never"}</TD>
                </TR>
              ))}
            </TBody>
          </TableWrap>
          <Pagination className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref("/admin/staff", sp)} />
        </>
      )}
    </div>
  );
}
