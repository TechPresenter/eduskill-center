import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, School } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";
import { CENTRE_STEP_OF, centreApplicationCounts, centreApplicationListSchema, listCentreApplications } from "@/server/centre-applications";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, Pagination } from "@/components/ui/table";
import { FilterBar, LocationFilter, SearchInput } from "@/components/admin/shared/filter-bar";
import { TabLinks } from "@/components/admin/shared/tab-links";
import { ExportButton } from "@/components/admin/shared/export-button";
import { filtersOnly, flattenParams, hrefWith, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { CentreStatusBadge, centreStatusLabel } from "@/components/admin/centre-applications/status";
import { SubmittedRangeFilter } from "@/components/admin/centre-applications/submitted-filter";

export const metadata: Metadata = { title: "Centre Applications · Foundation Admin" };

/** Tab strip order – the seven-step process, then the two exits. */
const STATUS_TABS = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "DOCUMENTS_REQUIRED",
  "DOCUMENTS_VERIFIED",
  "CENTRE_VERIFICATION",
  "SELECTED",
  "AGREEMENT_PENDING",
  "AGREEMENT_SIGNED",
  "ORIENTATION",
  "APPROVED",
  "REJECTED",
] as const;

const BASE = "/admin/centre-applications";

export default async function CentreApplicationsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("centre_applications.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(centreApplicationListSchema, sp);
  const [data, counts] = await Promise.all([listCentreApplications(q), centreApplicationCounts()]);

  const total = Object.values(counts).reduce((n, c) => n + (c ?? 0), 0);
  const canExport = hasPermission(user, "centre_applications.export");
  const filtered = Object.keys(sp).some((k) => k !== "page");

  return (
    <div>
      <PageHeader
        title="Centre Applications"
        mobileTitle="Centre applications"
        description={`${formatNumber(data.meta.total)} application${data.meta.total === 1 ? "" : "s"} to open a Normal Education Centre (Class 1–4) in the current view.`}
        actions={<ExportButton href="/api/admin/centre-applications/export" params={filtersOnly(sp)} formats={["csv"]} disabled={!canExport} />}
      />

      <TabLinks
        className="mb-4"
        ariaLabel="Application status"
        active={sp.status ?? ""}
        items={[
          { value: "", label: "All", count: total, href: hrefWith(BASE, sp, { status: undefined, page: undefined }) },
          ...STATUS_TABS.map((s) => ({ value: s, label: centreStatusLabel(s), count: counts[s] ?? 0, href: hrefWith(BASE, sp, { status: s, page: undefined }) })),
        ]}
      />

      <FilterBar>
        <SearchInput placeholder="Application no, name, centre or village" />
        <LocationFilter />
        <SubmittedRangeFilter />
      </FilterBar>

      {total === 0 && !filtered ? (
        <EmptyState
          icon={<School className="h-7 w-7" />}
          title="No centre applications yet"
          description="Applications submitted from the EduSkill Shiksha Mission page appear here for documents verification, centre verification, selection, agreement, orientation and centre start."
        />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Application</TH>
                <TH>Applicant</TH>
                <TH>Proposed centre</TH>
                <TH>Location</TH>
                <TH>Classes</TH>
                <TH className="text-center">Docs</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={9}>No applications match these filters.</EmptyRow>}
              {data.items.map((a) => {
                const step = CENTRE_STEP_OF[a.status];
                const place = [a.villageTown, a.block.name, a.district.name, a.state.name].filter(Boolean).join(", ");
                return (
                  <TR key={a.id}>
                    <TD label="Application" mobile="hidden">
                      <Link href={`${BASE}/${a.id}`} className="font-mono text-xs font-semibold text-navy hover:underline">
                        {a.applicationNo}
                      </Link>
                      {a.center && <span className="mt-0.5 block font-mono text-[11px] text-success">{a.center.code}</span>}
                    </TD>
                    <TD mobile="full">
                      <Link href={`${BASE}/${a.id}`} className="flex items-start gap-3 tap-highlight-none md:hover:text-navy">
                        <Avatar name={a.applicantName} src={a.photoUrl} size={40} />
                        <span className="min-w-0">
                          <span className="mb-0.5 block font-mono text-xs font-semibold text-orange md:hidden">{a.applicationNo}</span>
                          <span className="block truncate font-semibold">{a.applicantName}</span>
                          <span className="block truncate text-xs font-normal text-muted md:hidden">{a.proposedName}</span>
                          <span className="hidden truncate text-xs font-normal text-muted md:block">{a.email}</span>
                          <span className="block text-xs font-normal text-muted tabular-nums">{a.mobile}</span>
                        </span>
                      </Link>
                      <span className="mt-1.5 flex items-start gap-1 text-sm font-normal text-muted md:hidden">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{place}</span>
                      </span>
                    </TD>
                    <TD label="Proposed centre" mobile="hidden" className="md:max-w-56">
                      <span className="block truncate font-medium">{a.proposedName}</span>
                      <span className="block text-xs text-muted">
                        {titleCase(a.spaceType)} · {a.roomCount} room{a.roomCount === 1 ? "" : "s"} · {a.seatingCapacity} seats
                      </span>
                    </TD>
                    <TD label="Location" mobile="hidden">
                      <span className="block text-sm">
                        {a.villageTown}, {a.block.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {a.district.name} · {a.state.name}
                      </span>
                    </TD>
                    <TD label="Classes" className="max-md:text-right">
                      <span className="flex flex-wrap gap-1 max-md:justify-end">
                        {a.classes.map((c) => (
                          <Badge key={c} tone="navy">
                            {titleCase(c)}
                          </Badge>
                        ))}
                        {a.classes.length === 0 && <span className="text-xs text-muted">—</span>}
                      </span>
                    </TD>
                    <TD label="Documents" className="tabular-nums md:text-center">
                      {a._count.documents}
                    </TD>
                    <TD label="Status">
                      <span className="flex flex-wrap items-center gap-1.5 max-md:justify-end">
                        <CentreStatusBadge status={a.status} />
                        {step > 0 && <span className="text-xs font-medium text-muted">Step {step} of 7</span>}
                      </span>
                    </TD>
                    <TD label="Submitted" className="text-muted md:whitespace-nowrap">
                      {formatDate(a.submittedAt)}
                    </TD>
                    <TD mobile="actions" className="text-right">
                      <ButtonLink href={`${BASE}/${a.id}`} variant="outline" size="sm" className="max-md:w-full">
                        Review
                      </ButtonLink>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </TableWrap>
          <Pagination className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref(BASE, sp)} />
        </>
      )}
    </div>
  );
}
