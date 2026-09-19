import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, Map, MapPinned, Building2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { locationOverview } from "@/server/locations";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { StatsCard } from "@/components/ui/stats";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { LocationImportDialog } from "@/components/admin/locations/import-dialog";

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
    { label: "States / UTs", href: "/admin/states", icon: <Map className="h-5 w-5" />, total: overview.states, active: overview.activeStates, withCenters: overview.statesWithCenters, blurb: "Add or deactivate states and set the 2–3 letter code used in center codes." },
    { label: "Districts", href: "/admin/districts", icon: <MapPinned className="h-5 w-5" />, total: overview.districts, active: overview.activeDistricts, withCenters: overview.districtsWithCenters, blurb: "Districts belong to a state. The 3-character district code becomes part of every center code." },
    { label: "Blocks", href: "/admin/blocks", icon: <Building2 className="h-5 w-5" />, total: overview.blocks, active: overview.activeBlocks, withCenters: overview.blocksWithCenters, blurb: "Blocks belong to a district. Training centers are always registered at block level." },
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
            {canExport ? (
              <a href="/api/admin/locations/export" className={buttonClasses({ variant: "outline", size: "sm" })} title="Download the full hierarchy as CSV" download>
                <Download className="h-4 w-4" /> Export CSV
              </a>
            ) : (
              <span className={buttonClasses({ variant: "outline", size: "sm", className: "pointer-events-none opacity-50" })} aria-disabled="true" title="You do not have permission to export">
                <Download className="h-4 w-4" /> Export CSV
              </span>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {levels.map((l) => (
          <StatsCard key={l.href} label={l.label} value={l.total} hint={`${formatNumber(l.active)} active · ${formatNumber(l.total - l.active)} inactive · ${formatNumber(l.withCenters)} with active centers`} icon={l.icon} tone="navy" href={l.href} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {levels.map((l) => (
          <Card key={l.href} hover>
            <CardBody className="flex h-full flex-col">
              <h3 className="text-base font-bold text-navy">{l.label}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{l.blurb}</p>
              <Link href={l.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange hover:underline">
                Manage {l.label.toLowerCase()} <ArrowRight className="h-4 w-4" />
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Coverage by state" description="States ordered by number of training centers." action={<Link href="/admin/reports/states" className="text-xs font-semibold text-orange hover:underline">Full state report</Link>} />
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
            {topStates.length === 0 && <EmptyRow colSpan={6}>No states yet. Import a CSV or add states manually.</EmptyRow>}
            {topStates.map((s) => (
              <TR key={s.id}>
                <TD mobile="full">
                  <Link href={`/admin/districts?stateId=${s.id}`} className="block tap-highlight-none md:inline">
                    <span className="mr-2 font-mono text-xs font-bold text-orange md:hidden">{s.code}</span>
                    <span className="font-semibold text-navy md:font-medium md:hover:underline">{s.name}</span>
                  </Link>
                </TD>
                <TD label="Code" mobile="hidden" className="font-mono text-xs">
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
