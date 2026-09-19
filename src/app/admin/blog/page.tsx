import Link from "next/link";
import { Newspaper, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { blogListSchema, listBlogs } from "@/server/content";
import { PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { Pager } from "@/components/admin/content/pager";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";
import { BLOG_STATUS_OPTIONS } from "./fields";

export const metadata = { title: "Blog" };

export default async function BlogListPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("cms.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(blogListSchema, sp);
  const [data, tagRows] = await Promise.all([listBlogs(q), db.blog.findMany({ select: { tags: true }, take: 1000 })]);
  const tags = [...new Set(tagRows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b));
  const canEdit = hasPermission(user, "cms.update");
  const base = "/admin/blog";
  const filtered = Object.keys(sp).some((k) => k !== "page");

  return (
    <div>
      <PageHeader
        title="Blog"
        mobileTitle="Blog"
        description={`${formatNumber(data.meta.total)} post${data.meta.total === 1 ? "" : "s"} in the current view.`}
        actions={
          canEdit ? (
            <ButtonLink href={`${base}/new`} size="sm" leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
              New post
            </ButtonLink>
          ) : undefined
        }
      />
      {canEdit && <Fab aria-label="New post" icon={<Plus className="h-6 w-6" />} href={`${base}/new`} />}

      <FilterBar
        fields={[
          { type: "search", placeholder: "Title, slug or author" },
          { type: "select", name: "status", label: "Status", options: BLOG_STATUS_OPTIONS },
          { type: "select", name: "tag", label: "Tag", options: tags.map((t) => ({ value: t, label: t })), placeholder: tags.length ? "All tags" : "No tags yet" },
        ]}
      />

      {data.meta.total === 0 && !filtered ? (
        <EmptyState icon={<Newspaper className="h-7 w-7" />} title="No blog posts yet" description="Share news, stories and updates from the Foundation." action={canEdit ? <ButtonLink href={`${base}/new`}>Write the first post</ButtonLink> : undefined} />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Post</TH>
                <TH>Author</TH>
                <TH>Tags</TH>
                <TH>Status</TH>
                <TH>Published</TH>
                <TH>Updated</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={6}>No posts match these filters.</EmptyRow>}
              {data.items.map((b) => (
                <TR key={b.id}>
                  <TD mobile="full">
                    <Link href={`${base}/${b.id}`} className="flex items-center gap-3 tap-highlight-none md:hover:text-navy">
                      {b.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.coverImage} alt="" className="h-10 w-14 shrink-0 rounded-lg bg-surface object-cover" />
                      ) : (
                        <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-lavender text-navy">
                          <Newspaper className="h-4 w-4" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{b.title}</span>
                        <span className="block truncate font-mono text-xs font-normal text-muted">/blog/{b.slug}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD label="Author">{b.authorName ?? <span className="text-xs text-muted">—</span>}</TD>
                  <TD label="Tags" className="md:max-w-[14rem]">
                    <span className="flex flex-wrap gap-1 max-md:justify-end">
                      {b.tags.slice(0, 3).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                      {b.tags.length > 3 && <span className="text-xs text-muted">+{b.tags.length - 3}</span>}
                    </span>
                  </TD>
                  <TD label="Status">
                    <StatusBadge status={b.status} />
                  </TD>
                  <TD label="Published" className="text-muted md:whitespace-nowrap">
                    {b.publishedAt ? formatDate(b.publishedAt) : "—"}
                  </TD>
                  <TD label="Updated" className="text-muted md:whitespace-nowrap">
                    {formatDateTime(b.updatedAt)}
                  </TD>
                  <TD mobile="actions" className="md:hidden">
                    <ButtonLink href={`${base}/${b.id}`} variant="outline" size="sm" className="w-full">
                      Edit post
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
