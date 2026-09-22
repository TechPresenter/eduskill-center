import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Rows3, Sigma } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatINR, formatNumber, titleCase } from "@/lib/utils";
import { describeFilters, reportDef, reportFilterSchema, runReport, type ReportColumn, type ReportRow } from "@/server/reports";
import { PageHeader } from "@/components/ui/misc";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { ExportButton } from "@/components/admin/shared/export-button";
import { DateRangeFilter, FilterBar, LocationFilter, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { filtersOnly, flattenParams, type SearchParamsRecord } from "@/components/admin/shared/url";
import { HorizontalBarChart } from "@/components/admin/dashboard/charts.lazy";
import { IconTile } from "@/components/admin/content/app-list";
import { REPORT_STATUS_OPTIONS, reportFilterOptions } from "@/app/admin/reports/queries";

export const metadata: Metadata = { title: "Report · Foundation Admin" };

const PREVIEW_ROWS = 100;

/** Aggregate reports get a "top 10" chart; row-per-person reports do not (a bar per student says nothing). */
const CHARTS: Record<string, { sortKey: string; series: { key: string; label: string }[] }> = {
  states: { sortKey: "students", series: [{ key: "students", label: "Students" }, { key: "admissions", label: "Admissions" }] },
  districts: { sortKey: "students", series: [{ key: "students", label: "Students" }, { key: "admissions", label: "Admissions" }] },
  blocks: { sortKey: "students", series: [{ key: "students", label: "Students" }, { key: "admissions", label: "Admissions" }] },
  centers: { sortKey: "students", series: [{ key: "students", label: "Active students" }, { key: "applications", label: "Applications" }] },
  courses: { sortKey: "applications", series: [{ key: "applications", label: "Applications" }, { key: "admissions", label: "Admissions" }] },
  batches: { sortKey: "admitted", series: [{ key: "admitted", label: "Admitted" }, { key: "capacity", label: "Capacity" }] },
};

/** Columns worth totalling in the summary strip, in order of preference. */
const SUM_PREFERENCE = ["revenue", "amount", "paid", "payable", "scholarshipAmount", "students", "admissions", "applications", "admitted", "certificates", "completed", "trainers", "centers"];

const isNumeric = (c: ReportColumn) => c.type === "number" || c.type === "money" || c.type === "percent";

function cell(col: ReportColumn, v: string | number | null) {
  if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
  if (typeof v === "number") {
    if (col.type === "money") return formatINR(v, { decimals: true });
    if (col.type === "percent") return `${v}%`;
    return formatNumber(v);
  }
  return v;
}

function sumOf(rows: ReportRow[], key: string) {
  return rows.reduce((n, r) => n + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);
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

  // Summary strip: the row count plus up to two totals over the rows on screen.
  const sumCols = SUM_PREFERENCE.map((k) => result.columns.find((c) => c.key === k && (c.type === "number" || c.type === "money"))).filter((c): c is ReportColumn => !!c).slice(0, 2);
  const scope = result.truncated ? `first ${formatNumber(result.rows.length)} rows` : "all rows";

  const chart = CHARTS[def.key];
  const chartData = chart
    ? [...result.rows]
        .filter((r) => typeof r[chart.sortKey] === "number")
        .sort((a, b) => (b[chart.sortKey] as number) - (a[chart.sortKey] as number))
        .slice(0, 10)
        .map((r) => ({ name: String(r.name ?? r.code ?? ""), ...Object.fromEntries(chart.series.map((s) => [s.key, (r[s.key] as number) ?? 0])) }))
    : [];

  const numericCols = new Set(result.columns.filter(isNumeric).map((c) => c.key));

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

      {/* Summary cards. */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <IconTile className="max-sm:hidden">
            <Rows3 />
          </IconTile>
          <div className="min-w-0">
            <dt className="truncate text-caption font-semibold tracking-wide text-muted uppercase">Rows</dt>
            <dd className="text-h3 text-navy tabular-nums">{formatNumber(result.total)}</dd>
          </div>
        </div>
        {sumCols.map((c) => (
          <div key={c.key} className="card flex items-center gap-3 p-4">
            <IconTile tone="orange" className="max-sm:hidden">
              <Sigma />
            </IconTile>
            <div className="min-w-0">
              <dt className="truncate text-caption font-semibold tracking-wide text-muted uppercase" title={`${c.label} · ${scope}`}>
                {c.label.replace(" (₹)", "")}
              </dt>
              <dd className="truncate text-h3 text-navy tabular-nums">{c.type === "money" ? formatINR(sumOf(result.rows, c.key)) : formatNumber(sumOf(result.rows, c.key))}</dd>
            </div>
          </div>
        ))}
        <div className="card col-span-2 flex items-center gap-3 p-4 lg:col-span-1">
          <IconTile tone="neutral" className="max-sm:hidden">
            <Clock />
          </IconTile>
          <div className="min-w-0">
            <dt className="truncate text-caption font-semibold tracking-wide text-muted uppercase">Generated</dt>
            <dd className="truncate text-body font-semibold text-ink tabular-nums">{formatDateTime(result.generatedAt)}</dd>
          </div>
        </div>
      </dl>
      <p className="text-caption text-muted">
        {sumCols.length > 0 && `Totals cover ${scope}. `}
        {result.truncated ? `Previewing the first ${formatNumber(result.rows.length)} of ${formatNumber(result.total)} rows – export to get every row.` : ""}
        {filtersLabel ? ` Filters: ${filtersLabel}.` : ""}
      </p>

      {chart && chartData.length > 1 && <HorizontalBarChart title={`Top ${chartData.length} by ${chart.series[0]!.label.toLowerCase()}`} description={result.truncated ? `Among the ${scope}` : undefined} data={chartData} series={chart.series} labelKey="name" />}

      {result.rows.length === 0 ? (
        <EmptyState size="sm" icon={<Rows3 className="h-6 w-6" />} title="No records match these filters" description="Widen the date range or clear a filter to include more records." />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              {result.columns.map((c) => (
                <TH key={c.key} className={c.align === "right" || numericCols.has(c.key) ? "text-right" : undefined}>
                  {c.label}
                </TH>
              ))}
            </tr>
          </THead>
          <TBody>
            {result.rows.map((row, i) => (
              <TR key={i}>
                {result.columns.map((c, ci) => (
                  <TD key={c.key} mobile={ci === 0 ? "full" : undefined} className={`${c.align === "right" || numericCols.has(c.key) ? "text-right tabular-nums" : ""} md:whitespace-nowrap`}>
                    {cell(c, row[c.key] ?? null)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </div>
  );
}
