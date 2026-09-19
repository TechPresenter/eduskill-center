import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatINR, formatNumber, titleCase } from "@/lib/utils";
import { describeFilters, reportDef, reportFilterSchema, runReport, type ReportColumn } from "@/server/reports";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { ExportButton } from "@/components/admin/shared/export-button";
import { DateRangeFilter, FilterBar, LocationFilter, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { filtersOnly, flattenParams, type SearchParamsRecord } from "@/components/admin/shared/url";
import { REPORT_STATUS_OPTIONS, reportFilterOptions } from "@/app/admin/reports/queries";

export const metadata: Metadata = { title: "Report · Foundation Admin" };

const PREVIEW_ROWS = 100;

function cell(col: ReportColumn, v: string | number | null) {
  if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
  if (typeof v === "number") {
    if (col.type === "money") return formatINR(v, { decimals: true });
    if (col.type === "percent") return `${v}%`;
    return formatNumber(v);
  }
  return v;
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("reports.view");
  const { type } = await params;
  const def = reportDef(type);
  if (!def) notFound();
  const sp = flattenParams(await searchParams);
  const parsed = reportFilterSchema.safeParse(sp);
  const filters = parsed.success ? parsed.data : reportFilterSchema.parse({});
  const filterKeys = def.filters as readonly string[];
  const [result, options, filtersLabel] = await Promise.all([runReport(def.key, filters, { limit: PREVIEW_ROWS }), reportFilterOptions(filterKeys, { centerId: filters.centerId, courseId: filters.courseId, stateId: filters.stateId }), describeFilters(filters)]);
  const canExport = hasPermission(user, "reports.export");
  const statusOptions = REPORT_STATUS_OPTIONS[def.key] ?? [];
  const exportParams = filtersOnly(sp);

  return (
    <div className="space-y-4">
      <PageHeader
        title={def.label}
        mobileTitle={def.label}
        backHref="/admin/reports"
        description={def.description}
        breadcrumbs={[{ label: "Reports", href: "/admin/reports" }, { label: def.label }]}
        actions={<ExportButton href={`/api/admin/reports/${def.key}`} params={exportParams} disabled={!canExport} label={canExport ? "Export" : "Export (no permission)"} />}
      />

      {!parsed.success && <Alert tone="warning">Some filters in the URL were invalid and have been ignored.</Alert>}

      {(
        <FilterBar>
          <SearchInput placeholder="Search within the report" />
          {filterKeys.includes("location") && <LocationFilter />}
          {filterKeys.includes("state") && !filterKeys.includes("district") && <SelectFilter name="stateId" label="State" options={options.states.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))} placeholder="All states" className="min-w-[14rem]" />}
          {filterKeys.includes("district") && <LocationFilter depth="district" />}
          {filterKeys.includes("center") && <SelectFilter name="centerId" label="Center" options={options.centers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} placeholder="All centers" className="min-w-[14rem]" />}
          {filterKeys.includes("course") && <SelectFilter name="courseId" label="Course" options={options.courses.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} placeholder="All courses" className="min-w-[13rem]" />}
          {filterKeys.includes("batch") && <SelectFilter name="batchId" label="Batch" options={options.batches.map((b) => ({ value: b.id, label: `${b.code} · ${b.name} · ${titleCase(b.status)}` }))} placeholder="All batches" className="min-w-[14rem]" />}
          {filterKeys.includes("status") && statusOptions.length > 0 && <SelectFilter name="status" label="Status" options={statusOptions} />}
          {filterKeys.includes("date") && <DateRangeFilter />}
        </FilterBar>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted">
        <span>
          {formatNumber(result.total)} row{result.total === 1 ? "" : "s"}
          {result.truncated ? ` · previewing the first ${formatNumber(result.rows.length)} – export to get every row` : ""}
          {filtersLabel ? ` · ${filtersLabel}` : ""}
        </span>
        <span>Generated {formatDateTime(result.generatedAt)}</span>
      </div>

      <TableWrap>
        <THead>
          <tr>
            {result.columns.map((c) => (
              <TH key={c.key} className={c.align === "right" || c.type === "number" || c.type === "money" || c.type === "percent" ? "text-right" : undefined}>
                {c.label}
              </TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {result.rows.length === 0 && <EmptyRow colSpan={Math.max(1, result.columns.length)}>No records match these filters.</EmptyRow>}
          {result.rows.map((row, i) => (
            <TR key={i}>
              {result.columns.map((c, ci) => (
                <TD
                  key={c.key}
                  mobile={ci === 0 ? "full" : undefined}
                  className={`${c.align === "right" || c.type === "number" || c.type === "money" || c.type === "percent" ? "text-right tabular-nums" : ""} md:whitespace-nowrap`}
                >
                  {cell(c, row[c.key] ?? null)}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </TableWrap>
    </div>
  );
}
