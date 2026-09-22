import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Map, MapPinned, Building2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { locationOverview } from "@/server/locations";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { LocationImportDialog } from "@/components/admin/locations/import-dialog";
import { ExportButton } from "@/components/admin/shared/export-button";
import { IconTile, RowLead } from "@/components/admin/locations/list-kit";

export const metadata: Metadata = { title: "Locations · Foundation Admin" };

export default async function LocationsPage() {
  const user = await requireAdmin("locations.view");
  const [overview, topStates] = await Promise.all([
    locationOverview(),
    db.state.findMany({
      where: { isActive: true },
      orderBy: [{ centers: { _count: "desc" } }, { name: "asc" }],
      take: 10,
      select: { id: true, name: true, code: true, _count: { select: { districts: true, centers: { where: { deletedAt: null } }, students: true, trainers: true } } },
    }),
  ]);
  const canImport = hasPermission(user, "locations.import");
  const canExport = hasPermission(user, "locations.export");

  const levels = [
    { label: "States / UTs", href: "/admin/states", icon: <Map />, total: overview.states, active: overview.activeStates, withCenters: overview.statesWithCenters, blurb: "Add or deactivate states and set the 2–3 letter code used in center codes." },
    { label: "Districts", href: "/admin/districts", icon: <MapPinned />, total: overview.districts, active: overview.activeDistricts, withCenters: overview.districtsWithCenters, blurb: "Districts belong to a state. The 3-character district code becomes part of every center code." },
    { label: "Blocks", href: "/admin/blocks", icon: <Building2 />, total: overview.blocks, active: overview.activeBlocks, withCenters: overview.blocksWithCenters, blurb: "Blocks belong to a district. Training centers are always registered at block level." },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        mobileTitle="Locations"
        description="India → State → District → Block. This hierarchy drives center codes, student/trainer addresses and every location report."
        actions={
          <>
            <LocationImportDialog disabled={!canImport} />
            <ExportButton href="/api/admin/locations/export" disabled={!canExport} />
          </>
        }
      />

      {/*
        One card per level instead of the old stat row + duplicate blurb row: the number, what the level
        is for and the way in all read as a single object, and the whole card is the tap target.
      */}
      <div className="grid gap-4 sm:grid-cols-3">
        {levels.map((l) => (
          <Link key={l.href} href={l.href} className="card card-hover card-p ring-focus group flex flex-col">
            <span className="flex items-center gap-3">
              <IconTile icon={l.icon} size="lg" />
              <span className="min-w-0">
                <span className="text-overline block text-muted">{l.label}</span>
                <span className="text-h2 block text-navy tabular-nums">{formatNumber(l.total)}</span>
              </span>
            </span>
            <span className="text-body-sm mt-3 flex-1 text-muted">{l.blurb}</span>
            {/* The breakdown the old hint ran together on one line, now three labelled figures. */}
            <span className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
              {[
                { k: "Active", v: l.active },
                { k: "Inactive", v: l.total - l.active },
                { k: "With centres", v: l.withCenters },
              ].map((x) => (
                <span key={x.k} className="min-w-0">
                  <span className="text-caption block truncate text-muted">{x.k}</span>
                  <span className="text-h4 block text-ink tabular-nums">{formatNumber(x.v)}</span>
                </span>
              ))}
            </span>
            <span className="text-body-sm mt-4 inline-flex items-center gap-1 font-semibold text-orange">
              Manage {l.label.toLowerCase()}
              <ArrowRight className="duration-micro h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
            </span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="Coverage by state" description="The ten states with the most training centres." action={<Link href="/admin/reports/states" className="text-body-sm inline-flex min-h-11 items-center font-semibold text-orange hover:underline lg:min-h-0">Full state report</Link>} />
        <TableWrap className="max-md:px-4 max-md:pb-4 md:rounded-none md:border-0">
          <THead>
            <tr>
              <TH>State</TH>
              <TH>Code</TH>
              <TH className="text-right">Districts</TH>
              <TH className="text-right">Centers</TH>
              <TH className="text-right">Students</TH>
              <TH className="text-right">Trainers</TH>
            </tr>
          </THead>
          <TBody>
            {topStates.length === 0 && <EmptyRow colSpan={6}>No states yet — import the hierarchy as CSV, or add states one at a time.</EmptyRow>}
            {topStates.map((s) => (
              <TR key={s.id}>
                <TD primary>
                  <RowLead href={`/admin/districts?stateId=${s.id}`} lead={<IconTile icon={<Map />} size="sm" />} title={s.name} meta={<span className="font-mono font-semibold md:hidden">{s.code}</span>} />
                </TD>
                <TD label="Code" mobile="hidden" className="font-mono text-caption">
                  {s.code}
                </TD>
                <TD label="Districts" className="text-right tabular-nums">
                  {formatNumber(s._count.districts)}
                </TD>
                <TD label="Centers" className="text-right tabular-nums">
                  {formatNumber(s._count.centers)}
                </TD>
                <TD label="Students" className="text-right tabular-nums">
                  {formatNumber(s._count.students)}
                </TD>
                <TD label="Trainers" className="text-right tabular-nums">
                  {formatNumber(s._count.trainers)}
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      </Card>
    </div>
  );
}
