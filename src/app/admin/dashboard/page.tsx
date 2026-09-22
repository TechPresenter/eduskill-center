import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { dashboardQuerySchema, getDashboard } from "@/server/dashboard";
import { flattenParams } from "@/components/admin/shared/url";
import { DashboardRangeFilter } from "@/components/admin/dashboard/range-filter";
// Lazy (ssr:false) chart wrappers: Recharts loads in its own chunk after hydration, so the dashboard HTML
// and the initial route chunk stay free of the charting bundle (a skeleton renders first).
import { DonutChart, HorizontalBarChart, TrendChart, VerticalBarChart } from "@/components/admin/dashboard/charts.lazy";
import { ActivityFeed, AnalyticsPanel, ApplicationStatusStrip, CenterPerformanceTable, CommonTasks, KpiGrid, NeedsAttention } from "@/components/admin/dashboard/panels";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard · Foundation Admin" };

function rangeLabel(range: string | null, from: Date | null, to: Date | null) {
  switch (range) {
    case "today":
      return "Today";
    case "7d":
      return "Last 7 days";
    case "custom":
      return from || to ? `${from ? formatDate(from) : "…"} – ${to ? formatDate(new Date(to.getTime() - 1)) : "…"}` : "Custom range";
    case "30d":
    default:
      return "Last 30 days";
  }
}

export default async function DashboardPage({ searchParams }: PageProps<"/admin/dashboard">) {
  const user = await requireAdmin("dashboard.view");
  const sp = flattenParams(await searchParams);
  const parsed = dashboardQuerySchema.safeParse(sp);
  const query = parsed.success ? parsed.data : {};
  const effective = { ...query, range: query.range ?? ("30d" as const) };
  const data = await getDashboard(effective);
  const label = rangeLabel(data.range.preset, data.range.from, data.range.to);
  const c = data.charts;
  const can = {
    applications: hasPermission(user, "applications.view"),
    trainerApplications: hasPermission(user, "trainers.view"),
    centers: hasPermission(user, "centers.view"),
    payments: hasPermission(user, "payments.view"),
    createCenter: hasPermission(user, "centers.create"),
    createBatch: hasPermission(user, "batches.create"),
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        mobileTitle="Dashboard"
        description="Live overview of the EduSkill network — every number on this page is computed from the database."
        actions={
          <>
            <DashboardRangeFilter range={effective.range} from={sp.from} to={sp.to} />
            <ButtonLink href="/admin/dashboard/explore" variant="navy" size="sm" leftIcon={<Compass className="h-4 w-4" />} className="max-lg:w-full">
              Explore hierarchy
            </ButtonLink>
          </>
        }
      />

      {/*
        Triage first. The audit's point about this page was that it opened with eighteen totals and
        buried "where attention is needed" at the very bottom, next to the audit log. The queues a
        person can actually clear now come before anything they can only read.
      */}
      <NeedsAttention
        counts={{
          applications: data.kpis.applications.pendingReview,
          trainerApplications: data.kpis.trainerApplications.pending,
          centersPending: data.kpis.centers.pending,
          paymentsPending: data.kpis.pendingPayments.count,
          paymentsDue: data.kpis.pendingPayments.amountDue,
        }}
        can={can}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ApplicationStatusStrip byStatus={data.kpis.applications.byStatus} />
        </div>
        <CommonTasks can={{ centers: can.createCenter, batches: can.createBatch }} />
      </div>

      <KpiGrid kpis={data.kpis} rangeLabel={label} />

      <section aria-labelledby="charts-heading" className="space-y-4">
        <h2 id="charts-heading" className="text-overline text-muted">
          Analytics
        </h2>
        {/* min-w-0 on every cell: Recharts ResponsiveContainer must never widen its grid track. */}
        <div className="grid min-w-0 gap-4 [&>*]:min-w-0 lg:grid-cols-2">
          <TrendChart title="Monthly admissions" description="Last 12 months" data={c.monthlyAdmissions} labelKey="month" series={[{ key: "admissions", label: "Admissions" }]} area />
          <VerticalBarChart title="Revenue by month" description="Completed payments, last 12 months" data={c.revenueByMonth} labelKey="month" series={[{ key: "revenue", label: "Revenue", format: "money" }]} />
          <VerticalBarChart title="State-wise students" description="Registered students by home state (top 15)" data={c.stateWiseStudents} labelKey="code" series={[{ key: "students", label: "Students" }]} />
          <HorizontalBarChart title="Course popularity" description="Applications per course (top 10)" data={c.coursePopularity} labelKey="name" series={[{ key: "applications", label: "Applications", color: "#e8520a" }]} />
          <HorizontalBarChart title="District-wise centers" description="Top 15 districts" data={c.districtWiseCenters} labelKey="name" series={[{ key: "centers", label: "Centers" }]} />
          <HorizontalBarChart title="Block-wise centers" description="Top 15 blocks" data={c.blockWiseCenters} labelKey="name" series={[{ key: "centers", label: "Centers" }]} />
          <HorizontalBarChart title="Attendance by batch" description="Average attendance % for the 10 most-marked batches" data={c.attendanceByBatch} labelKey="code" series={[{ key: "pct", label: "Attendance", format: "percent", color: "#0e9f8e" }]} />
          <TrendChart title="Attendance trend" description="Weekly average attendance %, last 12 weeks" data={c.attendanceWeekly} labelKey="week" series={[{ key: "pct", label: "Attendance", format: "percent", color: "#0e9f8e" }]} />
          <VerticalBarChart title="Scholarships by month" description="Approved scholarship amount, last 12 months" data={c.scholarshipsByMonth} labelKey="month" series={[{ key: "amount", label: "Amount", format: "money", color: "#8e6bd6" }]} />
          <div className="grid min-w-0 gap-4 [&>*]:min-w-0 sm:grid-cols-2">
            <DonutChart title="Trainers by level" data={c.trainerStats.byLevel.map((t) => ({ name: t.name === "BLOCK" ? "Block" : t.name === "DISTRICT" ? "District" : "State", value: t.value }))} valueLabel="Trainers" />
            <DonutChart title="Trainers by status" data={c.trainerStats.byStatus.map((t) => ({ name: t.name === "ACTIVE" ? "Active" : "Inactive", value: t.value }))} valueLabel="Trainers" colors={{ Active: "#12b76a", Inactive: "#98a2b3" }} />
          </div>
        </div>
      </section>

      <CenterPerformanceTable rows={c.centerPerformance} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityFeed activity={data.activity} />
        </div>
        <AnalyticsPanel analytics={data.analytics} rangeLabel={label} />
      </div>
    </div>
  );
}
