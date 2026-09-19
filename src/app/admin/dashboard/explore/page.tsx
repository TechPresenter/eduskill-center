import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { PageHeader, Breadcrumbs } from "@/components/ui/misc";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { EXPLORE_LEVELS, exploreHierarchy, exploreQuerySchema } from "@/server/dashboard";
import { flattenParams } from "@/components/admin/shared/url";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Explore hierarchy · Foundation Admin" };

const LEVEL_LABELS: Record<string, string> = { india: "India", state: "State", district: "District", block: "Block", center: "Training center", course: "Course", batch: "Batch", trainer: "Trainer" };

export default async function ExplorePage({ searchParams }: PageProps<"/admin/dashboard/explore">) {
  await requireAdmin("dashboard.view");
  const sp = flattenParams(await searchParams);
  const parsed = exploreQuerySchema.safeParse(sp);
  const query = parsed.success ? parsed.data : { level: "india" as const };
  const result = await exploreHierarchy(query.level !== "india" && !query.id ? { level: "india" } : query);
  const levelIndex = EXPLORE_LEVELS.indexOf(result.level);
  const nextLevel = EXPLORE_LEVELS[levelIndex + 1] ?? "student";
  const parentHref = result.breadcrumb.length > 1 ? result.breadcrumb[result.breadcrumb.length - 2]!.href : "/admin/dashboard";
  const showCol = (k: "centers" | "trainers" | "students" | "applications" | "admissions" | "batches") => result.rows.some((r) => r[k] !== undefined);

  return (
    <div className="space-y-4">
      <PageHeader
        title={result.title}
        backHref={parentHref}
        description={`Drill down from India to individual students. Showing ${result.childLabel.toLowerCase()} at the ${LEVEL_LABELS[result.level]} level.`}
        breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Explore" }]}
      />
      {/* Collapsing trail: a 44px "‹ parent" link on phones, the full path from sm up. */}
      <nav aria-label="Hierarchy path" className="card no-scrollbar overflow-x-auto px-4 py-1 sm:py-3">
        <Breadcrumbs collapse={result.breadcrumb.length > 1} items={[...result.breadcrumb.map((b) => ({ label: b.label, href: b.href })), { label: result.childLabel }]} className="flex-nowrap whitespace-nowrap" />
      </nav>
      <p className="text-[13px] text-muted lg:text-xs">
        Path: {EXPLORE_LEVELS.map((l) => LEVEL_LABELS[l]).join(" → ")} → Student. Tap a row to drill into its {LEVEL_LABELS[nextLevel]?.toLowerCase() ?? "students"}.
      </p>
      <TableWrap>
        <THead>
          <tr>
            <TH>{result.childLabel.replace(/s$/, "")}</TH>
            <TH>Code</TH>
            {result.rows.some((r) => r.status) && <TH>Status</TH>}
            {showCol("centers") && <TH className="text-right">Centers</TH>}
            {showCol("batches") && <TH className="text-right">Batches</TH>}
            {showCol("trainers") && <TH className="text-right">Trainers</TH>}
            {showCol("students") && <TH className="text-right">Students</TH>}
            {showCol("applications") && <TH className="text-right">Applications</TH>}
            {showCol("admissions") && <TH className="text-right">Admissions</TH>}
            <TH className="text-right">
              <span className="sr-only">Links</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {result.rows.length === 0 && <EmptyRow colSpan={10}>Nothing recorded at this level yet.</EmptyRow>}
          {result.rows.map((r) => (
            <TR key={`${r.id}-${r.name}`}>
              <TD primary>
                {r.nextHref ? (
                  <Link href={r.nextHref} className="flex min-h-11 items-center font-medium text-navy hover:underline md:block md:min-h-0">
                    {r.name}
                  </Link>
                ) : (
                  <span className="flex min-h-11 items-center font-medium text-ink md:block md:min-h-0">{r.name}</span>
                )}
              </TD>
              <TD label="Code" className="font-mono text-xs text-muted">{r.code ?? "—"}</TD>
              {result.rows.some((x) => x.status) && <TD label="Status">{r.status ? <StatusBadge status={r.status} /> : "—"}</TD>}
              {showCol("centers") && <TD label="Centers" className="text-right tabular-nums">{formatNumber(r.centers ?? 0)}</TD>}
              {showCol("batches") && <TD label="Batches" className="text-right tabular-nums">{formatNumber(r.batches ?? 0)}</TD>}
              {showCol("trainers") && <TD label="Trainers" className="text-right tabular-nums">{formatNumber(r.trainers ?? 0)}</TD>}
              {showCol("students") && <TD label="Students" className="text-right tabular-nums">{formatNumber(r.students ?? 0)}</TD>}
              {showCol("applications") && <TD label="Applications" className="text-right tabular-nums">{formatNumber(r.applications ?? 0)}</TD>}
              {showCol("admissions") && <TD label="Admissions" className="text-right tabular-nums">{formatNumber(r.admissions ?? 0)}</TD>}
              <TD actions className="text-right whitespace-nowrap">
                {r.nextHref && (
                  <Link href={r.nextHref} className="mr-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-orange hover:underline md:min-h-0 md:text-xs">
                    Drill down <ArrowRight className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden />
                  </Link>
                )}
                {r.detailHref && (
                  <Link href={r.detailHref} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-navy hover:underline md:min-h-0 md:text-xs">
                    Open <ExternalLink className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden />
                  </Link>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
    </div>
  );
}
