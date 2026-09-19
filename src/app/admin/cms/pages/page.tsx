import Link from "next/link";
import { FileText, Lock, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/utils";
import { cmsPageListSchema, listCmsPages } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { Pager } from "@/components/admin/content/pager";
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

  return (
    <div>
      <PageHeader
        title="Pages"
        mobileTitle="Pages"
        description="Long-form content pages such as About, Scholarship, Privacy Policy and Terms."
        actions={
          canEdit ? (
            <ButtonLink href={`${base}/new`} size="sm" leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
              New page
            </ButtonLink>
          ) : undefined
        }
      />
      {canEdit && <Fab aria-label="New page" icon={<Plus className="h-6 w-6" />} href={`${base}/new`} />}

      <FilterBar
        fields={[
          { type: "search", placeholder: "Title or slug" },
          {
            type: "select",
            name: "status",
            label: "Status",
            options: [
              { value: "PUBLISHED", label: "Published" },
              { value: "DRAFT", label: "Draft" },
            ],
          },
        ]}
      />

      {data.meta.total === 0 && !filtered ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="No pages yet" description="Create content pages to link from the website menu and footer." action={canEdit ? <ButtonLink href={`${base}/new`}>New page</ButtonLink> : undefined} />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Page</TH>
                <TH>Slug</TH>
                <TH>Status</TH>
                <TH>Last updated</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={4}>No pages match these filters.</EmptyRow>}
              {data.items.map((p) => (
                <TR key={p.id}>
                  <TD mobile="full">
                    <Link href={`${base}/${p.id}`} className="block tap-highlight-none md:inline md:font-semibold md:text-ink md:hover:text-navy">
                      {p.title}
                      {p.excerpt && <span className="mt-0.5 block truncate text-xs font-normal text-muted md:max-w-md">{p.excerpt}</span>}
                    </Link>
                  </TD>
                  <TD label="Slug">
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-muted">
                      /{p.slug}
                      {p.isFixed && (
                        <Badge tone="neutral" className="ml-1">
                          <Lock className="h-3 w-3" /> System
                        </Badge>
                      )}
                    </span>
                  </TD>
                  <TD label="Status">
                    <StatusBadge status={p.status} />
                  </TD>
                  <TD label="Last updated" className="text-muted md:whitespace-nowrap">
                    {formatDateTime(p.updatedAt)}
                  </TD>
                  <TD mobile="actions" className="md:hidden">
                    <ButtonLink href={`${base}/${p.id}`} variant="outline" size="sm" className="w-full">
                      Edit page
                    </ButtonLink>
                  </TD>
                </TR>
              ))}
            </TBody>
          </TableWrap>
          <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
        </>
      )}
    </div>
  );
}
