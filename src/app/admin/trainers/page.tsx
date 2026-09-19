import Link from "next/link";
import { UsersRound } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";
import { listTrainers, trainerListSchema } from "@/server/trainers";
import { getAdminLookups } from "@/server/admissions";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatsCard } from "@/components/ui/stats";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { Pager } from "@/components/admin/content/pager";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Trainers" };

const LEVELS = ["BLOCK", "DISTRICT", "STATE"] as const;

export default async function TrainersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("trainers.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(trainerListSchema, sp);
  const [data, lookups, counts, skillRows, assignedCount] = await Promise.all([
    listTrainers(q),
    getAdminLookups(),
    db.trainer.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    db.trainer.findMany({ where: { deletedAt: null }, select: { skills: true }, take: 2000 }),
    db.trainer.count({ where: { deletedAt: null, status: "ACTIVE", assignments: { some: { isActive: true } } } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.reduce((n, c) => n + c._count._all, 0);
  const skills = [...new Set(skillRows.flatMap((r) => r.skills))].sort((a, b) => a.localeCompare(b));
  const canExport = hasPermission(user, "trainers.export");
  const base = "/admin/trainers";

  return (
    <div>
      <PageHeader
        title="Trainers"
        mobileTitle="Trainers"
        description={`${formatNumber(data.meta.total)} trainer${data.meta.total === 1 ? "" : "s"} match the current filters.`}
        actions={<ExportButton href={withParams("/api/admin/trainers/export", sp, { page: undefined, limit: undefined })} disabled={!canExport} />}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard label="Active trainers" value={countOf("ACTIVE")} tone="success" href={withParams(base, {}, { status: "ACTIVE" })} />
        <StatsCard label="Currently assigned" value={assignedCount} tone="navy" hint="Active at a training center" />
        <StatsCard label="Inactive" value={countOf("INACTIVE")} tone="warning" href={withParams(base, {}, { status: "INACTIVE" })} />
      </div>

      <FilterBar
        lookups={lookups}
        fields={[
          { type: "search", placeholder: "Trainer ID, name, email or mobile" },
          { type: "select", name: "status", label: "Status", options: [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }] },
          { type: "select", name: "level", label: "Volunteer level", options: LEVELS.map((l) => ({ value: l, label: titleCase(l) })) },
          { type: "select", name: "skill", label: "Skill", options: skills.map((s) => ({ value: s, label: s })), placeholder: skills.length ? "All skills" : "No skills yet" },
          { type: "center", label: "Assigned center" },
          { type: "course", label: "Assigned course" },
          { type: "location" },
        ]}
      />

      {all === 0 ? (
        <EmptyState icon={<UsersRound className="h-7 w-7" />} title="No trainers yet" description="Trainers are created when a volunteer application is approved." action={<Link href="/admin/trainer-applications" className="text-sm font-semibold text-orange hover:underline">Review trainer applications</Link>} />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Trainer</TH>
                <TH>Trainer ID</TH>
                <TH>Level & location</TH>
                <TH>Active assignments</TH>
                <TH className="text-center">Batches</TH>
                <TH>Skills</TH>
                <TH>Status</TH>
                <TH>Joined</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={8}>No trainers match these filters.</EmptyRow>}
              {data.items.map((t) => (
                <TR key={t.id}>
                  <TD mobile="full">
                    <Link href={`${base}/${t.id}`} className="flex items-center gap-3 tap-highlight-none md:hover:text-navy">
                      <Avatar name={t.user.name} src={t.user.avatarUrl} size={40} />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-semibold text-orange md:hidden">{t.trainerId}</span>
                        <span className="block truncate font-semibold">{t.user.name}</span>
                        <span className="block truncate text-xs font-normal text-muted">{t.user.email ?? t.user.mobile ?? "—"}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD label="Trainer ID" mobile="hidden">
                    <span className="font-mono text-xs font-semibold text-navy">{t.trainerId}</span>
                  </TD>
                  <TD label="Level & location" className="max-md:text-right">
                    <Badge tone="navy">{titleCase(t.level)}</Badge>
                    <span className="mt-1 block text-xs text-muted">{[t.block?.name, t.district?.name, t.state.name].filter(Boolean).join(", ")}</span>
                  </TD>
                  <TD label="Assignments" className="md:max-w-[18rem]">
                    {t.assignments.length === 0 ? (
                      <span className="text-xs text-muted">Not assigned</span>
                    ) : (
                      <ul className="space-y-0.5 text-xs max-md:text-right">
                        {t.assignments.slice(0, 3).map((a) => (
                          <li key={a.id} className="truncate">
                            <Link href={`/admin/centers/${a.center.id}`} className="font-medium text-ink hover:text-navy">
                              {a.center.name}
                            </Link>
                            {a.batch ? <span className="text-muted"> · {a.batch.name}</span> : a.course ? <span className="text-muted"> · {a.course.name}</span> : null}
                          </li>
                        ))}
                        {t.assignments.length > 3 && <li className="text-muted">+{t.assignments.length - 3} more</li>}
                      </ul>
                    )}
                  </TD>
                  <TD label="Batches" className="tabular-nums md:text-center">
                    {t._count.batches}
                  </TD>
                  <TD label="Skills" className="md:max-w-[14rem]">
                    <span className="flex flex-wrap gap-1 max-md:justify-end">
                      {t.skills.slice(0, 3).map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                      {t.skills.length > 3 && <span className="text-xs text-muted">+{t.skills.length - 3}</span>}
                    </span>
                  </TD>
                  <TD label="Status">
                    <StatusBadge status={t.status} />
                  </TD>
                  <TD label="Joined" className="text-muted md:whitespace-nowrap">
                    {formatDate(t.joinedAt)}
                  </TD>
                  <TD mobile="actions" className="md:hidden">
                    <ButtonLink href={`${base}/${t.id}`} variant="outline" size="sm" className="w-full">
                      Open profile
                    </ButtonLink>
                  </TD>
                </TR>
              ))}
            </TBody>
          </TableWrap>
          <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
        </>
      )}
    </div>
  );
}
