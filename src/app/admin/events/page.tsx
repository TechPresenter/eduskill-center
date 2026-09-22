import Link from "next/link";
import { CalendarDays, SearchX } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { eventListSchema, listEvents } from "@/server/content";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { Pager } from "@/components/admin/pickers/pager";
import { AppList, AppListRow } from "@/components/admin/content/app-list";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";
import { EVENT_STATUS_OPTIONS } from "./fields";

export const metadata = { title: "Events" };

const isUpcoming = (startAt: Date | string) => new Date(startAt).getTime() >= Date.now();

/** Calendar-leaf date tile: month over day, the way a phone calendar shows an event. */
function DateTile({ date, upcoming }: { date: Date | string; upcoming: boolean }) {
  return (
    <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md ${upcoming ? "bg-orange-light text-orange" : "bg-surface text-muted"}`} aria-hidden>
      <span className="text-caption leading-none font-bold uppercase">{formatDate(date, "MMM")}</span>
      <span className="text-h4 leading-tight tabular-nums">{formatDate(date, "dd")}</span>
    </span>
  );
}

export default async function EventsListPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("cms.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(eventListSchema, sp);
  const data = await listEvents(q);
  const canEdit = hasPermission(user, "cms.update");
  const base = "/admin/events";
  const filtered = Object.keys(sp).some((k) => k !== "page");
  const isEmpty = data.meta.total === 0 && !filtered;

  return (
    <AdminListPage
      header={{
        title: "Events",
        mobileTitle: "Events",
        description: `${formatNumber(data.meta.total)} event${data.meta.total === 1 ? "" : "s"} in the current view.`,
        actions: canEdit ? (
          <ButtonLink href={`${base}/new`} size="sm" className="hidden lg:inline-flex">
            New event
          </ButtonLink>
        ) : undefined,
      }}
      // "When" has three options, so it is a tab strip rather than a select.
      tabs={
        isEmpty ? undefined : (
          <QueryTabs
            param="when"
            defaultValue=""
            keep={["status", "q"]}
            items={[
              { value: "", label: "All" },
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
            ]}
          />
        )
      }
      filters={
        isEmpty ? undefined : (
          <FilterBar
            preserve={["when"]}
            fields={[
              { type: "search", placeholder: "Title or location" },
              { type: "select", name: "status", label: "Status", options: EVENT_STATUS_OPTIONS },
            ]}
          />
        )
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
      fab={canEdit ? { href: `${base}/new`, label: "New event" } : undefined}
    >
      {isEmpty ? (
        <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No events yet" description="Announce workshops, camps and community events on the website." action={canEdit ? <ButtonLink href={`${base}/new`}>Create the first event</ButtonLink> : undefined} />
      ) : data.items.length === 0 ? (
        <EmptyState size="sm" icon={<SearchX className="h-6 w-6" />} title="No events match" description="Try another word or status, or switch between upcoming and past." action={<ButtonLink href={base} variant="outline" size="sm">Clear filters</ButtonLink>} />
      ) : (
        <>
          <AppList aria-label="Events" className="md:hidden">
            {data.items.map((e) => {
              const upcoming = isUpcoming(e.startAt);
              return (
                <AppListRow
                  key={e.id}
                  href={`${base}/${e.id}`}
                  leading={<DateTile date={e.startAt} upcoming={upcoming} />}
                  title={e.title}
                  subtitle={[formatDate(e.startAt, "hh:mm a"), e.location, e.district?.name].filter(Boolean).join(" · ")}
                  clamp={1}
                  meta={
                    <>
                      <StatusBadge status={e.status} />
                      {upcoming ? <Badge tone="info">Upcoming</Badge> : <Badge tone="neutral">Past</Badge>}
                    </>
                  }
                />
              );
            })}
          </AppList>

          <div className="hidden md:block">
            <TableWrap cards={false}>
              <THead>
                <tr>
                  <TH>Event</TH>
                  <TH>When</TH>
                  <TH>Where</TH>
                  <TH>Status</TH>
                  <TH>Registration</TH>
                </tr>
              </THead>
              <TBody>
                {data.items.map((e) => {
                  const upcoming = isUpcoming(e.startAt);
                  return (
                    <TR key={e.id}>
                      <TD>
                        <Link href={`${base}/${e.id}`} className="ring-focus flex items-center gap-3 rounded-md hover:text-navy">
                          <DateTile date={e.startAt} upcoming={upcoming} />
                          <span className="min-w-0">
                            <span className="block font-semibold">{e.title}</span>
                            <span className="block font-mono text-caption font-normal text-muted">/events/{e.slug}</span>
                          </span>
                        </Link>
                      </TD>
                      <TD className="whitespace-nowrap tabular-nums">
                        <span className="block">{formatDateTime(e.startAt)}</span>
                        <span className="text-caption text-muted">{e.endAt ? `until ${formatDateTime(e.endAt)}` : ""}</span>
                        <Badge tone={upcoming ? "info" : "neutral"} className="mt-1">
                          {upcoming ? "Upcoming" : "Past"}
                        </Badge>
                      </TD>
                      <TD>
                        <span className="block">{e.location ?? "—"}</span>
                        <span className="text-caption text-muted">{[e.district?.name, e.state?.name].filter(Boolean).join(", ")}</span>
                      </TD>
                      <TD>
                        <StatusBadge status={e.status} />
                      </TD>
                      <TD>
                        {e.registrationUrl ? (
                          <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer" className="ring-focus inline-flex items-center rounded-md text-body-sm font-semibold text-orange hover:underline">
                            Open form
                          </a>
                        ) : (
                          <span className="text-caption text-muted">—</span>
                        )}
                      </TD>
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
