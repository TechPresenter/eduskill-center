import Link from "next/link";
import { Activity, ArrowRight, Award, BookOpen, Building2, CalendarDays, CheckCircle2, ClipboardList, Coins, CreditCard, Eye, FileText, GraduationCap, HandCoins, Map, MapPinned, Search, ShieldCheck, UserCheck, Users, UsersRound } from "lucide-react";
import { StatsCard } from "@/components/ui/stats";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Timeline } from "@/components/ui/misc";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime, formatINR, formatNumber, titleCase } from "@/lib/utils";
import type { getDashboard } from "@/server/dashboard";

type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

/**
 * Phone KPI tile: the icon sits above the text instead of beside it and the label may wrap, so two cards
 * fit a 360px row without truncating labels such as "Pending payments". Desktop (lg+) is untouched.
 */
const KPI_CARD = "min-w-0 max-lg:flex-col max-lg:gap-2 max-lg:p-4 max-lg:[&_p:first-of-type]:whitespace-normal";

export function KpiGrid({ kpis, rangeLabel }: { kpis: Dashboard["kpis"]; rangeLabel: string }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="kpi-network">
        <h2 id="kpi-network" className="mb-3 text-overline text-muted">
          Network
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatsCard label="States" value={kpis.locations.statesWithCenters} hint={`${formatNumber(kpis.locations.activeStates)} active states`} className={KPI_CARD} icon={<Map className="h-5 w-5" />} tone="navy" href="/admin/dashboard/explore" />
          <StatsCard label="Districts" value={kpis.locations.districtsWithCenters} hint={`with active centers · ${formatNumber(kpis.locations.activeDistricts)} total`} className={KPI_CARD} icon={<MapPinned className="h-5 w-5" />} tone="navy" href="/admin/districts" />
          <StatsCard label="Blocks" value={kpis.locations.blocksWithCenters} hint={`with active centers · ${formatNumber(kpis.locations.activeBlocks)} total`} className={KPI_CARD} icon={<MapPinned className="h-5 w-5" />} tone="navy" href="/admin/blocks" />
          <StatsCard label="Centers" value={kpis.centers.total} hint={`${formatNumber(kpis.centers.verified)} verified · ${formatNumber(kpis.centers.pending)} pending`} className={KPI_CARD} icon={<Building2 className="h-5 w-5" />} tone="orange" href="/admin/centers" />
          <StatsCard label="Courses" value={kpis.courses.active} hint={`${formatNumber(kpis.courses.total)} total`} className={KPI_CARD} icon={<BookOpen className="h-5 w-5" />} tone="orange" href="/admin/courses" />
          <StatsCard label="Batches" value={kpis.batches.ongoing + kpis.batches.upcoming} hint={`${formatNumber(kpis.batches.ongoing)} ongoing · ${formatNumber(kpis.batches.upcoming)} upcoming`} className={KPI_CARD} icon={<CalendarDays className="h-5 w-5" />} tone="orange" href="/admin/batches" />
        </div>
      </section>
      <section aria-labelledby="kpi-people">
        <h2 id="kpi-people" className="mb-3 text-overline text-muted">
          Students &amp; trainers
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatsCard label="Students" value={kpis.students.total} hint={`${formatNumber(kpis.students.registered)} with Student ID`} className={KPI_CARD} icon={<GraduationCap className="h-5 w-5" />} tone="info" href="/admin/students" />
          <StatsCard label="Active students" value={kpis.students.active} hint="active admissions" className={KPI_CARD} icon={<UserCheck className="h-5 w-5" />} tone="success" href="/admin/admissions" />
          <StatsCard label="Trainers" value={kpis.trainers.total} hint={`${formatNumber(kpis.trainers.active)} active`} className={KPI_CARD} icon={<UsersRound className="h-5 w-5" />} tone="info" href="/admin/trainers" />
          <StatsCard label="Trainer levels" value={<span className="text-lg">{`${kpis.trainers.block} · ${kpis.trainers.district} · ${kpis.trainers.state}`}</span>} hint="block · district · state" className={KPI_CARD} icon={<Users className="h-5 w-5" />} tone="info" />
          <StatsCard label="Applications" value={kpis.applications.inRange} hint={`${rangeLabel} · ${formatNumber(kpis.applications.pendingReview)} pending review`} className={KPI_CARD} icon={<ClipboardList className="h-5 w-5" />} tone="warning" href="/admin/applications" />
          <StatsCard label="Admissions" value={kpis.admissions.inRange} hint={`${rangeLabel} · ${formatNumber(kpis.admissions.total)} all time`} className={KPI_CARD} icon={<UserCheck className="h-5 w-5" />} tone="success" href="/admin/admissions" />
        </div>
      </section>
      <section aria-labelledby="kpi-finance">
        <h2 id="kpi-finance" className="mb-3 text-overline text-muted">
          Finance &amp; outcomes
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatsCard label="Revenue" value={formatINR(kpis.revenue.inRange)} hint={`${rangeLabel} · ${formatINR(kpis.revenue.total)} all time`} className={KPI_CARD} icon={<CreditCard className="h-5 w-5" />} tone="success" href="/admin/payments" />
          <StatsCard label="Pending payments" value={kpis.pendingPayments.count} hint={`${formatINR(kpis.pendingPayments.amountDue)} due`} className={KPI_CARD} icon={<HandCoins className="h-5 w-5" />} tone="warning" href="/admin/applications?status=PAYMENT_PENDING" />
          <StatsCard label="Scholarships" value={kpis.scholarships.count} hint={`${formatINR(kpis.scholarships.amount)} awarded`} className={KPI_CARD} icon={<Coins className="h-5 w-5" />} tone="orange" href="/admin/scholarships" />
          <StatsCard label="Certificates" value={kpis.certificates.issued} hint={`${formatNumber(kpis.certificates.inRange)} ${rangeLabel.toLowerCase()}`} className={KPI_CARD} icon={<Award className="h-5 w-5" />} tone="navy" href="/admin/certificates" />
          <StatsCard label="Trainer applications" value={kpis.trainerApplications.inRange} hint={`${rangeLabel} · ${formatNumber(kpis.trainerApplications.pending)} in pipeline`} className={KPI_CARD} icon={<FileText className="h-5 w-5" />} tone="info" href="/admin/trainer-applications" />
          <StatsCard label="Batches completed" value={kpis.batches.completed} hint={`${formatNumber(kpis.batches.cancelled)} cancelled`} className={KPI_CARD} icon={<ShieldCheck className="h-5 w-5" />} tone="navy" href="/admin/batches?status=COMPLETED" />
        </div>
      </section>
    </div>
  );
}

const APP_ORDER = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "WAITLISTED", "REJECTED", "CANCELLED", "COMPLETED"];

export function ApplicationStatusStrip({ byStatus }: { byStatus: Record<string, number> }) {
  const entries = APP_ORDER.filter((s) => byStatus[s]).map((s) => [s, byStatus[s]!] as const);
  return (
    <Card>
      <CardHeader title="Applications by status" description="All time" action={<Link href="/admin/applications" className="text-body-sm font-semibold text-orange ring-focus rounded-xs hover:underline">View all</Link>} />
      <CardBody className="flex flex-wrap gap-2">
        {entries.length === 0 && <p className="text-body text-muted">No applications have been submitted yet.</p>}
        {entries.map(([s, n]) => (
          <Link key={s} href={`/admin/applications?status=${s}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1 text-body-sm font-medium text-ink ring-focus tap-highlight-none transition-colors duration-micro hover:border-navy/40 hover:bg-lavender active:bg-lavender motion-reduce:transition-none lg:min-h-0 lg:px-3">
            {titleCase(s)} <span className="rounded-full bg-white px-1.5 font-bold text-navy tabular-nums">{formatNumber(n)}</span>
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}

export function AnalyticsPanel({ analytics, rangeLabel }: { analytics: Dashboard["analytics"]; rangeLabel: string }) {
  const items = [
    { label: "Visitors", value: analytics.visitors, hint: `${formatNumber(analytics.pageViews)} page views`, Icon: Eye },
    { label: "Center searches", value: analytics.centerSearches, hint: `${formatNumber(analytics.centerViews)} center views`, Icon: Search },
    { label: "Course views", value: analytics.courseViews, hint: "course detail pages", Icon: BookOpen },
    { label: "Applications started", value: analytics.applicationsStarted, hint: "student applications", Icon: ClipboardList },
    { label: "Trainer applications", value: analytics.trainerApplicationsStarted, hint: "started on website", Icon: FileText },
    { label: "Certificate checks", value: analytics.certificateVerifications, hint: "public verifications", Icon: ShieldCheck },
  ];
  return (
    <Card>
      <CardHeader title="Website analytics" description={`Internal tracking · ${rangeLabel}`} />
      <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="flex min-w-0 items-start gap-2 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
              <it.Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-caption font-medium text-muted">{it.label}</p>
              <p className="font-heading text-xl font-extrabold text-navy tabular-nums">{formatNumber(it.value)}</p>
              <p className="text-caption text-muted">{it.hint}</p>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

const MODULE_LINKS: Record<string, string> = { centers: "/admin/centers", batches: "/admin/batches", courses: "/admin/courses", locations: "/admin/locations", users: "/admin/staff", roles: "/admin/roles", settings: "/admin/settings", applications: "/admin/applications", admissions: "/admin/admissions", payments: "/admin/payments", trainers: "/admin/trainers", students: "/admin/students" };

export function ActivityFeed({ activity }: { activity: Dashboard["activity"] }) {
  const tone = (action: string): "orange" | "navy" | "success" | "danger" | "neutral" => (action.includes("delete") || action.includes("reject") || action.includes("revoke") ? "danger" : action.includes("create") || action.includes("approve") || action.includes("verify") ? "success" : action === "login" ? "neutral" : "navy");
  return (
    <Card>
      <CardHeader title="Recent activity" description="Latest audit log entries" action={<Link href="/admin/audit-logs" className="text-body-sm font-semibold text-orange ring-focus rounded-xs hover:underline">All logs</Link>} />
      <CardBody>
        {activity.length === 0 ? (
          <p className="text-body text-muted">No activity recorded yet.</p>
        ) : (
          <Timeline
            className="[&>li]:min-h-12"
            items={activity.map((a) => ({
              title: (
                <span className="flex flex-wrap items-center gap-2">
                  <span>{a.description}</span>
                  <Badge tone="neutral">{a.module}</Badge>
                </span>
              ),
              description: `${a.actorName ?? "System"} · ${titleCase(a.actorRole ?? "")}${a.recordType ? ` · ${a.recordType}` : ""}`,
              meta: <Link href={MODULE_LINKS[a.module] ?? "/admin/audit-logs"} className="hover:text-navy">{formatDateTime(a.createdAt)}</Link>,
              tone: tone(a.action),
            }))}
          />
        )}
      </CardBody>
    </Card>
  );
}

export interface AttentionCounts {
  applications: number;
  trainerApplications: number;
  centersPending: number;
  paymentsPending: number;
  paymentsDue: number;
}

/** Which queues this member of staff can actually act on. Showing a queue nobody can clear is noise. */
export interface AttentionPerms {
  applications: boolean;
  trainerApplications: boolean;
  centers: boolean;
  payments: boolean;
}

/**
 * The first thing on the dashboard, and deliberately so: a Foundation Admin opens this page to find out
 * what is waiting, not to read eighteen totals. Every number here is a live count from the database —
 * all time, not the selected period, because a three-week-old application is still unreviewed today.
 * Queues are ordered by size, so the longest one is read first, and a queue the signed-in user has no
 * permission to work on is not shown at all.
 */
export function NeedsAttention({ counts, can }: { counts: AttentionCounts; can: AttentionPerms }) {
  const queues = [
    { key: "applications", show: can.applications, href: "/admin/applications?status=SUBMITTED,UNDER_REVIEW,DOCUMENTS_REQUIRED", label: "Applications to review", hint: "Submitted, under review or waiting on documents", count: counts.applications, Icon: ClipboardList },
    { key: "trainers", show: can.trainerApplications, href: "/admin/trainer-applications", label: "Trainer applications", hint: "In the pipeline, before approval", count: counts.trainerApplications, Icon: FileText },
    { key: "payments", show: can.payments, href: "/admin/applications?status=PAYMENT_PENDING", label: "Payments pending", hint: `${formatINR(counts.paymentsDue)} still due`, count: counts.paymentsPending, Icon: CreditCard },
    { key: "centers", show: can.centers, href: "/admin/centers?status=PENDING", label: "Centers to verify", hint: "Awaiting Foundation verification", count: counts.centersPending, Icon: Building2 },
  ]
    .filter((q) => q.show)
    .sort((a, b) => b.count - a.count);

  const waiting = queues.reduce((n, q) => n + q.count, 0);

  return (
    <Card>
      <CardHeader
        title="Needs your attention"
        description={queues.length === 0 ? "Your role does not include any of the review queues." : waiting > 0 ? `${formatNumber(waiting)} item${waiting === 1 ? "" : "s"} waiting on the Foundation team right now.` : "Live queues, counted across all time."}
      />
      <CardBody>
        {queues.length > 0 && waiting === 0 ? (
          <div className="flex items-center gap-3 rounded-card border border-success/25 bg-success-light px-4 py-5">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success-dark" aria-hidden />
            <p className="text-body text-success-dark">
              <span className="font-semibold">Every queue is clear.</span> Nothing is waiting for review, verification or payment follow-up.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {queues.map((q) => {
              const idle = q.count === 0;
              return (
                <li key={q.key} className="min-w-0">
                  <Link
                    href={q.href}
                    className={cn(
                      // Spelled out rather than composed from `card`: the tile overrides the card's
                      // border and background, and utility-vs-utility override order is not something
                      // to bet a layout on.
                      "card-hover ring-focus flex min-h-[7rem] flex-col gap-2 rounded-card border p-4 shadow-e1",
                      // An empty queue stays legible but stops competing for the eye.
                      idle ? "border-line bg-white" : "border-orange/30 bg-orange-light/50"
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", idle ? "bg-surface text-muted" : "bg-orange text-white")}>
                        <q.Icon className="h-4.5 w-4.5" aria-hidden />
                      </span>
                      <span className={cn("font-heading text-h2 leading-none tabular-nums", idle ? "text-muted" : "text-orange")}>{formatNumber(q.count)}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-h4 text-navy">{q.label}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-body-sm text-muted">
                        <span className="min-w-0 truncate">{q.hint}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/** The four things staff start from the dashboard. No counts here — this is "do", not "triage". */
export function CommonTasks({ can }: { can: { centers: boolean; batches: boolean } }) {
  const links = [
    { href: "/admin/centers/new", label: "Add a training center", show: can.centers, Icon: Building2 },
    { href: "/admin/batches/new", label: "Create a batch", show: can.batches, Icon: CalendarDays },
    { href: "/admin/reports", label: "Reports & exports", show: true, Icon: Activity },
    { href: "/admin/dashboard/explore", label: "Explore India → State → Center", show: true, Icon: Map },
  ].filter((l) => l.show);
  return (
    <Card>
      <CardHeader title="Common tasks" description="The usual starting points" />
      <ul className="divide-y divide-line">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-14 items-center gap-3 px-5 py-3 text-body text-ink ring-focus tap-highlight-none transition-colors duration-micro hover:bg-surface active:bg-surface motion-reduce:transition-none">
              <l.Icon className="h-5 w-5 shrink-0 text-navy" aria-hidden />
              <span className="min-w-0 flex-1">{l.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CenterPerformanceTable({ rows }: { rows: Dashboard["charts"]["centerPerformance"] }) {
  return (
    <Card>
      <CardHeader title="Center performance" description="Top centers by active students" action={<Link href="/admin/reports/centers" className="text-body-sm font-semibold text-orange ring-focus rounded-xs hover:underline">Full report</Link>} />
      {/* Card mode below md (TableWrap default); md:border-0 keeps the desktop look flush inside the Card. */}
      <TableWrap className="rounded-none border-0 md:rounded-none md:border-0">
        <THead>
          <tr>
            <TH>Center</TH>
            <TH className="text-right">Students</TH>
            <TH className="text-right">Applications</TH>
            <TH className="text-right">Completion</TH>
            <TH className="text-right">Attendance</TH>
            <TH className="text-right">Revenue</TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={6}>No centers yet.</EmptyRow>}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD primary>
                <Link href={`/admin/centers/${r.id}`} className="flex min-h-11 flex-col justify-center font-medium text-navy hover:underline md:min-h-0 md:block">
                  {r.name}
                  <span className="block text-body-sm font-normal text-muted">{r.code}</span>
                </Link>
              </TD>
              <TD label="Students" className="text-right tabular-nums">{formatNumber(r.students)}</TD>
              <TD label="Applications" className="text-right tabular-nums">{formatNumber(r.applications)}</TD>
              <TD label="Completion" className="text-right tabular-nums">{r.completionPct === null ? "—" : `${r.completionPct}%`}</TD>
              <TD label="Attendance" className="text-right tabular-nums">{r.attendancePct === null ? "—" : `${r.attendancePct}%`}</TD>
              <TD label="Revenue" className="text-right tabular-nums">{formatINR(r.revenue)}</TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
    </Card>
  );
}
