import Link from "next/link";
import { FileText, Lock, SearchX } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cmsPageListSchema, listCmsPages } from "@/server/cms-admin";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { Pager } from "@/components/admin/pickers/pager";
import { AppList, AppListRow, IconTile } from "@/components/admin/content/app-list";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Pages" };

export default async function CmsPagesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("cms.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(cmsPageListSchema, sp);
  const data = await listCmsPages(q);
  const canEdit = hasPermission(user, "cms.update");
  const base = "/admin/cms/pages";
  const filtered = Object.keys(sp).some((k) => k !== "page");
  const isEmpty = data.meta.total === 0 && !filtered;

  return (
    <AdminListPage
      header={{
        title: "Pages",
        mobileTitle: "Pages",
        backHref: "/admin/cms",
        description: "Long-form content pages such as About, Scholarship, Privacy Policy and Terms.",
        actions: canEdit ? (
          <ButtonLink href={`${base}/new`} size="sm" className="hidden lg:inline-flex">
            New page
          </ButtonLink>
        ) : undefined,
      }}
      // Two statuses → a tab strip instead of a select.
      tabs={
        isEmpty ? undefined : (
          <QueryTabs
            param="status"
            defaultValue=""
            keep={["q"]}
            items={[
              { value: "", label: "All" },
              { value: "PUBLISHED", label: "Published" },
              { value: "DRAFT", label: "Draft" },
            ]}
          />
        )
      }
      filters={isEmpty ? undefined : <FilterBar preserve={["status"]} fields={[{ type: "search", placeholder: "Title or slug" }]} />}
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
      fab={canEdit ? { href: `${base}/new`, label: "New page" } : undefined}
    >
      {isEmpty ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="No pages yet" description="Create content pages to link from the website menu and footer." action={canEdit ? <ButtonLink href={`${base}/new`}>New page</ButtonLink> : undefined} />
      ) : data.items.length === 0 ? (
        <EmptyState size="sm" icon={<SearchX className="h-6 w-6" />} title="No pages match" description="Try another word or status." action={<ButtonLink href={base} variant="outline" size="sm">Clear filters</ButtonLink>} />
      ) : (
        <>
          <AppList aria-label="Pages" className="md:hidden">
            {data.items.map((p) => (
              <AppListRow
                key={p.id}
                href={`${base}/${p.id}`}
                leading={<IconTile tone={p.status === "PUBLISHED" ? "lavender" : "neutral"}>{p.isFixed ? <Lock /> : <FileText />}</IconTile>}
                title={p.title}
                subtitle={`/${p.slug}`}
                clamp={1}
                meta={
                  <>
                    <StatusBadge status={p.status} />
                    {p.isFixed && <Badge tone="neutral">System</Badge>}
                  </>
                }
                trailing={<span className="tabular-nums">{formatDate(p.updatedAt, "dd MMM")}</span>}
              />
            ))}
          </AppList>

          <div className="hidden md:block">
            <TableWrap cards={false}>
              <THead>
                <tr>
                  <TH>Page</TH>
                  <TH>Slug</TH>
                  <TH>Status</TH>
                  <TH>Last updated</TH>
                </tr>
              </THead>
              <TBody>
                {data.items.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link href={`${base}/${p.id}`} className="ring-focus flex items-center gap-3 rounded-md hover:text-navy">
                        <IconTile size="sm" tone={p.status === "PUBLISHED" ? "lavender" : "neutral"}>
                          {p.isFixed ? <Lock /> : <FileText />}
                        </IconTile>
                        <span className="min-w-0">
                          <span className="block font-semibold">{p.title}</span>
                          {p.excerpt && <span className="block max-w-md truncate text-caption font-normal text-muted">{p.excerpt}</span>}
                        </span>
                      </Link>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1 font-mono text-caption text-muted">
                        /{p.slug}
                        {p.isFixed && (
                          <Badge tone="neutral" className="ml-1">
                            <Lock className="h-3 w-3" aria-hidden /> System
                          </Badge>
                        )}
                      </span>
                    </TD>
                    <TD>
                      <StatusBadge status={p.status} />
                    </TD>
                    <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(p.updatedAt)}</TD>
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
