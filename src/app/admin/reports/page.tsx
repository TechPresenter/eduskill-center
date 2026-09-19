import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, BarChart3, Building2, BookOpen, CalendarDays, ClipboardCheck, Coins, CreditCard, GraduationCap, Map, MapPinned, UserCheck, UsersRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { REPORT_TYPES } from "@/server/reports";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";

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
      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`grp-${g.title}`}>
          <h2 id={`grp-${g.title}`} className="mb-3 text-xs font-bold tracking-[0.16em] text-muted uppercase">
            {g.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {g.keys.map((k) => {
              const def = REPORT_TYPES.find((r) => r.key === k);
              if (!def) return null;
              const Icon = ICONS[k] ?? BarChart3;
              return (
                <Link key={k} href={`/admin/reports/${k}`} className="card card-hover flex items-start gap-4 p-4 tap-highlight-none sm:p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavender text-navy">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-navy">{def.label}</span>
                    <span className="mt-0.5 block text-sm text-muted">{def.description}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange">
                      Open report <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
