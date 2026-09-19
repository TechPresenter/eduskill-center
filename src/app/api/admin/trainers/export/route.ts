import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listTrainers, trainerListSchema } from "@/server/trainers";
import { audit } from "@/lib/audit";
import { titleCase } from "@/lib/utils";

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export of trainers using the same filters as the list (max 5000 rows). */
export const GET = apiHandler({ permission: "trainers.export" }, async ({ req, user, ip, userAgent }) => {
  const q = parseQuery(req, trainerListSchema);
  const rows: Record<string, unknown>[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await listTrainers({ ...q, page, limit: 100 });
    for (const t of res.items) {
      rows.push({
        trainerId: t.trainerId,
        name: t.user.name,
        email: t.user.email ?? "",
        mobile: t.user.mobile ?? "",
        level: titleCase(t.level),
        state: t.state.name,
        district: t.district?.name ?? "",
        block: t.block?.name ?? "",
        status: titleCase(t.status),
        qualification: t.qualification ?? "",
        skills: t.skills.join("; "),
        languages: t.languages.join("; "),
        activeCenters: t.assignments.map((a) => `${a.center.name} (${a.center.code})`).join("; "),
        batches: t._count.batches,
        joinedAt: t.joinedAt.toISOString(),
      });
    }
    if (page >= res.meta.totalPages) break;
  }
  const headers = rows[0] ? Object.keys(rows[0]) : ["trainerId"];
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\r\n");
  await audit({ user: user!, action: "export", module: "trainers", recordType: "Trainer", description: `${user!.name} exported ${rows.length} trainers to CSV`, newValue: q, ip, userAgent });
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="trainers-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
});
