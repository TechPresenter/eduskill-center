import Link from "next/link";
import { FolderTree, Newspaper, Plus, SearchX, Settings2, Star, Tags, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { displayStatus, scheduledIn } from "@/lib/blog/visibility";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { blogListSchema, listBlogAuthors, listBlogCategories, listBlogTags, listBlogs } from "@/server/blog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, StatusBadge, type BadgeTone } from "@/components/ui/badge";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { Media } from "@/components/site/safe-image";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { Pager } from "@/components/admin/pickers/pager";
import { AppList, AppListRow, IconTile } from "@/components/admin/content/app-list";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";
import { BLOG_STATUS_OPTIONS } from "./fields";

export const metadata = { title: "Blog" };

const BASE = "/admin/blog";

/** The seven `BadgeTone` names a category may carry; anything else (or nothing) reads as neutral. */
const TONES = new Set<BadgeTone>(["neutral", "navy", "orange", "success", "warning", "danger", "info"]);
function toneOf(colorTone: string | null | undefined): BadgeTone {
  return colorTone && TONES.has(colorTone as BadgeTone) ? (colorTone as BadgeTone) : "neutral";
}

/**
 * Cover thumbnail, or a tinted tile when the post has no image yet.
 *
 * A real cover goes through `<Media>` → `SafeImage` → `next/image`, exactly like the public card,
 * so the admin sees the same crop (and the same optimised file) a reader will get. The stored path
 * is already app-absolute — `SafeImage` applies the deployment sub-path itself, so re-wrapping it
 * in `withBasePath()` here would double it under a `/center` deployment.
 *
 * The empty case deliberately keeps the flat `IconTile` rather than the public `MediaPlaceholder`:
 * on a dense list the branded pattern reads as artwork the editor chose, and "this post still has
 * no cover" is the one thing the column is here to say.
 */
function Cover({ src, slug, size }: { src: string | null; slug: string; size: "sm" | "md" }) {
  const width = size === "md" ? "w-20" : "w-16";
  if (!src) {
    return (
      <IconTile className={`${width} ${size === "md" ? "h-11" : "h-9"} shrink-0`}>
        <Newspaper />
      </IconTile>
    );
  }
  return <Media src={src} alt="" seed={slug} ratio="16x9" sizes={size === "md" ? "80px" : "64px"} className={`${width} shrink-0 rounded-md`} />;
}

export default async function BlogListPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("cms.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(blogListSchema, sp);
  // `listBlogTags()` reads the `blog_tags` lookup table, which replaces the old
  // `db.blog.findMany({ select: { tags: true }, take: 1000 })` scan — that pulled every post's
  // array into memory on every page load just to build one <select>, and silently went blind
  // past the 1000th post.
  const [data, categories, authors, tags] = await Promise.all([listBlogs(q), listBlogCategories(), listBlogAuthors(), listBlogTags()]);
  // Blog writes all sit on `cms.update`; there is no `cms.create` or `cms.delete` in the catalog.
  const canEdit = hasPermission(user, "cms.update");
  const filtered = Object.keys(sp).some((k) => k !== "page");
  const isEmpty = data.meta.total === 0 && !filtered;

  return (
    <AdminListPage
      header={{
        title: "Blog",
        mobileTitle: "Blog",
        description: `${formatNumber(data.meta.total)} post${data.meta.total === 1 ? "" : "s"} in the current view.`,
        actions: (
          <>
            {/* The three taxonomy screens are siblings of this list, not sub-pages of a post. They
                get their own buttons where there is room and collapse into one menu below lg, so
                the primary action ("New post") is never pushed off the row on a small laptop. */}
            <div className="hidden items-center gap-2 lg:flex">
              <ButtonLink href={`${BASE}/categories`} variant="outline" size="sm">
                Categories
              </ButtonLink>
              <ButtonLink href={`${BASE}/authors`} variant="outline" size="sm">
                Authors
              </ButtonLink>
              <ButtonLink href={`${BASE}/tags`} variant="outline" size="sm">
                Tags
              </ButtonLink>
            </div>
            <Dropdown
              className="lg:hidden"
              mobileTitle="Manage"
              trigger={
                <Button variant="outline" size="sm" leftIcon={<Settings2 className="h-4 w-4" aria-hidden />}>
                  Manage
                </Button>
              }
            >
              <DropdownItem href={`${BASE}/categories`} icon={<FolderTree className="h-4 w-4" aria-hidden />}>
                Categories
              </DropdownItem>
              <DropdownItem href={`${BASE}/authors`} icon={<Users className="h-4 w-4" aria-hidden />}>
                Authors
              </DropdownItem>
              <DropdownItem href={`${BASE}/tags`} icon={<Tags className="h-4 w-4" aria-hidden />}>
                Tags
              </DropdownItem>
            </Dropdown>
            {canEdit && (
              <ButtonLink href={`${BASE}/new`} size="sm" className="hidden lg:inline-flex" leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
                New post
              </ButtonLink>
            )}
          </>
        ),
      }}
      filters={
        isEmpty ? undefined : (
          <FilterBar
            fields={[
              { type: "search", placeholder: "Title, slug, author or category" },
              { type: "select", name: "status", label: "Status", options: BLOG_STATUS_OPTIONS },
              { type: "select", name: "categoryId", label: "Category", options: categories.map((c) => ({ value: c.id, label: c.name })), placeholder: categories.length ? "All categories" : "No categories yet" },
              { type: "select", name: "authorId", label: "Author", options: authors.map((a) => ({ value: a.id, label: a.name })), placeholder: authors.length ? "All authors" : "No authors yet" },
              // The tag filter matches on the LABEL, because that is what `Blog.tags` stores;
              // `BlogTag.slug` only ever addresses the public archive.
              { type: "select", name: "tag", label: "Tag", options: tags.map((t) => ({ value: t.name, label: t.name })), placeholder: tags.length ? "All tags" : "No tags yet" },
            ]}
          />
        )
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={BASE} params={sp} />}
      fab={canEdit && !isEmpty ? { href: `${BASE}/new`, label: "New post" } : undefined}
    >
      {isEmpty ? (
        <EmptyState icon={<Newspaper className="h-7 w-7" />} title="No blog posts yet" description="Share news, stories and updates from the Foundation. Posts start as drafts until you publish them." action={canEdit ? <ButtonLink href={`${BASE}/new`}>Write the first post</ButtonLink> : undefined} />
      ) : data.items.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<SearchX className="h-6 w-6" />}
          title="No posts match"
          description="Try another word, status, category, author or tag."
          action={
            <ButtonLink href={BASE} variant="outline" size="sm">
              Clear filters
            </ButtonLink>
          }
        />
      ) : (
        <>
          <AppList aria-label="Blog posts" className="md:hidden">
            {data.items.map((b) => (
              <AppListRow
                key={b.id}
                href={`${BASE}/${b.id}`}
                leading={<Cover src={b.coverImage} slug={b.slug} size="md" />}
                title={b.title}
                subtitle={[b.author?.name ?? b.authorName, b.publishedAt ? formatDate(b.publishedAt) : "No date set"].filter(Boolean).join(" · ")}
                clamp={1}
                meta={
                  <>
                    {/* Never `b.status`: a PUBLISHED post dated next Tuesday is "Scheduled", and the
                        badge is the only place an editor finds that out at a glance. */}
                    <StatusBadge status={displayStatus(b)} />
                    {b.category && (
                      <Badge tone={toneOf(b.category.colorTone)} className="max-w-32 overflow-hidden">
                        {b.category.name}
                      </Badge>
                    )}
                    {b.isFeatured && (
                      <Badge tone="orange">
                        <Star className="h-3 w-3" aria-hidden /> Featured
                      </Badge>
                    )}
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
                  <TH>Category</TH>
                  <TH>Tags</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Read</TH>
                  <TH>Published</TH>
                  <TH>Updated</TH>
                </tr>
              </THead>
              <TBody>
                {data.items.map((b) => {
                  const countdown = scheduledIn(b);
                  return (
                    <TR key={b.id}>
                      <TD>
                        <Link href={`${BASE}/${b.id}`} className="ring-focus flex items-center gap-3 rounded-md hover:text-navy">
                          <Cover src={b.coverImage} slug={b.slug} size="sm" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-semibold">{b.title}</span>
                              {b.isFeatured && (
                                <>
                                  <Star className="h-3.5 w-3.5 shrink-0 fill-orange text-orange" aria-hidden />
                                  <span className="sr-only">Featured</span>
                                </>
                              )}
                            </span>
                            <span className="block truncate font-mono text-caption font-normal text-muted">/blog/{b.slug}</span>
                          </span>
                        </Link>
                      </TD>
                      <TD>{b.author?.name ?? b.authorName ?? <span className="text-caption text-muted">—</span>}</TD>
                      <TD>{b.category ? <Badge tone={toneOf(b.category.colorTone)}>{b.category.name}</Badge> : <span className="text-caption text-muted">—</span>}</TD>
                      <TD className="max-w-[14rem]">
                        <span className="flex flex-wrap gap-1">
                          {b.tags.slice(0, 3).map((t) => (
                            <Badge key={t}>{t}</Badge>
                          ))}
                          {b.tags.length > 3 && <span className="text-caption text-muted">+{b.tags.length - 3}</span>}
                        </span>
                      </TD>
                      <TD>
                        <span className="flex flex-col items-start gap-1">
                          <StatusBadge status={displayStatus(b)} />
                          {/* Only for an embargoed post, and only the countdown: the exact date is
                              already in the Published column, so repeating it here would be noise. */}
                          {countdown && <span className="text-caption text-muted">{countdown}</span>}
                        </span>
                      </TD>
                      <TD className="text-right whitespace-nowrap text-muted tabular-nums">
                        {b.readingMinutes} min<span className="sr-only"> read</span>
                      </TD>
                      <TD className="whitespace-nowrap text-muted tabular-nums">{b.publishedAt ? formatDateTime(b.publishedAt) : "—"}</TD>
                      <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(b.updatedAt)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}
    </AdminListPage>
  );
}
