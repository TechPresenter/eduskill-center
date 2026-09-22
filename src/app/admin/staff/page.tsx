import type { Metadata } from "next";
import Link from "next/link";
import { Plus, SearchX, UserCog } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { listStaff, staffListSchema } from "@/server/staff";
import { listRoles } from "@/server/roles";
import { Avatar } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { Pager } from "@/components/admin/pickers/pager";
import { AppList, AppListRow } from "@/components/admin/content/app-list";

export const metadata: Metadata = { title: "Staff · Foundation Admin" };

const BASE = "/admin/staff";

export default async function StaffPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("users.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(staffListSchema, sp);
  const [data, roles] = await Promise.all([listStaff(q), listRoles()]);
  const canCreate = user.role === "SUPER_ADMIN" && hasPermission(user, "users.create");
  const filtered = Object.keys(sp).some((k) => k !== "page");
  const isEmpty = data.meta.total === 0 && !filtered;

  return (
    <AdminListPage
      header={{
        title: "Foundation Staff",
        mobileTitle: "Staff",
        description: `${formatNumber(data.meta.total)} staff account${data.meta.total === 1 ? "" : "s"}. Each person gets the permissions of their role plus any direct grants.`,
        actions: (
          <>
            <ButtonLink href="/admin/roles" variant="outline" size="sm">
              Roles
            </ButtonLink>
            {canCreate && (
              <ButtonLink href={`${BASE}/new`} size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                Add staff
              </ButtonLink>
            )}
          </>
        ),
      }}
      tabs={
        isEmpty ? undefined : (
          <QueryTabs
            param="status"
            defaultValue=""
            keep={["roleId", "q"]}
            items={[
              { value: "", label: "All" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "SUSPENDED", label: "Suspended" },
            ]}
          />
        )
      }
      filters={
        isEmpty ? undefined : (
          <FilterBar preserve={["status"]}>
            <SearchInput placeholder="Name, email, mobile, employee code or designation" />
            <SelectFilter name="roleId" label="Role" options={roles.map((r) => ({ value: r.id, label: r.name }))} placeholder="All roles" className="min-w-[13rem]" />
          </FilterBar>
        )
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={BASE} params={sp} />}
      fab={canCreate ? { href: `${BASE}/new`, label: "Add staff" } : undefined}
    >
      {isEmpty ? (
        <EmptyState icon={<UserCog className="h-7 w-7" />} title="No staff accounts yet" description="Create logins for Foundation staff and give each one a role. The Super Admin already has every permission." action={canCreate ? <ButtonLink href={`${BASE}/new`}>Add staff</ButtonLink> : undefined} />
      ) : data.items.length === 0 ? (
        <EmptyState size="sm" icon={<SearchX className="h-6 w-6" />} title="No staff match these filters" description="Try another name or role, or clear the filters." action={<ButtonLink href={BASE} variant="outline" size="sm">Clear filters</ButtonLink>} />
      ) : (
        <>
          {/* Phones: an app list — avatar, name, role, status. */}
          <AppList aria-label="Staff" className="md:hidden">
            {data.items.map((s) => (
              <AppListRow
                key={s.id}
                href={`${BASE}/${s.id}`}
                leading={<Avatar name={s.user.name} src={s.user.avatarUrl} size={44} />}
                title={s.user.name}
                subtitle={[s.designation, s.employeeCode].filter(Boolean).join(" · ")}
                meta={
                  <>
                    {s.role ? <Badge tone="navy">{s.role.name}</Badge> : <Badge tone="neutral">No role</Badge>}
                    <StatusBadge status={s.user.status} />
                    {s.permissions.length > 0 && <Badge tone="orange">+{s.permissions.length} direct</Badge>}
                  </>
                }
                trailing={<span className="tabular-nums">{s.user.lastLoginAt ? formatDate(s.user.lastLoginAt, "dd MMM") : "Never"}</span>}
              />
            ))}
          </AppList>

          {/* md+: the table. */}
          <div className="hidden md:block">
            <TableWrap cards={false}>
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
                      <Link href={`${BASE}/${s.id}`} className="ring-focus flex items-center gap-3 rounded-md hover:text-navy">
                        <Avatar name={s.user.name} src={s.user.avatarUrl} size={36} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{s.user.name}</span>
                          <span className="block truncate text-caption text-muted">{s.user.email ?? s.user.mobile}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="font-mono text-caption font-semibold text-navy">{s.employeeCode}</TD>
                    <TD>
                      {s.designation ?? <span className="text-muted">—</span>}
                      {s.department && <span className="block text-caption text-muted">{s.department}</span>}
                    </TD>
                    <TD>
                      {s.role ? (
                        <Link href={`/admin/roles/${s.role.id}`} className="ring-focus rounded-full hover:underline">
                          <Badge tone="navy">{s.role.name}</Badge>
                        </Link>
                      ) : (
                        <span className="text-caption text-muted">No role</span>
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
          </div>
        </>
      )}
    </AdminListPage>
  );
}
