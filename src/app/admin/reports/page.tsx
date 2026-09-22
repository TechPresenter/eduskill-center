import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, BarChart3, Building2, BookOpen, CalendarDays, ClipboardCheck, Coins, CreditCard, GraduationCap, Map, MapPinned, UserCheck, UsersRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { REPORT_TYPES } from "@/server/reports";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";
import { AppList, AppListRow, IconTile, ListSection } from "@/components/admin/content/app-list";

export const metadata: Metadata = { title: "Reports · Foundation Admin" };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  students: GraduationCap,
  trainers: UsersRound,
  centers: Building2,
  courses: BookOpen,
  batches: CalendarDays,
  admissions: UserCheck,
  payments: CreditCard,
  scholarships: Coins,
  attendance: ClipboardCheck,
  certificates: Award,
  states: Map,
  districts: MapPinned,
  blocks: MapPinned,
};

export default async function ReportsHubPage() {
  const user = await requireAdmin("reports.view");
  const canExport = hasPermission(user, "reports.export");
  const groups = [
    { title: "People & admissions", keys: ["students", "trainers", "admissions", "attendance", "certificates"] },
    { title: "Network & academics", keys: ["centers", "courses", "batches"] },
    { title: "Finance", keys: ["payments", "scholarships"] },
    { title: "Location summaries", keys: ["states", "districts", "blocks"] },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Reports & exports" mobileTitle="Reports" description="Every report is computed live from the database. Filter, preview, then export as CSV, Excel or PDF." />
      {!canExport && <Alert tone="info">You can preview reports. Exporting files needs the “Export Reports & Analytics” permission.</Alert>}
      {groups.map((g) => {
        const defs = g.keys.map((k) => REPORT_TYPES.find((r) => r.key === k)).filter((d): d is (typeof REPORT_TYPES)[number] => !!d);
        const id = `grp-${g.title.replace(/[^a-z]+/gi, "-").toLowerCase()}`;
        return (
          <ListSection key={g.title} id={id} title={g.title} count={defs.length}>
            {/* Phones: app list rows. */}
            <AppList aria-labelledby={id} className="sm:hidden">
              {defs.map((def) => {
                const Icon = ICONS[def.key] ?? BarChart3;
                return (
                  <AppListRow
                    key={def.key}
                    href={`/admin/reports/${def.key}`}
                    leading={
                      <IconTile>
                        <Icon />
                      </IconTile>
                    }
                    title={def.label}
                    subtitle={def.description}
                  />
                );
              })}
            </AppList>
            {/* sm+: card grid. */}
            <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
              {defs.map((def) => {
                const Icon = ICONS[def.key] ?? BarChart3;
                return (
                  <Link key={def.key} href={`/admin/reports/${def.key}`} className="card card-hover ring-focus flex items-start gap-4 p-5 tap-highlight-none">
                    <IconTile size="lg">
                      <Icon />
                    </IconTile>
                    <span className="min-w-0 flex-1">
                      <span className="block text-h4 text-navy">{def.label}</span>
                      <span className="mt-1 block text-body-sm text-muted">{def.description}</span>
                      <span className="mt-3 inline-flex items-center gap-1 text-body-sm font-semibold text-orange">
                        Open report <ArrowRight className="h-4 w-4" aria-hidden />
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </ListSection>
        );
      })}
    </div>
  );
}
