import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { eventListSchema, listEvents } from "@/server/content";
import { PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { Pager } from "@/components/admin/content/pager";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";
import { EVENT_STATUS_OPTIONS } from "./fields";

export const metadata = { title: "Events" };

const isUpcoming = (startAt: Date | string) => new Date(startAt).getTime() >= Date.now();

export default async function EventsListPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("cms.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(eventListSchema, sp);
  const data = await listEvents(q);
  const canEdit = hasPermission(user, "cms.update");
  const base = "/admin/events";
  const filtered = Object.keys(sp).some((k) => k !== "page");

  return (
    <div>
      <PageHeader
        title="Events"
        mobileTitle="Events"
        description={`${formatNumber(data.meta.total)} event${data.meta.total === 1 ? "" : "s"} in the current view.`}
        actions={
          canEdit ? (
            <ButtonLink href={`${base}/new`} size="sm" leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
              New event
            </ButtonLink>
          ) : undefined
        }
      />
      {canEdit && <Fab aria-label="New event" icon={<Plus className="h-6 w-6" />} href={`${base}/new`} />}

      <FilterBar
        fields={[
          { type: "search", placeholder: "Title or location" },
          {
            type: "select",
            name: "when",
            label: "When",
            options: [
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
            ],
          },
          { type: "select", name: "status", label: "Status", options: EVENT_STATUS_OPTIONS },
        ]}
      />

      {data.meta.total === 0 && !filtered ? (
        <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No events yet" description="Announce workshops, camps and community events on the website." action={canEdit ? <ButtonLink href={`${base}/new`}>Create the first event</ButtonLink> : undefined} />
      ) : (
        <>
          <TableWrap>
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
              {data.items.length === 0 && <EmptyRow colSpan={5}>No events match these filters.</EmptyRow>}
              {data.items.map((e) => {
                const upcoming = isUpcoming(e.startAt);
                return (
                  <TR key={e.id}>
                    <TD mobile="full">
                      <Link href={`${base}/${e.id}`} className="block tap-highlight-none md:inline md:font-semibold md:text-ink md:hover:text-navy">
                        {e.title}
                        <span className="block font-mono text-xs font-normal text-muted">/events/{e.slug}</span>
                      </Link>
                    </TD>
                    <TD label="When" className="md:whitespace-nowrap">
                      <span className="block">{formatDateTime(e.startAt)}</span>
                      <span className="text-xs text-muted">{e.endAt ? `until ${formatDateTime(e.endAt)}` : ""}</span>
                      <Badge tone={upcoming ? "info" : "neutral"} className="mt-1">
                        {upcoming ? "Upcoming" : "Past"}
                      </Badge>
                    </TD>
                    <TD label="Where">
                      <span className="block">{e.location ?? "—"}</span>
                      <span className="text-xs text-muted">{[e.district?.name, e.state?.name].filter(Boolean).join(", ")}</span>
                    </TD>
                    <TD label="Status">
                      <StatusBadge status={e.status} />
                    </TD>
                    <TD label="Registration">
                      {e.registrationUrl ? (
                        <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-orange hover:underline md:min-h-0">
                          Open form
                        </a>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </TD>
                    <TD mobile="actions" className="md:hidden">
                      <ButtonLink href={`${base}/${e.id}`} variant="outline" size="sm" className="w-full">
                        Edit event
                      </ButtonLink>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </TableWrap>
          <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
        </>
      )}
    </div>
  );
}
