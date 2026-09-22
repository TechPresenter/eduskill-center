import Link from "next/link";
import { Newspaper, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { withBasePath } from "@/lib/base-path";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { blogListSchema, listBlogs } from "@/server/content";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { Pager } from "@/components/admin/pickers/pager";
import { AppList, AppListRow, IconTile } from "@/components/admin/content/app-list";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";
import { BLOG_STATUS_OPTIONS } from "./fields";

export const metadata = { title: "Blog" };

/** Cover thumbnail, or a tinted tile when the post has no image yet. */
function Cover({ src, size }: { src: string | null; size: "sm" | "md" }) {
  const dims = size === "md" ? "h-12 w-16" : "h-10 w-14";
  if (!src) {
    return (
      <IconTile className={dims}>
        <Newspaper />
      </IconTile>
    );
  }
  return (
    <span className={`media shrink-0 rounded-md ${dims}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={withBasePath(src)} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

export default async function BlogListPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("cms.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(blogListSchema, sp);
  const [data, tagRows] = await Promise.all([listBlogs(q), db.blog.findMany({ select: { tags: true }, take: 1000 })]);
  const tags = [...new Set(tagRows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b));
  const canEdit = hasPermission(user, "cms.update");
  const base = "/admin/blog";
  const filtered = Object.keys(sp).some((k) => k !== "page");
  const isEmpty = data.meta.total === 0 && !filtered;

  return (
    <AdminListPage
      header={{
        title: "Blog",
        mobileTitle: "Blog",
        description: `${formatNumber(data.meta.total)} post${data.meta.total === 1 ? "" : "s"} in the current view.`,
        actions: canEdit ? (
          <ButtonLink href={`${base}/new`} size="sm" className="hidden lg:inline-flex">
            New post
          </ButtonLink>
        ) : undefined,
      }}
      filters={
        isEmpty ? undefined : (
          <FilterBar
            fields={[
              { type: "search", placeholder: "Title, slug or author" },
              { type: "select", name: "status", label: "Status", options: BLOG_STATUS_OPTIONS },
              { type: "select", name: "tag", label: "Tag", options: tags.map((t) => ({ value: t, label: t })), placeholder: tags.length ? "All tags" : "No tags yet" },
            ]}
          />
        )
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
      fab={canEdit ? { href: `${base}/new`, label: "New post" } : undefined}
    >
      {isEmpty ? (
        <EmptyState icon={<Newspaper className="h-7 w-7" />} title="No blog posts yet" description="Share news, stories and updates from the Foundation. Posts start as drafts until you publish them." action={canEdit ? <ButtonLink href={`${base}/new`}>Write the first post</ButtonLink> : undefined} />
      ) : data.items.length === 0 ? (
        <EmptyState size="sm" icon={<SearchX className="h-6 w-6" />} title="No posts match" description="Try another word, status or tag." action={<ButtonLink href={base} variant="outline" size="sm">Clear filters</ButtonLink>} />
      ) : (
        <>
          <AppList aria-label="Blog posts" className="md:hidden">
            {data.items.map((b) => (
              <AppListRow
                key={b.id}
                href={`${base}/${b.id}`}
                leading={<Cover src={b.coverImage} size="md" />}
                title={b.title}
                subtitle={[b.authorName, b.publishedAt ? formatDate(b.publishedAt) : "Not published"].filter(Boolean).join(" · ")}
                clamp={1}
                meta={
                  <>
                    <StatusBadge status={b.status} />
                    {b.tags.slice(0, 2).map((t) => (
                      <Badge key={t} className="max-w-32 overflow-hidden">
                        {t}
                      </Badge>
                    ))}
                    {b.tags.length > 2 && <span className="text-caption text-muted">+{b.tags.length - 2}</span>}
                  </>
                }
              />
            ))}
          </AppList>

          <div className="hidden md:block">
            <TableWrap cards={false}>
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
                {data.items.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <Link href={`${base}/${b.id}`} className="ring-focus flex items-center gap-3 rounded-md hover:text-navy">
                        <Cover src={b.coverImage} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{b.title}</span>
                          <span className="block truncate font-mono text-caption font-normal text-muted">/blog/{b.slug}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD>{b.authorName ?? <span className="text-caption text-muted">—</span>}</TD>
                    <TD className="max-w-[14rem]">
                      <span className="flex flex-wrap gap-1">
                        {b.tags.slice(0, 3).map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                        {b.tags.length > 3 && <span className="text-caption text-muted">+{b.tags.length - 3}</span>}
                      </span>
                    </TD>
                    <TD>
                      <StatusBadge status={b.status} />
                    </TD>
                    <TD className="whitespace-nowrap text-muted tabular-nums">{b.publishedAt ? formatDate(b.publishedAt) : "—"}</TD>
                    <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(b.updatedAt)}</TD>
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
